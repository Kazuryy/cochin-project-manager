# backend/database/views.py
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db import models
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.contrib.admin.views.decorators import staff_member_required
import json
import logging
import os
from django.conf import settings
import subprocess
from datetime import datetime

from .models import DynamicTable, DynamicField, DynamicRecord, DynamicValue
from .serializers import (
    DynamicTableSerializer,
    DynamicFieldSerializer,
    DynamicRecordSerializer,
    DynamicValueSerializer,
    DynamicRecordCreateSerializer,
    FlatDynamicRecordSerializer
)

logger = logging.getLogger(__name__)

# ============================================================================
# CONSTANTES POUR ÉVITER LA DUPLICATION DE MESSAGES
# ============================================================================

class ErrorMessages:
    """Constantes pour les messages d'erreur."""
    TABLE_ID_REQUIRED = "Le paramètre table_id est requis"
    FIELD_ORDERS_REQUIRED = "Le paramètre field_orders est requis"
    CUSTOM_ID_AND_TABLE_ID_REQUIRED = "Les paramètres table_id et custom_id sont requis"
    PROJECT_TABLE_NOT_FOUND = "Table Projet introuvable"

# ============================================================================
# UTILITAIRES POUR RÉDUIRE LA DUPLICATION DE CODE
# ============================================================================

class TableFinderMixin:
    """Mixin pour centraliser la logique de recherche de tables."""
    
    @staticmethod
    def find_table_by_patterns(patterns, description="table"):
        """
        Trouve une table en utilisant plusieurs patterns de recherche.
        
        Args:
            patterns (list): Liste de patterns de recherche
            description (str): Description pour les logs d'erreur
            
        Returns:
            DynamicTable or None: La table trouvée ou None
        """
        for pattern in patterns:
            if isinstance(pattern, dict):
                table = DynamicTable.objects.filter(**pattern).first()
            else:
                # Pattern string, recherche par nom
                table = DynamicTable.objects.filter(
                    models.Q(name__iexact=pattern) |
                    models.Q(slug__iexact=pattern.lower().replace(' ', '_'))
                ).first()
            
            if table:
                logger.debug(f"Table {description} trouvée: {table.name}")
                return table
        
        logger.warning(f"Aucune {description} trouvée avec les patterns: {patterns}")
        return None
    
    @classmethod
    def get_project_table(cls):
        """Trouve la table Projet."""
        patterns = ['Projet', 'Projets', 'projet', 'projets']
        return cls.find_table_by_patterns(patterns, "table Projet")
    
    @classmethod
    def get_table_names_table(cls):
        """Trouve la table TableNames."""
        patterns = [
            {'name__icontains': 'tablename'},
            {'name__icontains': 'table_name'},
            {'name__icontains': 'type'}
        ]
        return cls.find_table_by_patterns(patterns, "table TableNames")
    
    @classmethod
    def get_choix_table(cls):
        """Trouve la table Choix."""
        patterns = [
            {'name__icontains': 'choix'},
            {'name__icontains': 'choice'},
            {'name__icontains': 'options'}
        ]
        return cls.find_table_by_patterns(patterns, "table Choix")


class FieldValueManager:
    """Gestionnaire pour les opérations sur les champs et valeurs."""
    
    @staticmethod
    def find_field_by_name(table, field_name):
        """
        Trouve un champ dans une table par nom ou slug.
        
        Args:
            table (DynamicTable): La table à chercher
            field_name (str): Le nom du champ à chercher
            
        Returns:
            DynamicField or None: Le champ trouvé ou None
        """
        return table.fields.filter(
            models.Q(slug=field_name.lower().replace(' ', '_')) |
            models.Q(name__iexact=field_name.replace('_', ' '))
        ).first()
    
    @staticmethod
    def create_or_update_value(record, field, value):
        """
        Crée ou met à jour une valeur pour un enregistrement et un champ donnés.
        
        Args:
            record (DynamicRecord): L'enregistrement
            field (DynamicField): Le champ
            value: La valeur à stocker
            
        Returns:
            DynamicValue: La valeur créée ou mise à jour
        """
        if value is None:
            value = ""
        
        dynamic_value, created = DynamicValue.objects.get_or_create(
            record=record,
            field=field,
            defaults={'value': str(value)}
        )
        
        if not created and dynamic_value.value != str(value):
            dynamic_value.value = str(value)
            dynamic_value.save(update_fields=['value'])
        
        return dynamic_value
    
    @staticmethod
    def process_foreign_key_value(field, value):
        """
        Traite une valeur pour un champ clé étrangère.
        
        Args:
            field (DynamicField): Le champ FK
            value: La valeur à traiter
            
        Returns:
            str: La valeur finale à stocker
        """
        if not field.related_table or not value:
            return str(value) if value else ""
        
        # Si c'est déjà un ID numérique, le retourner
        try:
            int(value)
            return str(value)
        except (ValueError, TypeError):
            # Si c'est un label, essayer de convertir en ID
            # Pour l'instant, on retourne la valeur telle quelle
            return str(value)


# ============================================================================
# VIEWSETS PRINCIPAUX
# ============================================================================

class DynamicTableViewSet(viewsets.ModelViewSet, TableFinderMixin):
    """ViewSet pour gérer les tables dynamiques."""
    
    queryset = DynamicTable.objects.select_related('created_by').prefetch_related('fields')
    serializer_class = DynamicTableSerializer
    permission_classes = [permissions.IsAuthenticated]  # Permissions réactivées
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at', 'updated_at']
    
    def get_queryset(self):
        """Optimise les requêtes avec select_related et prefetch_related."""
        return self.queryset.filter(is_active=True)
    
    @action(detail=True, methods=['get'])
    def fields(self, request, pk=None):
        """Retourne tous les champs d'une table."""
        table = self.get_object()
        fields = table.fields.filter(is_active=True).order_by('order')
        serializer = DynamicFieldSerializer(fields, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def records(self, request, pk=None):
        """Retourne tous les enregistrements d'une table."""
        table = self.get_object()
        records = table.records.filter(is_active=True).select_related('created_by')
        serializer = FlatDynamicRecordSerializer(records, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_field(self, request, pk=None):
        """Ajoute un champ à la table."""
        table = self.get_object()
        serializer = DynamicFieldSerializer(data=request.data)
        
        if serializer.is_valid():
            try:
                field = serializer.save(table=table)
                logger.info(f"Champ '{field.name}' ajouté à la table '{table.name}' par {request.user}")
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"Erreur lors de l'ajout du champ: {e}")
                return Response(
                    {'error': f'Erreur lors de l\'ajout du champ: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        """Créer une nouvelle table avec ses champs."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            try:
                table = serializer.save(created_by=request.user)
                logger.info(f"Table '{table.name}' créée par {request.user}")
                return Response(
                    DynamicTableSerializer(table).data,
                    status=status.HTTP_201_CREATED
                )
            except Exception as e:
                logger.error(f"Erreur lors de la création de la table: {e}")
                return Response(
                    {'error': f'Erreur lors de la création de la table: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_details_table(self, request):
        """Créer une nouvelle table de détails avec des champs de base."""
        try:
            table_name = self._extract_table_name(request)
            
            if not table_name:
                return Response(
                    {'error': 'Le nom de la table est requis'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Vérifier si la table existe déjà
            if DynamicTable.objects.filter(name=table_name).exists():
                return Response(
                    {'error': f'La table "{table_name}" existe déjà'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            with transaction.atomic():
                table = self._create_basic_table(table_name, request.user)
                self._add_basic_fields(table)
                
                logger.info(f"Table de détails '{table_name}' créée par {request.user}")
                return Response({
                    'success': True,
                    'message': f'Table "{table_name}" créée avec succès',
                    'table': DynamicTableSerializer(table).data
                }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Erreur lors de la création de la table: {e}")
            return Response(
                {'error': f'Erreur lors de la création de la table: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _extract_table_name(self, request):
        """Extrait le nom de la table de la requête."""
        if hasattr(request, 'data'):
            return request.data.get('name')
        
        if request.content_type == 'application/json':
            data = json.loads(request.body.decode('utf-8'))
            return data.get('name')
        
        return request.POST.get('name')
    
    def _create_basic_table(self, table_name, user):
        """Crée une table de base."""
        return DynamicTable.objects.create(
            name=table_name,
            slug=table_name.lower().replace(' ', '_'),
            description=f'Table de détails pour {table_name}',
            created_by=user
        )
    
    def _add_basic_fields(self, table):
        """Ajoute les champs de base à une table."""
        basic_fields = [
            {'name': 'Nom', 'field_type': 'text', 'is_required': True, 'slug': 'nom'},
            {'name': 'Description', 'field_type': 'textarea', 'is_required': False, 'slug': 'description'},
            {'name': 'Statut', 'field_type': 'text', 'is_required': False, 'slug': 'statut'},
            {'name': 'Date création', 'field_type': 'date', 'is_required': False, 'slug': 'date_creation'},
        ]
        
        for field_data in basic_fields:
            DynamicField.objects.create(table=table, **field_data)

    @action(detail=False, methods=['post'])
    def create_new_type(self, request):
        """Créer un nouveau type : ajouter à TableNames et créer la table {Nom}Details."""
        try:
            type_name = self._validate_and_prepare_type_name(request.data.get('type_name'))
            columns = request.data.get('columns', [])
            
            project_manager = ProjectManager(request.user)
            
            with transaction.atomic():
                type_record = project_manager.create_type_record(type_name)
                details_table = project_manager.create_details_table(type_name, columns)
                
                logger.info(f"Type '{type_name}' créé par {request.user}")
                return Response({
                    'success': True,
                    'message': f'Type "{type_name}" créé avec succès',
                    'type_record': {
                        'id': type_record.id,
                        'type_name': type_name
                    },
                    'details_table': DynamicTableSerializer(details_table).data
                }, status=status.HTTP_201_CREATED)
                
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Erreur lors de la création du type: {e}")
            return Response(
                {'error': f'Erreur lors de la création du type: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _validate_and_prepare_type_name(self, type_name):
        """Valide et prépare le nom du type."""
        if not type_name:
            raise ValueError('Le nom du type est requis')
        
        type_name = type_name.strip()
        type_name = type_name[0].upper() + type_name[1:] if type_name else ''
        
        if not type_name:
            raise ValueError('Le nom du type est invalide')
        
        return type_name

    @action(detail=False, methods=['post'])
    def create_project_with_details(self, request):
        """Créer un nouveau projet avec ses détails de façon transactionnelle."""
        try:
            project_data = request.data.get('project_data', {})
            conditional_fields = request.data.get('conditional_fields', {})
            project_type_id = request.data.get('project_type_id')
            
            if not project_data.get('nom_projet'):
                return Response(
                    {'error': 'Le nom du projet est requis'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            project_manager = ProjectManager(request.user)
            project_record = project_manager.create_project_with_details(
                project_data, 
                conditional_fields, 
                project_type_id
            )
            
            logger.info(f"Projet '{project_data.get('nom_projet')}' créé par {request.user}")
            return Response({
                'success': True,
                'message': f'Projet "{project_data.get("nom_projet")}" créé avec succès',
                'project': {
                    'id': project_record.id,
                    'table_id': project_record.table.id
                }
            }, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Erreur lors de la création du projet: {e}", exc_info=True)
            return Response(
                {'error': f'Erreur lors de la création du projet: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['put'])
    def update_project_with_details(self, request):
        """
        Mettre à jour un projet avec ses détails de façon transactionnelle
        """
        try:
            project_id = request.data.get('project_id')
            project_data = request.data.get('project_data', {})
            conditional_fields = request.data.get('conditional_fields', {})
            project_type_id = request.data.get('project_type_id')
            
            if not project_id:
                return Response(
                    {'error': 'L\'ID du projet est requis'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not project_data.get('nom_projet'):
                return Response(
                    {'error': 'Le nom du projet est requis'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            project_manager = ProjectManager(request.user)
            
            # Récupérer le projet existant
            project_table = project_manager.get_project_table()
            if not project_table:
                return Response(
                    {'error': ErrorMessages.PROJECT_TABLE_NOT_FOUND},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                project_record = DynamicRecord.objects.get(
                    id=project_id,
                    table=project_table,
                    is_active=True
                )
            except DynamicRecord.DoesNotExist:
                return Response(
                    {'error': f'Projet avec ID {project_id} introuvable'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            with transaction.atomic():
                # Mettre à jour les données du projet
                project_manager._populate_project_data(
                    project_record, project_table, project_data, project_type_id
                )
                
                # Mettre à jour les détails si nécessaire
                if conditional_fields and project_type_id:
                    project_manager._update_project_details(
                        project_record, conditional_fields, project_type_id
                    )
                
                logger.info(f"Projet '{project_data.get('nom_projet')}' modifié par {request.user}")
                return Response({
                    'success': True,
                    'message': f'Projet "{project_data.get("nom_projet")}" modifié avec succès',
                    'project': {
                        'id': project_record.id,
                        'table_id': project_table.id
                    }
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            logger.error(f"Erreur lors de la modification du projet: {e}", exc_info=True)
            return Response(
                {'error': f'Erreur lors de la modification du projet: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class DynamicFieldViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les champs dynamiques."""
    
    queryset = DynamicField.objects.select_related('table', 'related_table')
    serializer_class = DynamicFieldSerializer
    permission_classes = [permissions.IsAuthenticated]  # Permissions réactivées
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['table', 'field_type', 'is_required', 'is_unique', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'order']

    def get_queryset(self):
        """Optimise les requêtes et filtre les champs actifs."""
        return self.queryset.filter(is_active=True)

    @action(detail=False, methods=['patch'])
    def reorder_fields(self, request):
        """Met à jour l'ordre de plusieurs champs d'une table."""
        field_orders = request.data.get('field_orders', [])
        table_id = request.data.get('table_id')
        
        if not field_orders:
            return Response(
                {"error": "Le paramètre field_orders est requis"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not table_id:
            return Response(
                {"error": ErrorMessages.TABLE_ID_REQUIRED},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            table = get_object_or_404(DynamicTable, id=table_id)
            
            with transaction.atomic():
                updated_fields = []
                for field_order in field_orders:
                    field_id = field_order.get('id')
                    order = field_order.get('order')
                    
                    if field_id is not None and order is not None:
                        try:
                            field = DynamicField.objects.select_for_update().get(
                                id=field_id, table=table
                            )
                            field.order = order
                            field.save(update_fields=['order'])
                            updated_fields.append(field)
                        except DynamicField.DoesNotExist:
                            logger.warning(f"Champ {field_id} non trouvé pour la table {table_id}")
                            continue
                
                logger.info(f"{len(updated_fields)} champs réorganisés pour la table {table.name}")
                serializer = DynamicFieldSerializer(updated_fields, many=True)
                return Response({
                    "success": True,
                    "message": f"{len(updated_fields)} champs réorganisés avec succès",
                    "fields": serializer.data
                })
                
        except Exception as e:
            logger.error(f"Erreur lors de la réorganisation des champs: {e}")
            return Response(
                {"error": f"Erreur lors de la réorganisation: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class DynamicRecordViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les enregistrements dynamiques."""
    
    queryset = DynamicRecord.objects.select_related('table', 'created_by').prefetch_related('values__field')
    serializer_class = DynamicRecordSerializer
    permission_classes = [permissions.IsAuthenticated]  # Permissions réactivées
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['table', 'is_active', 'created_by']
    ordering_fields = ['created_at', 'updated_at', 'custom_id']
    
    def get_queryset(self):
        """Optimise les requêtes et filtre les enregistrements actifs."""
        return self.queryset.filter(is_active=True)
    
    def get_serializer_class(self):
        """Utilise le serializer approprié selon l'action."""
        if self.action in ['list', 'retrieve']:
            return FlatDynamicRecordSerializer
        return super().get_serializer_class()
    
    @action(detail=False, methods=['get'])
    def by_custom_id(self, request):
        """Retourne un enregistrement par son custom_id et table_id."""
        table_id = request.query_params.get('table_id')
        custom_id = request.query_params.get('custom_id')
        
        if not table_id or not custom_id:
            return Response(
                {"error": "Les paramètres table_id et custom_id sont requis"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            table = get_object_or_404(DynamicTable, id=table_id)
            record = get_object_or_404(
                DynamicRecord.objects.select_related('table', 'created_by')
                                   .prefetch_related('values__field'),
                table=table, 
                custom_id=custom_id, 
                is_active=True
            )
            serializer = FlatDynamicRecordSerializer(record)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Erreur lors de la récupération de l'enregistrement: {e}")
            return Response(
                {"error": "Enregistrement non trouvé"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get'])
    def values(self, request, pk=None):
        """Retourne toutes les valeurs d'un enregistrement."""
        record = self.get_object()
        values = record.values.select_related('field').all()
        serializer = DynamicValueSerializer(values, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_table(self, request):
        """Retourne tous les enregistrements d'une table spécifique."""
        table_id = request.query_params.get('table_id')
        if not table_id:
            return Response(
                {"error": ErrorMessages.TABLE_ID_REQUIRED},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            table = get_object_or_404(DynamicTable, id=table_id)
            records = self.get_queryset().filter(table=table)
            
            # Appliquer les filtres dynamiques
            query_params = request.query_params.copy()
            for param, value in query_params.items():
                if param.startswith('field_'):
                    field_slug = param[6:]  # Enlever 'field_'
                    try:
                        field = get_object_or_404(DynamicField, table=table, slug=field_slug)
                        records = records.filter(values__field=field, values__value=value)
                    except Exception:
                        logger.warning(f"Champ {field_slug} non trouvé pour le filtrage")
                        continue
            
            page = self.paginate_queryset(records)
            if page is not None:
                serializer = FlatDynamicRecordSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
                
            serializer = FlatDynamicRecordSerializer(records, many=True)
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des enregistrements: {e}")
            return Response(
                {"error": f"Erreur lors de la récupération: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def create_with_values(self, request):
        """Crée un enregistrement avec ses valeurs en une seule requête."""
        table_id = request.data.get('table_id')
        if not table_id:
            return Response(
                {"error": ErrorMessages.TABLE_ID_REQUIRED},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            table = get_object_or_404(DynamicTable, id=table_id)
            
            # Préparer les données pour le serializer
            serializer_data = request.data.copy()
            serializer_data['table'] = table.id
            # Supprimer table_id pour éviter les conflits
            serializer_data.pop('table_id', None)
            
            serializer = DynamicRecordCreateSerializer(
                data=serializer_data,
                context={'request': request, 'table': table}
            )
            
            if serializer.is_valid():
                with transaction.atomic():
                    record = serializer.save()
                    logger.info(f"Enregistrement créé dans {table.name} par {request.user}")
                    return Response(
                        FlatDynamicRecordSerializer(record).data,
                        status=status.HTTP_201_CREATED
                    )
            else:
                logger.warning(f"Erreurs de validation: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Erreur lors de la création de l'enregistrement: {e}", exc_info=True)
            return Response(
                {"error": f"Erreur lors de la création: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['put', 'patch'])
    def update_with_values(self, request, pk=None):
        """Met à jour un enregistrement avec ses valeurs en une seule requête."""
        record = self.get_object()
        table = record.table
        
        serializer = DynamicRecordCreateSerializer(
            instance=record,
            data=request.data,
            context={'request': request, 'table': table},
            partial=request.method == 'PATCH'
        )
        
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    record = serializer.save()
                    logger.info(f"Enregistrement {record.id} modifié dans {table.name} par {request.user}")
                    return Response(FlatDynamicRecordSerializer(record).data)
            except Exception as e:
                logger.error(f"Erreur lors de la sauvegarde: {e}", exc_info=True)
                return Response(
                    {"error": f"Erreur lors de la sauvegarde: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            logger.warning(f"Erreurs de validation: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DynamicValueViewSet(viewsets.ModelViewSet):
    """ViewSet pour gérer les valeurs dynamiques."""
    
    queryset = DynamicValue.objects.select_related('record__table', 'field')
    serializer_class = DynamicValueSerializer
    permission_classes = [permissions.IsAuthenticated]  # Permissions réactivées
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['record', 'field']

# ============================================================================
# FONCTIONS DE MAINTENANCE ET LOGS (OPTIMISÉES)
# ============================================================================

class MaintenanceManager:
    """Gestionnaire pour les opérations de maintenance."""
    
    @staticmethod
    def clean_orphaned_foreign_keys():
        """Nettoie les clés étrangères orphelines."""
        orphaned_count = 0
        
        fk_values = DynamicValue.objects.filter(
            field__field_type='foreign_key'
        ).select_related('field__related_table')
        
        for value in fk_values:
            if value.field.related_table and value.value:
                try:
                    # Vérifier si l'enregistrement référencé existe
                    DynamicRecord.objects.get(
                        id=int(value.value),
                        table=value.field.related_table,
                        is_active=True
                    )
                except (DynamicRecord.DoesNotExist, ValueError, TypeError):
                    # FK orpheline, supprimer la valeur
                    value.delete()
                    orphaned_count += 1
        
        return orphaned_count
    
    @staticmethod
    def clean_deleted_references():
        """Nettoie les références vers des enregistrements supprimés."""
        deleted_references = 0
        
        # Supprimer les valeurs des enregistrements inactifs
        inactive_records = DynamicRecord.objects.filter(is_active=False)
        for record in inactive_records:
            values_deleted = record.values.all().delete()[0]
            deleted_references += values_deleted
        
        # Supprimer les enregistrements inactifs
        inactive_records.delete()
        
        return deleted_references
    
    @staticmethod
    def verify_tables():
        """Vérifie l'intégrité des tables actives."""
        return DynamicTable.objects.filter(is_active=True).count()


@require_http_methods(["POST"])
@login_required
@staff_member_required
def maintenance_view(request):
    """Endpoint pour effectuer la maintenance de la base de données."""
    try:
        data = json.loads(request.body.decode('utf-8'))
        maintenance_type = data.get('type', 'light')
        
        result = {
            'success': True,
            'type': maintenance_type,
            'orphaned_fk_cleaned': 0,
            'deleted_references_cleaned': 0,
            'tables_resequenced': 0
        }
        
        maintenance_manager = MaintenanceManager()
        
        if maintenance_type == 'light':
            logger.info("Début de la maintenance légère")
            result['orphaned_fk_cleaned'] = maintenance_manager.clean_orphaned_foreign_keys()
            logger.info(f"Maintenance légère terminée : {result['orphaned_fk_cleaned']} FK orphelines nettoyées")
            
        elif maintenance_type == 'full':
            logger.info("Début de la maintenance complète")
            
            with transaction.atomic():
                # Étape 1: Nettoyer les FK orphelines
                result['orphaned_fk_cleaned'] = maintenance_manager.clean_orphaned_foreign_keys()
                
                # Étape 2: Nettoyer les références supprimées
                result['deleted_references_cleaned'] = maintenance_manager.clean_deleted_references()
                
                # Étape 3: Vérifier les tables
                result['tables_resequenced'] = maintenance_manager.verify_tables()
            
            logger.info(f"Maintenance complète terminée : "
                       f"{result['orphaned_fk_cleaned']} FK orphelines, "
                       f"{result['deleted_references_cleaned']} références supprimées, "
                       f"{result['tables_resequenced']} tables vérifiées")
        
        return JsonResponse(result)
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'error': 'Données JSON invalides'
        }, status=400)
    except Exception as e:
        logger.error(f"Erreur lors de la maintenance: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': f'Erreur lors de la maintenance: {str(e)}'
        }, status=500)


class LogManager:
    """Gestionnaire pour les logs du système."""
    
    @staticmethod
    def get_log_file_path(log_type):
        """Retourne le chemin du fichier de log selon le type."""
        log_files = {
            'security': os.path.join(settings.BASE_DIR, 'logs', 'security.log'),
            'app': os.path.join(settings.BASE_DIR, 'logs', 'app.log')
        }
        return log_files.get(log_type, log_files['app'])
    
    @staticmethod
    def read_log_lines(log_file, lines):
        """Lit les dernières lignes d'un fichier de log."""
        try:
            # Utiliser tail pour obtenir les dernières lignes efficacement
            result = subprocess.run(
                ['tail', '-n', str(lines), log_file], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode == 0:
                return result.stdout.strip().split('\n') if result.stdout.strip() else []
            else:
                # Fallback: lire le fichier directement
                with open(log_file, 'r', encoding='utf-8') as f:
                    all_lines = f.readlines()
                    return [line.strip() for line in all_lines[-lines:]]
        
        except subprocess.TimeoutExpired:
            # Fallback en cas de timeout
            with open(log_file, 'r', encoding='utf-8') as f:
                all_lines = f.readlines()
                return [line.strip() for line in all_lines[-lines:]]
    
    @staticmethod
    def get_file_info(log_file):
        """Retourne les informations sur un fichier de log."""
        file_stats = os.stat(log_file)
        return {
            'path': log_file,
            'size': file_stats.st_size,
            'size_mb': round(file_stats.st_size / (1024 * 1024), 2),
            'modified': datetime.fromtimestamp(file_stats.st_mtime).isoformat()
        }


@require_http_methods(["GET"])
@login_required
@staff_member_required
def get_logs(request):
    """Endpoint pour récupérer les logs du système."""
    try:
        log_type = request.GET.get('type', 'app')
        lines = int(request.GET.get('lines', 100))
        
        log_manager = LogManager()
        log_file = log_manager.get_log_file_path(log_type)
        
        # Vérifier que le fichier existe
        if not os.path.exists(log_file):
            return JsonResponse({
                'success': False,
                'error': f'Fichier de log non trouvé: {log_file}'
            }, status=404)
        
        # Lire les logs
        log_lines = log_manager.read_log_lines(log_file, lines)
        file_info = log_manager.get_file_info(log_file)
        file_info['lines_returned'] = len(log_lines)
        
        return JsonResponse({
            'success': True,
            'logs': log_lines,
            'file_info': file_info
        })
        
    except PermissionError:
        return JsonResponse({
            'success': False,
            'error': 'Permission refusée pour lire le fichier de log'
        }, status=403)
    except Exception as e:
        logger.error(f"Erreur lors de la lecture des logs: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': f'Erreur lors de la lecture des logs: {str(e)}'
        }, status=500)

class ProjectManager(TableFinderMixin):
    """Gestionnaire pour les opérations sur les projets."""
    
    def __init__(self, user):
        self.user = user
        self.field_manager = FieldValueManager()
    
    def create_type_record(self, type_name):
        """Crée un enregistrement dans la table TableNames."""
        table_names_table = self.get_table_names_table()
        if not table_names_table:
            raise ValueError('Table TableNames introuvable')
        
        type_record = DynamicRecord.objects.create(
            table=table_names_table,
            created_by=self.user
        )
        
        # Ajouter le nom du type
        nom_field = self.field_manager.find_field_by_name(table_names_table, 'nom')
        if nom_field:
            self.field_manager.create_or_update_value(type_record, nom_field, type_name)
        
        # Ajouter la description
        description_field = self.field_manager.find_field_by_name(table_names_table, 'description')
        if description_field:
            self.field_manager.create_or_update_value(
                type_record, 
                description_field, 
                f'Type {type_name} créé automatiquement'
            )
        
        return type_record
    
    def create_details_table(self, type_name, columns):
        """Crée une table de détails pour un type donné."""
        details_table_name = f"{type_name}Details"
        
        if DynamicTable.objects.filter(name=details_table_name).exists():
            raise ValueError(f'La table "{details_table_name}" existe déjà')
        
        details_table = DynamicTable.objects.create(
            name=details_table_name,
            slug=details_table_name.lower().replace(' ', '_'),
            description=f'Table de détails pour le type {type_name}',
            created_by=self.user
        )
        
        # Créer les colonnes
        self._create_table_columns(details_table, columns)
        
        return details_table
    
    def _create_table_columns(self, table, columns):
        """Crée les colonnes d'une table."""
        choix_table = self.get_choix_table()
        
        for i, column in enumerate(columns):
            column_name = column.get('name', '').strip()
            if not column_name:
                continue
            
            field_data = self._prepare_field_data(column, i)
            
            # Gestion des champs de choix
            if column.get('is_choice_field') and choix_table:
                self._setup_choice_field(field_data, column, choix_table)
            
            # Gestion des clés étrangères
            elif column.get('is_foreign_key'):
                self._setup_foreign_key_field(field_data, column)
            
            DynamicField.objects.create(table=table, **field_data)
    
    def _prepare_field_data(self, column, index):
        """Prépare les données de base pour un champ."""
        column_name = column.get('name', '').strip()
        return {
            'name': column_name,
            'slug': column_name.lower().replace(' ', '_'),
            'field_type': column.get('type', 'text'),
            'is_required': column.get('is_required', False),
            'order': index + 1
        }
    
    def _setup_choice_field(self, field_data, column, choix_table):
        """Configure un champ de choix."""
        choice_column_name = column.get('choice_column_name', '')
        if not choice_column_name:
            return
        
        field_data['field_type'] = 'foreign_key'
        field_data['related_table'] = choix_table
        
        # Créer la colonne dans Choix si elle n'existe pas
        choice_field = self.field_manager.find_field_by_name(choix_table, choice_column_name)
        if not choice_field:
            DynamicField.objects.create(
                table=choix_table,
                name=choice_column_name,
                slug=choice_column_name.lower().replace(' ', '_'),
                field_type='text',
                is_required=False,
                order=choix_table.fields.count() + 1
            )
    
    def _setup_foreign_key_field(self, field_data, column):
        """Configure un champ clé étrangère."""
        foreign_table_id = column.get('foreign_table_id')
        if not foreign_table_id:
            return
        
        try:
            foreign_table = DynamicTable.objects.get(id=foreign_table_id)
            field_data['field_type'] = 'foreign_key'
            field_data['related_table'] = foreign_table
            
            # Ajouter le champ de référence si spécifié
            foreign_reference_field = column.get('foreign_reference_field', 'id')
            if foreign_reference_field != 'id':
                reference_field = self.field_manager.find_field_by_name(
                    foreign_table, 
                    foreign_reference_field
                )
                if reference_field:
                    field_data['related_field'] = reference_field
                    
        except DynamicTable.DoesNotExist:
            logger.warning(f"Table FK {foreign_table_id} non trouvée")
    
    def create_project_with_details(self, project_data, conditional_fields, project_type_id):
        """Crée un projet complet avec ses détails."""
        project_table = self.get_project_table()
        if not project_table:
            raise ValueError(ErrorMessages.PROJECT_TABLE_NOT_FOUND)
        
        with transaction.atomic():
            # Créer l'enregistrement projet
            project_record = DynamicRecord.objects.create(
                table=project_table,
                created_by=self.user
            )
            
            # Remplir les données du projet
            self._populate_project_data(project_record, project_table, project_data, project_type_id)
            
            # Créer les détails si nécessaire
            if conditional_fields and project_type_id:
                self._create_project_details(project_record, conditional_fields, project_type_id)
            
            return project_record
    
    def _populate_project_data(self, project_record, project_table, project_data, project_type_id):
        """Remplit les données du projet principal."""
        processed_fields = set()
        
        # Traiter tous les champs sauf type_projet
        for field_name, field_value in project_data.items():
            if field_value and field_name != 'type_projet':
                field = self.field_manager.find_field_by_name(project_table, field_name)
                if field and field.id not in processed_fields:
                    self.field_manager.create_or_update_value(project_record, field, field_value)
                    processed_fields.add(field.id)
        
        # Traiter séparément le type de projet
        if project_type_id:
            self._set_project_type(project_record, project_table, project_type_id, processed_fields)
    
    def _set_project_type(self, project_record, project_table, project_type_id, processed_fields):
        """Configure le type de projet."""
        type_field = project_table.fields.filter(
            models.Q(slug='type_projet') |
            models.Q(name__iexact='type projet') |
            models.Q(name__iexact='type')
        ).first()
        
        if type_field and type_field.id not in processed_fields:
            if type_field.field_type == 'foreign_key':
                # Champ FK : stocker l'ID
                value = str(project_type_id)
            else:
                # Champ texte : récupérer le nom du type
                value = self._get_type_name_by_id(project_type_id) or str(project_type_id)
            
            self.field_manager.create_or_update_value(project_record, type_field, value)
            processed_fields.add(type_field.id)
    
    def _get_type_name_by_id(self, type_id):
        """Récupère le nom d'un type par son ID."""
        table_names_table = self.get_table_names_table()
        if not table_names_table:
            return None
        
        try:
            type_record = DynamicRecord.objects.get(
                table=table_names_table,
                id=type_id,
                is_active=True
            )
            
            type_name_field = self.field_manager.find_field_by_name(table_names_table, 'nom')
            if type_name_field:
                type_name_value = type_record.values.filter(field=type_name_field).first()
                return type_name_value.value if type_name_value else None
                
        except DynamicRecord.DoesNotExist:
            pass
        
        return None
    
    def _create_project_details(self, project_record, conditional_fields, project_type_id):
        """Crée l'enregistrement de détails du projet."""
        type_name = self._get_type_name_by_id(project_type_id)
        if not type_name:
            return
        
        details_table_name = f"{type_name}Details"
        details_table = DynamicTable.objects.filter(name=details_table_name).first()
        
        if not details_table:
            return
        
        # Créer l'enregistrement Details
        details_record = DynamicRecord.objects.create(
            table=details_table,
            created_by=self.user
        )
        
        # Lier au projet
        self._link_details_to_project(details_record, details_table, project_record)
        
        # Remplir les champs conditionnels
        self._populate_conditional_fields(details_record, details_table, conditional_fields)
    
    def _link_details_to_project(self, details_record, details_table, project_record):
        """Lie l'enregistrement Details au projet."""
        project_table = project_record.table
        
        # Chercher un champ FK existant vers la table Projet
        project_fk_field = details_table.fields.filter(
            field_type='foreign_key',
            related_table=project_table
        ).first()
        
        # Si aucun champ FK n'existe, le créer
        if not project_fk_field:
            project_fk_field = DynamicField.objects.create(
                table=details_table,
                name='Projet (Auto)',
                slug='projet_auto',
                field_type='foreign_key',
                related_table=project_table,
                is_required=False,
                is_searchable=False,
                order=9999
            )
        
        # Créer la liaison
        self.field_manager.create_or_update_value(
            details_record, 
            project_fk_field, 
            project_record.id
        )
    
    def _populate_conditional_fields(self, details_record, details_table, conditional_fields):
        """Remplit les champs conditionnels."""
        for field_name, field_value in conditional_fields.items():
            # Ignorer les champs liés au projet
            if 'projet' in field_name.lower() or 'project' in field_name.lower():
                continue
            
            field = self.field_manager.find_field_by_name(details_table, field_name)
            if field:
                # Éviter de modifier le champ FK vers Projet
                if (field.field_type == 'foreign_key' and 
                    field.related_table == details_record.table):
                    continue
                
                # Traiter la valeur pour les FK
                if field.field_type == 'foreign_key':
                    final_value = self.field_manager.process_foreign_key_value(field, field_value)
                else:
                    final_value = field_value
                
                self.field_manager.create_or_update_value(details_record, field, final_value)
    
    def _update_project_details(self, project_record, conditional_fields, project_type_id):
        """Met à jour l'enregistrement de détails du projet."""
        type_name = self._get_type_name_by_id(project_type_id)
        if not type_name:
            return
        
        details_table_name = f"{type_name}Details"
        details_table = DynamicTable.objects.filter(name=details_table_name).first()
        
        if not details_table:
            return
        
        # Chercher l'enregistrement Details existant
        details_record = DynamicRecord.objects.filter(
            table=details_table,
            is_active=True
        ).filter(
            models.Q(
                values__field__slug__in=['id_projet_id', 'projet_id', 'projet_auto'],
                values__value=str(project_record.id)
            )
        ).first()
        
        # Si pas d'enregistrement Details, le créer
        if not details_record:
            details_record = DynamicRecord.objects.create(
                table=details_table,
                created_by=self.user
            )
            
            # Lier au projet
            self._link_details_to_project(details_record, details_table, project_record)
        
        # Mettre à jour les champs conditionnels
        self._populate_conditional_fields(details_record, details_table, conditional_fields)