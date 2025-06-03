# backend/database/views.py
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from .models import DynamicTable, DynamicField, DynamicRecord, DynamicValue
from .serializers import (
    DynamicTableSerializer,
    DynamicFieldSerializer,
    DynamicRecordSerializer,
    DynamicValueSerializer,
    DynamicRecordCreateSerializer,
    FlatDynamicRecordSerializer
)

class DynamicTableViewSet(viewsets.ModelViewSet):
    queryset = DynamicTable.objects.all()
    serializer_class = DynamicTableSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at', 'updated_at']
    
    @action(detail=True, methods=['get'])
    def fields(self, request, pk=None):
        """
        Retourne tous les champs d'une table
        """
        table = self.get_object()
        fields = table.fields.filter(is_active=True).order_by('order')
        serializer = DynamicFieldSerializer(fields, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def records(self, request, pk=None):
        """
        Retourne tous les enregistrements d'une table
        """
        table = self.get_object()
        records = table.records.filter(is_active=True)
        serializer = FlatDynamicRecordSerializer(records, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_field(self, request, pk=None):
        """
        Ajoute un champ à la table
        """
        table = self.get_object()
        serializer = DynamicFieldSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save(table=table)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def create(self, request, *args, **kwargs):
        """
        Créer une nouvelle table avec ses champs
        """
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            table = serializer.save(created_by=request.user)
            return Response(
                DynamicTableSerializer(table).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def create_details_table(self, request):
        """
        Créer une nouvelle table de détails avec des champs de base
        """
        try:
            # Parser les données selon le content-type
            if hasattr(request, 'data'):
                # Cas DRF avec request parser
                table_name = request.data.get('name')
            else:
                # Cas requête manuelle - parser le JSON
                import json
                if request.content_type == 'application/json':
                    data = json.loads(request.body.decode('utf-8'))
                    table_name = data.get('name')
                else:
                    table_name = request.POST.get('name')
            
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
            
            # Créer la table
            table = DynamicTable.objects.create(
                name=table_name,
                slug=table_name.lower().replace(' ', '_'),
                description=f'Table de détails pour {table_name}',
                created_by=request.user
            )
            
            # Ajouter des champs de base
            basic_fields = [
                {'name': 'Nom', 'field_type': 'text', 'is_required': True, 'slug': 'nom'},
                {'name': 'Description', 'field_type': 'textarea', 'is_required': False, 'slug': 'description'},
                {'name': 'Statut', 'field_type': 'text', 'is_required': False, 'slug': 'statut'},
                {'name': 'Date création', 'field_type': 'date', 'is_required': False, 'slug': 'date_creation'},
            ]
            
            for field_data in basic_fields:
                DynamicField.objects.create(
                    table=table,
                    **field_data
                )
            
            return Response({
                'success': True,
                'message': f'Table "{table_name}" créée avec succès',
                'table': DynamicTableSerializer(table).data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Erreur lors de la création de la table: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class DynamicFieldViewSet(viewsets.ModelViewSet):
    queryset = DynamicField.objects.all()
    serializer_class = DynamicFieldSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['table', 'field_type', 'is_required', 'is_unique', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'order']

    @action(detail=False, methods=['patch'])
    def reorder_fields(self, request):
        """
        Met à jour l'ordre de plusieurs champs d'une table
        """
        field_orders = request.data.get('field_orders', [])
        table_id = request.data.get('table_id')
        
        if not field_orders:
            return Response(
                {"detail": "Le paramètre field_orders est requis"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not table_id:
            return Response(
                {"detail": "Le paramètre table_id est requis"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Vérifier que la table existe
        table = get_object_or_404(DynamicTable, id=table_id)
        
        # Mettre à jour l'ordre de chaque champ
        updated_fields = []
        for field_order in field_orders:
            field_id = field_order.get('id')
            order = field_order.get('order')
            
            if field_id is not None and order is not None:
                try:
                    field = DynamicField.objects.get(id=field_id, table=table)
                    field.order = order
                    field.save()
                    updated_fields.append(field)
                except DynamicField.DoesNotExist:
                    continue
        
        # Retourner les champs mis à jour
        serializer = DynamicFieldSerializer(updated_fields, many=True)
        return Response({
            "detail": f"{len(updated_fields)} champs réorganisés avec succès",
            "fields": serializer.data
        })

class DynamicRecordViewSet(viewsets.ModelViewSet):
    queryset = DynamicRecord.objects.all()
    serializer_class = DynamicRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['table', 'is_active', 'created_by']
    ordering_fields = ['created_at', 'updated_at', 'custom_id']
    
    def get_serializer_class(self):
        if self.action == 'list' or self.action == 'retrieve':
            return FlatDynamicRecordSerializer
        return super().get_serializer_class()
    
    @action(detail=False, methods=['get'])
    def by_custom_id(self, request):
        """
        Retourne un enregistrement par son custom_id et table_id
        """
        table_id = request.query_params.get('table_id')
        custom_id = request.query_params.get('custom_id')
        
        if not table_id or not custom_id:
            return Response(
                {"detail": "Les paramètres table_id et custom_id sont requis"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            table = get_object_or_404(DynamicTable, id=table_id)
            record = get_object_or_404(
                DynamicRecord, 
                table=table, 
                custom_id=custom_id, 
                is_active=True
            )
            serializer = FlatDynamicRecordSerializer(record)
            return Response(serializer.data)
        except DynamicRecord.DoesNotExist:
            return Response(
                {"detail": "Enregistrement non trouvé"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get'])
    def values(self, request, pk=None):
        """
        Retourne toutes les valeurs d'un enregistrement
        """
        record = self.get_object()
        values = record.values.all()
        serializer = DynamicValueSerializer(values, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def by_table(self, request):
        """
        Retourne tous les enregistrements d'une table spécifique
        """
        table_id = request.query_params.get('table_id')
        if not table_id:
            return Response(
                {"detail": "Le paramètre table_id est requis"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        table = get_object_or_404(DynamicTable, id=table_id)
        records = self.queryset.filter(table=table, is_active=True)
        
        # Appliquer les filtres
        query_params = request.query_params.copy()
        for param, value in query_params.items():
            if param.startswith('field_'):
                field_slug = param[6:]  # Enlever 'field_'
                field = get_object_or_404(DynamicField, table=table, slug=field_slug)
                records = records.filter(values__field=field, values__value=value)
        
        page = self.paginate_queryset(records)
        if page is not None:
            serializer = FlatDynamicRecordSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = FlatDynamicRecordSerializer(records, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def create_with_values(self, request):
        """
        Crée un enregistrement avec ses valeurs en une seule requête
        """
        table_id = request.data.get('table_id')
        if not table_id:
            return Response(
                {"detail": "Le paramètre table_id est requis"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        table = get_object_or_404(DynamicTable, id=table_id)
        
        serializer = DynamicRecordCreateSerializer(
            data=request.data,
            context={'request': request, 'table': table}
        )
        
        if serializer.is_valid():
            record = serializer.save()
            return Response(
                FlatDynamicRecordSerializer(record).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['put', 'patch'])
    def update_with_values(self, request, pk=None):
        """
        Met à jour un enregistrement avec ses valeurs en une seule requête
        """
        record = self.get_object()
        table = record.table
        
        serializer = DynamicRecordCreateSerializer(
            instance=record,
            data=request.data,
            context={'request': request, 'table': table},
            partial=request.method == 'PATCH'
        )
        
        if serializer.is_valid():
            record = serializer.save()
            return Response(
                FlatDynamicRecordSerializer(record).data
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DynamicValueViewSet(viewsets.ModelViewSet):
    queryset = DynamicValue.objects.all()
    serializer_class = DynamicValueSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['record', 'field']