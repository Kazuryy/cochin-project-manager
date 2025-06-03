# backend/database/serializers.py
from rest_framework import serializers
from .models import DynamicTable, DynamicField, DynamicRecord, DynamicValue
import json

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
    fields = DynamicFieldSerializer(many=True, read_only=True)
    
    class Meta:
        model = DynamicTable
        fields = ['id', 'name', 'slug', 'description', 'created_at', 'updated_at', 'created_by', 'is_active', 'fields']
        read_only_fields = ['id', 'created_at', 'updated_at', 'fields']
    
    def create(self, validated_data):
        # Définir l'utilisateur qui crée la table
        user = self.context['request'].user
        validated_data['created_by'] = user
        
        return super().create(validated_data)

class DynamicValueSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)
    field_type = serializers.CharField(source='field.field_type', read_only=True)
    field_slug = serializers.CharField(source='field.slug', read_only=True)
    
    class Meta:
        model = DynamicValue
        fields = ['id', 'field', 'field_name', 'field_slug', 'field_type', 'value']
        read_only_fields = ['id', 'field_name', 'field_type', 'field_slug']

class DynamicRecordSerializer(serializers.ModelSerializer):
    values = DynamicValueSerializer(many=True, read_only=True)
    table_name = serializers.CharField(source='table.name', read_only=True)
    custom_id_field_name = serializers.CharField(source='get_custom_id_field_name', read_only=True)
    primary_identifier = serializers.IntegerField(source='get_primary_identifier', read_only=True)
    
    class Meta:
        model = DynamicRecord
        fields = [
            'id', 'custom_id', 'primary_identifier', 'custom_id_field_name',
            'table', 'table_name', 'created_at', 'updated_at',
            'created_by', 'updated_by', 'is_active', 'values'
        ]
        read_only_fields = ['id', 'custom_id', 'primary_identifier', 'custom_id_field_name', 
                           'created_at', 'updated_at', 'values', 'table_name']
    
    def create(self, validated_data):
        # Définir l'utilisateur qui crée l'enregistrement
        user = self.context['request'].user
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Mettre à jour l'utilisateur qui modifie l'enregistrement
        user = self.context['request'].user
        validated_data['updated_by'] = user
        
        return super().update(instance, validated_data)

class DynamicRecordCreateSerializer(serializers.Serializer):
    """
    Sérialiseur pour créer ou mettre à jour un enregistrement complet avec ses valeurs.
    """
    values = serializers.DictField(
        child=serializers.CharField(allow_null=True, allow_blank=True),
        required=True
    )
    
    def _validate_required_fields(self, table, values):
        required_fields = table.fields.filter(is_required=True, is_active=True)
        for field in required_fields:
            if field.slug not in values or values[field.slug] == '':
                raise serializers.ValidationError(f"Le champ '{field.name}' est obligatoire")

    def _validate_field_existence(self, table, values):
        for field_slug in values.keys():
            if not table.fields.filter(slug=field_slug, is_active=True).exists():
                raise serializers.ValidationError(f"Le champ '{field_slug}' n'existe pas dans cette table")

    def _validate_unique_fields(self, table, values):
        unique_fields = table.fields.filter(is_unique=True, is_active=True)
        for field in unique_fields:
            if field.slug in values and values[field.slug]:
                existing_records = DynamicRecord.objects.filter(
                    table=table,
                    is_active=True,
                    values__field=field,
                    values__value=values[field.slug]
                )
                
                if self.instance:
                    existing_records = existing_records.exclude(id=self.instance.id)
                
                if existing_records.exists():
                    raise serializers.ValidationError(
                        f"Un enregistrement avec la valeur '{values[field.slug]}' "
                        f"pour le champ '{field.name}' existe déjà"
                    )

    def validate(self, data):
        table = self.context.get('table')
        
        if not table:
            raise serializers.ValidationError("Table non spécifiée")
        
        self._validate_required_fields(table, data['values'])
        self._validate_field_existence(table, data['values'])
        self._validate_unique_fields(table, data['values'])
        
        return data
    
    def create(self, validated_data):
        table = self.context.get('table')
        user = self.context['request'].user
        
        record = DynamicRecord.objects.create(
            table=table,
            created_by=user,
            updated_by=user
        )
        
        for field_slug, value in validated_data['values'].items():
            try:
                field = table.fields.get(slug=field_slug, is_active=True)
                if value is not None:  # Ne pas créer de valeur pour les champs vides/null
                    DynamicValue.objects.create(
                        record=record,
                        field=field,
                        value=value
                    )
            except DynamicField.DoesNotExist:
                # Ignorer les champs qui n'existent pas (ils ont déjà été vérifiés dans validate)
                pass
        
        return record
    
    def update(self, instance, validated_data):
        table = instance.table
        user = self.context['request'].user
        
        # Mettre à jour les métadonnées de l'enregistrement
        instance.updated_by = user
        instance.save()
        
        # Mettre à jour les valeurs
        for field_slug, value in validated_data['values'].items():
            try:
                field = table.fields.get(slug=field_slug, is_active=True)
                
                # Obtenir ou créer la valeur
                value_obj, created = DynamicValue.objects.get_or_create(
                    record=instance,
                    field=field,
                    defaults={'value': value if value is not None else ''}
                )
                
                # Mettre à jour la valeur si elle existe déjà
                if not created and value is not None:
                    value_obj.value = value
                    value_obj.save()
                elif not created and value is None:
                    # Supprimer la valeur si la nouvelle valeur est None
                    value_obj.delete()
                
            except DynamicField.DoesNotExist:
                # Ignorer les champs qui n'existent pas
                pass
        
        return instance

class FlatDynamicRecordSerializer(serializers.ModelSerializer):
    """
    Sérialiseur qui présente un enregistrement de manière aplatie, 
    avec les valeurs directement accessibles par leur clé de champ.
    """
    id = serializers.IntegerField(read_only=True)
    custom_id = serializers.IntegerField(read_only=True)
    primary_identifier = serializers.IntegerField(source='get_primary_identifier', read_only=True)
    custom_id_field_name = serializers.CharField(source='get_custom_id_field_name', read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    
    class Meta:
        model = DynamicRecord
        fields = ['id', 'custom_id', 'primary_identifier', 'custom_id_field_name', 'created_at', 'updated_at']
    
    def to_representation(self, instance):
        # Commencer avec les champs de base
        ret = super().to_representation(instance)
        
        # Ajouter le custom_id avec son nom de champ spécifique à la table
        if instance.custom_id:
            custom_field_name = instance.get_custom_id_field_name()
            ret[custom_field_name] = instance.custom_id
        
        # Ajouter toutes les valeurs des champs dynamiques
        values = instance.values.select_related('field').all()
        
        for value in values:
            if value.field.is_active:
                ret[value.field.slug] = value.get_formatted_value()
        
        return ret