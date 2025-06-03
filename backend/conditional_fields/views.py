from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import ConditionalFieldRule, ConditionalFieldOption
from .serializers import (
    ConditionalFieldRuleSerializer,
    ConditionalFieldOptionSerializer,
    AddOptionSerializer
)
from django.db import transaction
from database.models import DynamicTable, DynamicRecord
from django.http import JsonResponse
import json

# Create your views here.

class ConditionalFieldRuleViewSet(viewsets.ModelViewSet):
    """
    API pour récupérer les règles de champs conditionnels
    """
    queryset = ConditionalFieldRule.objects.all()
    serializer_class = ConditionalFieldRuleSerializer
    permission_classes = []  # Permissions supprimées temporairement
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['parent_table', 'parent_field', 'parent_value']
    
    @action(detail=False, methods=['get'])
    def by_field_and_value(self, request):
        """
        Récupère les règles conditionnelles pour un champ et une valeur donnés
        """
        parent_field_id = request.query_params.get('parent_field_id')
        parent_value = request.query_params.get('parent_value')
        
        if not parent_field_id or not parent_value:
            return Response(
                {'error': 'parent_field_id et parent_value sont requis'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Trouver les règles correspondantes
            rules = ConditionalFieldRule.objects.filter(
                parent_field_id=parent_field_id,
                parent_value__iexact=parent_value
            )
            
            result = []
            for rule in rules:
                rule_data = {
                    'id': rule.id,
                    'conditional_field_name': rule.conditional_field_name,
                    'conditional_field_label': rule.conditional_field_label,
                    'is_required': rule.is_required,
                    'options': []
                }
                
                # Si la règle a une source_table et source_field, charger depuis la table
                if rule.source_table and rule.source_field:
                    try:
                        # Récupérer TOUTES les valeurs non vides de cette colonne
                        from database.models import DynamicValue
                        field_values = DynamicValue.objects.filter(
                            field=rule.source_field,
                            value__isnull=False,
                            value__gt=''  # Valeurs non vides
                        ).exclude(value='').values_list('value', flat=True).distinct()
                        
                        for field_value in field_values:
                            rule_data['options'].append({
                                'value': field_value,
                                'label': field_value
                            })
                                
                    except Exception as e:
                        print(f"Erreur lors du chargement depuis la table source: {e}")
                        # Fallback vers les options statiques
                        pass
                
                # Si pas d'options depuis la table source, utiliser les options statiques
                if not rule_data['options']:
                    for option in rule.options.all():
                        rule_data['options'].append({
                            'value': option.value,
                            'label': option.label
                        })
                
                result.append(rule_data)
            
            return Response(result)
            
        except Exception as e:
            return Response(
                {'error': f'Erreur lors de la récupération des règles: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ConditionalFieldOptionViewSet(viewsets.ModelViewSet):
    """
    API pour gérer les options des champs conditionnels
    """
    queryset = ConditionalFieldOption.objects.all()
    serializer_class = ConditionalFieldOptionSerializer
    permission_classes = []  # Permissions supprimées temporairement
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['conditional_rule']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user if hasattr(self.request, 'user') and self.request.user.is_authenticated else None)
    
    def create(self, request, *args, **kwargs):
        """
        Ajouter une nouvelle option - méthode POST standard
        """
        # Si c'est une requête avec rule_id, c'est notre action spéciale
        if 'rule_id' in request.data:
            return self.add_option_to_choix_table(request)
        
        # Sinon, comportement normal du viewset
        return super().create(request, *args, **kwargs)
    
    def add_option_to_choix_table(self, request):
        """
        Ajouter une option directement dans la table Choix
        """
        try:
            with transaction.atomic():
                rule_id = request.data.get('rule_id')
                value = request.data.get('value')
                label = request.data.get('label')
                
                if not all([rule_id, value, label]):
                    return Response(
                        {'error': 'rule_id, value et label sont requis'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Vérifier que la règle existe
                try:
                    rule = ConditionalFieldRule.objects.get(id=rule_id)
                except ConditionalFieldRule.DoesNotExist:
                    return Response(
                        {'error': 'Règle non trouvée'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
                
                # Si la règle utilise une table source, ajouter directement dans cette table
                if rule.source_table and rule.source_field:
                    try:
                        # Créer un nouvel enregistrement dans la table source
                        new_record = DynamicRecord.objects.create(
                            table=rule.source_table,
                            created_by=request.user if hasattr(request, 'user') and request.user.is_authenticated else None
                        )
                        
                        # Ajouter la valeur au champ source
                        from database.models import DynamicValue
                        DynamicValue.objects.create(
                            record=new_record,
                            field=rule.source_field,
                            value=value
                        )
                        
                        return Response({
                            'success': True,
                            'message': f'Option "{label}" ajoutée à la table {rule.source_table.name}',
                            'option': {
                                'value': value,
                                'label': label
                            }
                        })
                        
                    except Exception as e:
                        return Response(
                            {'error': f'Erreur lors de l\'ajout dans la table source: {str(e)}'}, 
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR
                        )
                
                # Sinon, créer une option statique
                option, created = ConditionalFieldOption.objects.get_or_create(
                    conditional_rule=rule,
                    value=value,
                    defaults={
                        'label': label,
                        'created_by': request.user if hasattr(request, 'user') and request.user.is_authenticated else None
                    }
                )
                
                if not created:
                    return Response(
                        {'error': 'Cette option existe déjà'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                return Response({
                    'success': True,
                    'option': {
                        'id': option.id,
                        'value': option.value,
                        'label': option.label
                    }
                })
                
        except Exception as e:
            return Response(
                {'error': f'Erreur inattendue: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@csrf_exempt
def add_option_simple(request):
    """
    Vue simple pour ajouter une option dans la table Choix
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Méthode non autorisée'}, status=405)
    
    try:
        # Parser les données JSON
        data = json.loads(request.body)
        rule_id = data.get('rule_id')
        value = data.get('value')
        label = data.get('label')
        
        if not all([rule_id, value, label]):
            return JsonResponse({
                'error': 'rule_id, value et label sont requis'
            }, status=400)
        
        # Récupérer la règle
        try:
            rule = ConditionalFieldRule.objects.get(id=rule_id)
        except ConditionalFieldRule.DoesNotExist:
            return JsonResponse({'error': 'Règle non trouvée'}, status=404)
        
        # Vérifier que la règle a bien une source (table Choix)
        if not rule.source_table or not rule.source_field:
            return JsonResponse({
                'error': 'Cette règle n\'est pas liée à une table source'
            }, status=400)
        
        # Vérifier que l'option n'existe pas déjà
        from database.models import DynamicValue
        existing = DynamicValue.objects.filter(
            field=rule.source_field,
            value=value
        ).exists()
        
        if existing:
            return JsonResponse({
                'error': f'L\'option "{value}" existe déjà'
            }, status=400)
        
        # Créer un nouvel enregistrement dans la table Choix
        new_record = DynamicRecord.objects.create(
            table=rule.source_table
        )
        
        # Ajouter la valeur dans la bonne colonne
        DynamicValue.objects.create(
            record=new_record,
            field=rule.source_field,
            value=value
        )
        
        return JsonResponse({
            'success': True,
            'message': f'Option "{value}" ajoutée avec succès dans la table {rule.source_table.name}',
            'option': {
                'value': value,
                'label': label
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON invalide'}, status=400)
    except Exception as e:
        return JsonResponse({
            'error': f'Erreur: {str(e)}'
        }, status=500)
