# backend/database/serializers.py
from rest_framework import serializers
from .models import DynamicTable, DynamicField, DynamicRecord, DynamicValue
import json
from django.db import models

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
        # Valider que les options sont au format JSON valide pour les champs de type choix
        field_type = self.initial_data.get('field_type')
        
        if field_type == 'choice':
            if not value:
                raise serializers.ValidationError("Les options sont requises pour les champs de type choix.")
            try:
                if isinstance(value, str):
                    json.loads(value)
                elif not isinstance(value, (list, dict)):
                    raise serializers.ValidationError("Les options doivent être une liste ou un dictionnaire.")
            except json.JSONDecodeError:
                raise serializers.ValidationError("Le format JSON des options est invalide.")
        
        return value
    
    def validate(self, data):
        # Validation supplémentaire pour les champs avec des types spécifiques
        if data.get('field_type') == 'foreign_key' and not data.get('related_table'):
            raise serializers.ValidationError(
                {"related_table": "Une table liée est requise pour les champs de type clé étrangère."}
            )
        
        return data

class DynamicTableSerializer(serializers.ModelSerializer):
    class Meta:
        model = DynamicTable
        fields = '__all__'
    
    def to_representation(self, instance):
        """Ajouter les champs de la table dans la représentation."""
        data = super().to_representation(instance)
        if instance:
            data['fields'] = DynamicFieldSerializer(
                instance.fields.filter(is_active=True).order_by('order'), 
                many=True
            ).data
        else:
            data['fields'] = []
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

class DynamicRecordCreateSerializer(serializers.ModelSerializer):
    values = serializers.DictField(write_only=True)
    
    class Meta:
        model = DynamicRecord
        fields = ['table', 'values', 'created_by']
        read_only_fields = ['created_by']
    
    def create(self, validated_data):
        values_data = validated_data.pop('values', {})
        table = validated_data.get('table')
        
        # Créer l'enregistrement
        record = DynamicRecord.objects.create(
            **validated_data,
            created_by=self.context['request'].user
        )
        
        # Créer les valeurs
        for field_slug, value in values_data.items():
            try:
                field = table.fields.get(slug=field_slug)
                DynamicValue.objects.create(
                    record=record,
                    field=field,
                    value=str(value)
                )
            except DynamicField.DoesNotExist:
                continue  # Ignorer les champs inexistants
        
        return record
    
    def update(self, instance, validated_data):
        values_data = validated_data.pop('values', {})
        
        # Mettre à jour l'enregistrement
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Mettre à jour les valeurs
        for field_slug, value in values_data.items():
            try:
                field = instance.table.fields.get(slug=field_slug)
                dynamic_value, created = DynamicValue.objects.get_or_create(
                    record=instance,
                    field=field,
                    defaults={'value': str(value)}
                )
                if not created:
                    dynamic_value.value = str(value)
                    dynamic_value.save()
            except DynamicField.DoesNotExist:
                continue
        
        return instance

class FlatDynamicRecordSerializer(serializers.ModelSerializer):
    """
    Serializer qui retourne un enregistrement avec ses valeurs aplaties
    et les FK automatiquement résolues en valeurs lisibles
    """
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        
        # Ajouter les valeurs aplaties avec résolution FK améliorée
        for value in instance.values.all():
            field = value.field
            field_value = value.value
            
            # Si c'est une FK, essayer de résoudre en valeur lisible
            if field.field_type == 'foreign_key' and field.related_table and field_value:
                try:
                    # D'abord essayer de traiter field_value comme un ID numérique
                    try:
                        record_id = int(field_value)
                        related_record = DynamicRecord.objects.get(
                            id=record_id, 
                            table=field.related_table,
                            is_active=True
                        )
                        # ID trouvé, résoudre en valeur lisible
                        resolved_value = self._get_readable_value(related_record)
                        data[field.slug] = resolved_value
                        data[f"{field.slug}_id"] = field_value
                        print(f"🔗 FK résolue par ID: {field.slug} = '{resolved_value}' (ID: {field_value})")
                        
                    except (ValueError, DynamicRecord.DoesNotExist):
                        # Si ce n'est pas un ID valide, chercher par nom dans la table liée
                        print(f"🔍 Tentative de résolution par nom pour {field.slug}: '{field_value}'")
                        
                        # Chercher un enregistrement dont un champ texte correspond à field_value
                        related_records = DynamicRecord.objects.filter(
                            table=field.related_table,
                            is_active=True
                        )
                        
                        found_record = None
                        for record in related_records:
                            record_name = self._get_readable_value(record)
                            if record_name == field_value:
                                found_record = record
                                break
                        
                        if found_record:
                            # Nom trouvé, utiliser ce nom comme valeur lisible et garder la référence
                            data[field.slug] = field_value  # Garder le nom tel quel
                            data[f"{field.slug}_id"] = found_record.id
                            print(f"🔗 FK résolue par nom: {field.slug} = '{field_value}' (ID résolu: {found_record.id})")
                        else:
                            # Aucun enregistrement trouvé ni par ID ni par nom
                            data[field.slug] = f"[Référence manquante: {field_value}]"
                            data[f"{field.slug}_raw"] = field_value
                            print(f"⚠️ FK non résolue: {field.slug} = '{field_value}' (ni ID ni nom trouvé)")
                    
                except Exception as e:
                    # En cas d'erreur inattendue
                    data[field.slug] = f"[Erreur de résolution: {field_value}]"
                    data[f"{field.slug}_raw"] = field_value
                    print(f"❌ Erreur lors de la résolution FK: {field.slug} = '{field_value}' ({str(e)})")
            else:
                # Champ normal (non FK)
                data[field.slug] = field_value
        
        return data
    
    def _get_readable_value(self, record):
        """
        Trouve la valeur la plus lisible dans un enregistrement
        """
        # D'abord essayer les champs génériques (ajout de nom_projet)
        generic_fields = ['nom_projet', 'nom', 'name', 'label', 'title', 'titre', 'libelle', 'description', 'desc']
        
        for value in record.values.all():
            if value.field.slug in generic_fields and value.value:
                return value.value
        
        # Si pas de champ générique, prendre le premier champ texte non-système
        system_fields = ['id', 'custom_id', 'primary_identifier', 'created_at', 'updated_at']
        
        for value in record.values.all():
            if (value.field.slug not in system_fields and 
                value.field.field_type in ['text', 'long_text'] and 
                value.value and value.value.strip()):
                return value.value
        
        # En dernier recours, retourner l'ID
        return f"#{record.id}"

    class Meta:
        model = DynamicRecord
        fields = '__all__'