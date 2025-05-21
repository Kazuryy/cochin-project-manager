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

class DynamicFieldViewSet(viewsets.ModelViewSet):
    queryset = DynamicField.objects.all()
    serializer_class = DynamicFieldSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['table', 'field_type', 'is_required', 'is_unique', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'order']

class DynamicRecordViewSet(viewsets.ModelViewSet):
    queryset = DynamicRecord.objects.all()
    serializer_class = DynamicRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['table', 'is_active', 'created_by']
    ordering_fields = ['created_at', 'updated_at']
    
    def get_serializer_class(self):
        if self.action == 'list' or self.action == 'retrieve':
            return FlatDynamicRecordSerializer
        return super().get_serializer_class()
    
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