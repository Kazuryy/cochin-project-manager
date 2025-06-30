# backend/database/serializers.py
from rest_framework import serializers
from .models import DynamicTable, DynamicField, DynamicRecord, DynamicValue, ProjectPdfFile
import json
import logging
from django.db import models, transaction
from django.core.cache import cache
from typing import Dict, Any, Optional
from django.contrib.auth import get_user_model

# Configuration du logger
logger = logging.getLogger(__name__)

# Constantes pour les types de champs
class FieldTypes:
    TEXT = 'text'
    LONG_TEXT = 'long_text'
    CHOICE = 'choice'
    FOREIGN_KEY = 'foreign_key'
    NUMBER = 'number'
    DATE = 'date'
    BOOLEAN = 'boolean'

# Constantes pour les noms de champs génériques (ordre de priorité)
GENERIC_FIELD_NAMES = [
    'nom_projet', 'nom', 'name', 'label', 'title', 
    'titre', 'libelle', 'description', 'desc'
]

# Champs système à ignorer lors de la recherche de valeurs lisibles
SYSTEM_FIELD_NAMES = [
    'id', 'custom_id', 'primary_identifier', 
    'created_at', 'updated_at', 'is_active'
]

class DynamicFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = DynamicField
        fields = [
            'id', 'name', 'slug', 'description', 'field_type', 
            'is_required', 'is_unique', 'is_searchable', 'is_active',
            'order', 'default_value', 'options', 'related_table'
        ]
        read_only_fields = ['id']
    
    def validate_options(self, value):
        """Valider le format des options pour les champs de type choix."""
        # Utiliser les données validées plutôt que initial_data pour plus de fiabilité
        field_type = self.get_field_type()
        
        if field_type == FieldTypes.CHOICE:
            if not value:
                raise serializers.ValidationError(
                    "Les options sont requises pour les champs de type choix."
                )
            
            # Valider le format JSON
            if not self._is_valid_options_format(value):
                raise serializers.ValidationError(
                    "Les options doivent être une liste ou un dictionnaire JSON valide."
                )
        
        return value
    
    def get_field_type(self) -> str:
        """Récupérer le type de champ de manière sécurisée."""
        # Prioriser les données validées, puis initial_data, puis instance
        if hasattr(self, 'validated_data') and 'field_type' in self.validated_data:
            return self.validated_data['field_type']
        elif hasattr(self, 'initial_data') and 'field_type' in self.initial_data:
            return self.initial_data['field_type']
        elif self.instance:
            return self.instance.field_type
        return ''
    
    def _is_valid_options_format(self, value) -> bool:
        """Vérifier si les options sont dans un format valide."""
        try:
            if isinstance(value, str):
                json.loads(value)
                return True
            elif isinstance(value, (list, dict)):
                return True
            return False
        except (json.JSONDecodeError, TypeError):
            return False
    
    def validate(self, data):
        """Validation croisée des champs."""
        # Validation pour les clés étrangères
        if data.get('field_type') == FieldTypes.FOREIGN_KEY and not data.get('related_table'):
            raise serializers.ValidationError({
                "related_table": "Une table liée est requise pour les champs de type clé étrangère."
            })
        
        return data

class DynamicTableSerializer(serializers.ModelSerializer):
    fields = DynamicFieldSerializer(many=True, read_only=True)
    
    class Meta:
        model = DynamicTable
        fields = '__all__'
    
    def to_representation(self, instance):
        """Optimiser la récupération des champs avec une seule requête."""
        data = super().to_representation(instance)
        if instance:
            # Optimisation : utiliser select_related et filter en une seule requête
            fields_queryset = instance.fields.select_related('related_table').filter(
                is_active=True
            ).order_by('order')
            data['fields'] = DynamicFieldSerializer(fields_queryset, many=True).data
        return data

class DynamicValueSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)
    field_slug = serializers.CharField(source='field.slug', read_only=True)
    field_type = serializers.CharField(source='field.field_type', read_only=True)
    
    class Meta:
        model = DynamicValue
        fields = '__all__'

class DynamicRecordSerializer(serializers.ModelSerializer):
    values = DynamicValueSerializer(many=True, read_only=True)
    
    class Meta:
        model = DynamicRecord
        fields = '__all__'
    
    def to_representation(self, instance):
        """Optimiser la récupération des valeurs."""
        data = super().to_representation(instance)
        # Optimisation : prefetch_related pour éviter les requêtes N+1
        if hasattr(instance, '_prefetched_objects_cache'):
            # Les données sont déjà préchargées
            data['values'] = DynamicValueSerializer(instance.values.all(), many=True).data
        else:
            # Charger avec optimisation
            values_queryset = instance.values.select_related('field', 'field__related_table')
            data['values'] = DynamicValueSerializer(values_queryset, many=True).data
        return data

class DynamicRecordCreateSerializer(serializers.ModelSerializer):
    values = serializers.DictField(write_only=True)
    table = serializers.PrimaryKeyRelatedField(
        queryset=DynamicTable.objects.all(),
        required=False
    )
    
    class Meta:
        model = DynamicRecord
        fields = ['table', 'values', 'created_by']
        read_only_fields = ['created_by']
    
    def validate(self, data):
        """Validation améliorée avec messages d'erreur clairs."""
        if not self.instance and not data.get('table'):
            raise serializers.ValidationError({
                'table': 'Ce champ est obligatoire lors de la création.'
            })
        return data
    
    @transaction.atomic
    def create(self, validated_data):
        """Créer un enregistrement avec transaction atomique."""
        values_data = validated_data.pop('values', {})
        table = validated_data.get('table')
        
        # Gestion sécurisée de l'utilisateur
        self._set_created_by(validated_data)
        
        # Créer l'enregistrement
        record = DynamicRecord.objects.create(**validated_data)
        
        # Créer les valeurs en lot pour optimiser les performances
        self._create_values_efficiently(record, table, values_data)
        
        return record
    
    @transaction.atomic
    def update(self, instance, validated_data):
        """Mettre à jour avec transaction atomique."""
        values_data = validated_data.pop('values', {})
        
        # Mettre à jour l'enregistrement (table non modifiable)
        for attr, value in validated_data.items():
            if attr != 'table':
                setattr(instance, attr, value)
        instance.save()
        
        # Mettre à jour les valeurs efficacement
        self._update_values_efficiently(instance, values_data)
        
        return instance
    
    def _set_created_by(self, validated_data):
        """Gérer l'attribution de created_by de manière sécurisée."""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        else:
            validated_data.pop('created_by', None)
    
    def _create_values_efficiently(self, record, table, values_data):
        """Créer les valeurs de manière optimisée."""
        if not values_data:
            return
        
        # Récupérer tous les champs en une seule requête
        fields_dict = {
            field.slug: field 
            for field in table.fields.filter(slug__in=values_data.keys())
        }
        
        # Préparer les objets DynamicValue pour création en lot
        values_to_create = []
        for field_slug, value in values_data.items():
            if field_slug in fields_dict:
                values_to_create.append(
                    DynamicValue(
                        record=record,
                        field=fields_dict[field_slug],
                        value=str(value) if value is not None else ''
                    )
                )
            else:
                logger.warning(f"Champ ignoré lors de la création: {field_slug}")
        
        # Création en lot pour optimiser les performances
        if values_to_create:
            DynamicValue.objects.bulk_create(values_to_create)
    
    def _update_values_efficiently(self, instance, values_data):
        """Mettre à jour les valeurs de manière optimisée."""
        if not values_data:
            return
        
        # Récupérer tous les champs et valeurs existantes en une seule requête
        fields_dict = {
            field.slug: field 
            for field in instance.table.fields.filter(slug__in=values_data.keys())
        }
        
        existing_values = {
            value.field.slug: value 
            for value in instance.values.select_related('field').filter(
                field__slug__in=values_data.keys()
            )
        }
        
        values_to_create = []
        values_to_update = []
        
        for field_slug, value in values_data.items():
            if field_slug not in fields_dict:
                logger.warning(f"Champ ignoré lors de la mise à jour: {field_slug}")
                continue
            
            str_value = str(value) if value is not None else ''
            
            if field_slug in existing_values:
                # Mettre à jour la valeur existante
                existing_value = existing_values[field_slug]
                existing_value.value = str_value
                values_to_update.append(existing_value)
            else:
                # Créer une nouvelle valeur
                values_to_create.append(
                    DynamicValue(
                        record=instance,
                        field=fields_dict[field_slug],
                        value=str_value
                    )
                )
        
        # Exécuter les mises à jour et créations en lot
        if values_to_update:
            DynamicValue.objects.bulk_update(values_to_update, ['value'])
        if values_to_create:
            DynamicValue.objects.bulk_create(values_to_create)

class FlatDynamicRecordSerializer(serializers.ModelSerializer):
    """
    Sérialiseur optimisé qui retourne un enregistrement avec ses valeurs aplaties
    et les FK automatiquement résolues en valeurs lisibles.
    """
    
    def to_representation(self, instance):
        """Représentation aplatie avec résolution FK optimisée."""
        if not instance:
            return {}
            
        data = super().to_representation(instance)
        
        # Optimisation : précharger toutes les données nécessaires
        try:
            values_with_fk = self._get_optimized_values(instance)
            
            # Traiter chaque valeur
            for value in values_with_fk:
                field = value.field
                field_value = value.value
                
                if field.field_type == FieldTypes.FOREIGN_KEY and field.related_table and field_value:
                    self._resolve_foreign_key(data, field, field_value)
                else:
                    data[field.slug] = self._format_value(field_value, field.field_type)
        except Exception as e:
            logger.error(f"Erreur lors de la représentation de l'enregistrement {instance.id}: {e}")
            # Continuer avec les données de base en cas d'erreur
        
        return data
    
    def _get_optimized_values(self, instance):
        """
        Récupérer les valeurs avec optimisation des requêtes.
        ✅ FIX CRITIQUE: Utilisation du bon related_name 'records' au lieu de 'dynamicrecord_set'
        """
        if not instance:
            return DynamicValue.objects.none()
        
        return instance.values.select_related(
            'field', 
            'field__related_table'
        ).prefetch_related(
            # ✅ CORRECTION: Utiliser 'records' (le bon related_name) au lieu de 'dynamicrecord_set'
            'field__related_table__records__values__field'
        )
    
    def _resolve_foreign_key(self, data: Dict[str, Any], field: DynamicField, field_value: str):
        """Résoudre une clé étrangère de manière optimisée avec gestion d'erreurs robuste."""
        if not field or not field.related_table or not field_value:
            data[field.slug] = "[Référence invalide]"
            return
            
        try:
            # Tentative de résolution par ID
            if self._try_resolve_by_id(data, field, field_value):
                return
            
            # Tentative de résolution par nom
            if self._try_resolve_by_name(data, field, field_value):
                return
            
            # Aucune résolution possible
            data[field.slug] = f"[Référence manquante: {field_value}]"
            data[f"{field.slug}_raw"] = field_value
            
        except Exception as e:
            logger.error(f"Erreur lors de la résolution FK {field.slug}: {e}")
            data[field.slug] = f"[Erreur de résolution: {field_value}]"
            data[f"{field.slug}_raw"] = field_value
    
    def _try_resolve_by_id(self, data: Dict[str, Any], field: DynamicField, field_value: str) -> bool:
        """Tentative de résolution par ID avec gestion d'erreurs améliorée."""
        try:
            record_id = int(field_value)
            related_record = DynamicRecord.objects.select_related('table').prefetch_related(
                'values__field'
            ).get(
                id=record_id,
                table=field.related_table,
                is_active=True
            )
            
            resolved_value = self._get_readable_value_optimized(related_record)
            data[field.slug] = resolved_value
            data[f"{field.slug}_id"] = field_value
            return True
            
        except (ValueError, DynamicRecord.DoesNotExist, AttributeError) as e:
            logger.debug(f"Résolution par ID échouée pour {field.slug}={field_value}: {e}")
            return False
    
    def _try_resolve_by_name(self, data: Dict[str, Any], field: DynamicField, field_value: str) -> bool:
        """
        Tentative de résolution par nom avec cache optimisé et gestion d'erreurs.
        ✅ OPTIMISATION: Cache avec fallback gracieux
        """
        if not field.related_table:
            return False
            
        # Optimisation avec cache pour éviter les requêtes répétées
        cache_key = f"fk_resolve_{field.related_table.id}_{field_value}"
        
        try:
            cached_result = cache.get(cache_key)
            
            if cached_result is not None:
                if cached_result.get('found'):
                    data[field.slug] = field_value
                    data[f"{field.slug}_id"] = cached_result['id']
                    return True
                return False
            
            # Recherche optimisée avec une seule requête
            related_records = DynamicRecord.objects.filter(
                table=field.related_table,
                is_active=True
            ).prefetch_related('values__field')
            
            for record in related_records:
                record_name = self._get_readable_value_optimized(record)
                if record_name == field_value:
                    # Mettre en cache le résultat
                    try:
                        cache.set(cache_key, {'found': True, 'id': record.id}, 300)  # 5 minutes
                    except Exception as cache_error:
                        logger.warning(f"Erreur de mise en cache: {cache_error}")
                    
                    data[field.slug] = field_value
                    data[f"{field.slug}_id"] = record.id
                    return True
            
            # Mettre en cache l'échec
            try:
                cache.set(cache_key, {'found': False}, 300)
            except Exception as cache_error:
                logger.warning(f"Erreur de mise en cache (échec): {cache_error}")
                
        except Exception as e:
            logger.error(f"Erreur lors de la résolution par nom pour {field.slug}: {e}")
        
        return False
    
    def _get_readable_value_optimized(self, record: DynamicRecord) -> str:
        """
        Version optimisée pour trouver la valeur la plus lisible avec protection contre les erreurs.
        ✅ OPTIMISATION: Gestion défensive des cas d'erreur
        """
        if not record:
            return "[Enregistrement invalide]"
            
        try:
            # Créer un dictionnaire des valeurs pour éviter les boucles multiples
            values_dict = {}
            
            # Protection contre les erreurs d'accès aux valeurs
            try:
                for value in record.values.all():
                    if value and value.value and value.value.strip() and value.field:
                        values_dict[value.field.slug] = value.value
            except Exception as e:
                logger.warning(f"Erreur lors de l'accès aux valeurs de l'enregistrement {record.id}: {e}")
            
            # Chercher dans l'ordre de priorité des champs génériques
            for field_name in GENERIC_FIELD_NAMES:
                if field_name in values_dict:
                    return values_dict[field_name]
            
            # Chercher le premier champ texte non-système
            for slug, value in values_dict.items():
                if slug not in SYSTEM_FIELD_NAMES:
                    # Vérifier le type de champ si disponible
                    try:
                        for record_value in record.values.all():
                            if (record_value.field.slug == slug and 
                                record_value.field.field_type in [FieldTypes.TEXT, FieldTypes.LONG_TEXT]):
                                return value
                    except Exception:
                        # En cas d'erreur, retourner la valeur quand même
                        return value
            
            # En dernier recours, retourner l'ID
            return f"#{record.id}"
            
        except Exception as e:
            logger.error(f"Erreur lors de la génération de la valeur lisible pour l'enregistrement {record.id}: {e}")
            return f"[Erreur: #{record.id}]"
    
    def _format_value(self, value: str, field_type: str) -> Any:
        """
        Formater la valeur selon le type de champ avec gestion d'erreurs améliorée.
        ✅ OPTIMISATION: Gestion plus robuste des types
        """
        if not value:
            return value
        
        try:
            if field_type == FieldTypes.NUMBER:
                # Essayer d'abord int, puis float
                try:
                    if '.' not in str(value):
                        return int(value)
                    else:
                        return float(value)
                except ValueError:
                    logger.warning(f"Impossible de convertir '{value}' en nombre")
                    return value
                    
            elif field_type == FieldTypes.BOOLEAN:
                return str(value).lower() in ('true', '1', 'yes', 'oui', 't', 'y')
                
            elif field_type == FieldTypes.CHOICE:
                # Essayer de parser comme JSON pour les choix multiples
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
                    
        except (ValueError, TypeError, AttributeError) as e:
            logger.warning(f"Erreur de formatage pour le type {field_type} avec la valeur '{value}': {e}")
        
        return value

    class Meta:
        model = DynamicRecord
        fields = '__all__'

class ProjectPdfFileSerializer(serializers.ModelSerializer):
    """
    Serializer pour les fichiers PDF des projets.
    """
    uploaded_by_username = serializers.CharField(
        source='uploaded_by.username', 
        read_only=True
    )
    file_size_formatted = serializers.ReadOnlyField()
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ProjectPdfFile
        fields = [
            'id', 'original_filename', 'display_name', 'file', 'file_url',
            'file_size', 'file_size_formatted', 'description', 'uploaded_at',
            'uploaded_by', 'uploaded_by_username', 'order', 'project_record'
        ]
        read_only_fields = ['uploaded_at', 'uploaded_by', 'file_size']
        
    def get_file_url(self, obj):
        """Retourne l'URL du fichier"""
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def validate_file(self, value):
        """Validation du fichier PDF"""
        if not value:
            raise serializers.ValidationError("Aucun fichier fourni")
            
        # Vérifier l'extension
        if not value.name.lower().endswith('.pdf'):
            raise serializers.ValidationError("Seuls les fichiers PDF sont autorisés")
            
        # Vérifier la taille (limite: 50 MB)
        max_size = 50 * 1024 * 1024  # 50 MB
        if value.size > max_size:
            raise serializers.ValidationError(
                f"Fichier trop volumineux. Taille maximale: {max_size // (1024*1024)} MB"
            )
            
        return value
    
    def validate_display_name(self, value):
        """Validation du nom d'affichage"""
        if not value or not value.strip():
            raise serializers.ValidationError("Le nom d'affichage est requis")
        return value.strip()
    
    def create(self, validated_data):
        """Création avec gestion automatique de certains champs"""
        # Assigner l'utilisateur actuel
        validated_data['uploaded_by'] = self.context['request'].user
        
        # Extraire le nom original du fichier
        if 'file' in validated_data and not validated_data.get('original_filename'):
            validated_data['original_filename'] = validated_data['file'].name
            
        return super().create(validated_data)