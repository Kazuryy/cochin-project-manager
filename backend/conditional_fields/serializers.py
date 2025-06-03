from rest_framework import serializers
from .models import ConditionalFieldRule, ConditionalFieldOption

class ConditionalFieldOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConditionalFieldOption
        fields = ['id', 'value', 'label', 'order']
        read_only_fields = ['id']

class ConditionalFieldRuleSerializer(serializers.ModelSerializer):
    options = ConditionalFieldOptionSerializer(many=True, read_only=True)
    parent_table_name = serializers.CharField(source='parent_table.name', read_only=True)
    parent_field_name = serializers.CharField(source='parent_field.name', read_only=True)
    
    class Meta:
        model = ConditionalFieldRule
        fields = [
            'id', 'parent_table', 'parent_table_name', 'parent_field', 'parent_field_name',
            'parent_value', 'conditional_field_name', 'conditional_field_label',
            'is_required', 'order', 'options'
        ]
        read_only_fields = ['id', 'parent_table_name', 'parent_field_name']

class AddOptionSerializer(serializers.Serializer):
    """
    Serializer pour ajouter une nouvelle option à un champ conditionnel
    """
    rule_id = serializers.IntegerField()
    value = serializers.CharField(max_length=255)
    label = serializers.CharField(max_length=255)
    
    def validate_rule_id(self, value):
        try:
            ConditionalFieldRule.objects.get(id=value)
        except ConditionalFieldRule.DoesNotExist:
            raise serializers.ValidationError("La règle conditionnelle n'existe pas")
        return value
    
    def validate(self, data):
        # Vérifier que l'option n'existe pas déjà
        rule = ConditionalFieldRule.objects.get(id=data['rule_id'])
        if rule.options.filter(value=data['value']).exists():
            raise serializers.ValidationError({
                'value': 'Cette option existe déjà pour ce champ conditionnel'
            })
        return data 