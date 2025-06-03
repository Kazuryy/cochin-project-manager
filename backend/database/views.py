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
from django.db import models

class DynamicTableViewSet(viewsets.ModelViewSet):
    queryset = DynamicTable.objects.all()
    serializer_class = DynamicTableSerializer
    permission_classes = []  # Permissions supprimées temporairement
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

    @action(detail=False, methods=['post'])
    def create_new_type(self, request):
        """
        Créer un nouveau type : ajouter à TableNames et créer la table {Nom}Details
        """
        try:
            type_name = request.data.get('type_name')
            columns = request.data.get('columns', [])
            
            if not type_name:
                return Response(
                    {'error': 'Le nom du type est requis'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Capitaliser la première lettre
            type_name = type_name.strip()
            type_name = type_name[0].upper() + type_name[1:] if type_name else ''
            
            if not type_name:
                return Response(
                    {'error': 'Le nom du type est invalide'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 1. Trouver la table TableNames
            table_names_table = DynamicTable.objects.filter(name__icontains='tablename').first()
            if not table_names_table:
                # Essayer d'autres variantes
                table_names_table = DynamicTable.objects.filter(name__icontains='table_name').first()
                if not table_names_table:
                    table_names_table = DynamicTable.objects.filter(name__icontains='type').first()
            
            if not table_names_table:
                return Response(
                    {'error': 'Table TableNames introuvable. Créez d\'abord une table pour stocker les types.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 2. Ajouter le type dans TableNames
            type_record = DynamicRecord.objects.create(
                table=table_names_table,
                created_by=request.user
            )
            
            # Trouver le champ nom dans TableNames
            nom_field = table_names_table.fields.filter(name__icontains='nom').first()
            if nom_field:
                DynamicValue.objects.create(
                    record=type_record,
                    field=nom_field,
                    value=type_name
                )
            
            # Trouver le champ description dans TableNames
            description_field = table_names_table.fields.filter(name__icontains='description').first()
            if description_field:
                DynamicValue.objects.create(
                    record=type_record,
                    field=description_field,
                    value=f'Type {type_name} créé automatiquement'
                )
            
            # 3. Créer la table {Nom}Details
            details_table_name = f"{type_name}Details"
            
            # Vérifier si la table existe déjà
            if DynamicTable.objects.filter(name=details_table_name).exists():
                return Response(
                    {'error': f'La table "{details_table_name}" existe déjà'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            details_table = DynamicTable.objects.create(
                name=details_table_name,
                slug=details_table_name.lower().replace(' ', '_'),
                description=f'Table de détails pour le type {type_name}',
                created_by=request.user
            )
            
            # 4. Créer les colonnes demandées par l'utilisateur
            choix_table = DynamicTable.objects.filter(name__icontains='choix').first()
            
            for i, column in enumerate(columns):
                column_name = column.get('name', '').strip()
                column_type = column.get('type', 'text')
                is_required = column.get('is_required', False)
                is_choice_field = column.get('is_choice_field', False)
                choice_column_name = column.get('choice_column_name', '')
                is_foreign_key = column.get('is_foreign_key', False)
                foreign_table_id = column.get('foreign_table_id', '')
                foreign_reference_field = column.get('foreign_reference_field', 'id')
                
                if not column_name:
                    continue
                
                # Créer le champ dans la table Details
                field_data = {
                    'name': column_name,
                    'slug': column_name.lower().replace(' ', '_'),
                    'field_type': column_type,
                    'is_required': is_required,
                    'order': i + 1
                }
                
                # Si c'est un champ de choix avec FK vers Choix
                if is_choice_field and choix_table and choice_column_name:
                    field_data['field_type'] = 'foreign_key'
                    field_data['related_table'] = choix_table
                    
                    # Vérifier si la colonne existe dans la table Choix
                    choice_field = choix_table.fields.filter(
                        name__iexact=choice_column_name
                    ).first()
                    
                    if not choice_field:
                        # Créer la colonne dans la table Choix
                        choice_field = DynamicField.objects.create(
                            table=choix_table,
                            name=choice_column_name,
                            slug=choice_column_name.lower().replace(' ', '_'),
                            field_type='text',
                            is_required=False,
                            order=choix_table.fields.count() + 1
                        )
                
                # Si c'est une clé étrangère vers une autre table
                elif is_foreign_key and foreign_table_id:
                    try:
                        foreign_table = DynamicTable.objects.get(id=foreign_table_id)
                        field_data['field_type'] = 'foreign_key'
                        field_data['related_table'] = foreign_table
                        
                        # Ajouter le champ de référence si spécifié
                        if foreign_reference_field and foreign_reference_field != 'id':
                            # Vérifier que le champ existe dans la table cible
                            reference_field = foreign_table.fields.filter(
                                models.Q(slug=foreign_reference_field) | 
                                models.Q(name__iexact=foreign_reference_field)
                            ).first()
                            
                            if reference_field:
                                field_data['related_field'] = reference_field
                                print(f"✅ FK {column_name} → {foreign_table.name}.{foreign_reference_field}")
                            else:
                                print(f"⚠️ Champ de référence {foreign_reference_field} non trouvé dans {foreign_table.name}")
                        else:
                            print(f"✅ FK {column_name} → {foreign_table.name}.id (défaut)")
                            
                    except DynamicTable.DoesNotExist:
                        # Si la table n'existe pas, créer comme champ text
                        print(f"⚠️ Table FK {foreign_table_id} non trouvée pour {column_name}")
                
                DynamicField.objects.create(
                    table=details_table,
                    **field_data
                )
            
            # 5. Créer automatiquement les règles conditionnelles
            # Trouver la table des projets
            project_table = DynamicTable.objects.filter(name__icontains='projet').first()
            if project_table:
                # Trouver le champ type_projet dans la table projet
                type_field = project_table.fields.filter(
                    models.Q(name__icontains='type') | models.Q(slug__icontains='type')
                ).first()
                
                if type_field and choix_table:
                    # Importer le modèle ici pour éviter les imports circulaires
                    from conditional_fields.models import ConditionalFieldRule
                    
                    # 1. Créer une règle pour chaque colonne qui a un lien vers Choix (existant)
                    for column in columns:
                        if column.get('is_choice_field') and column.get('choice_column_name'):
                            choice_column_name = column.get('choice_column_name', '')
                            column_label = column.get('name', '')
                            
                            # Trouver le champ dans la table Choix
                            choice_field = choix_table.fields.filter(
                                name__iexact=choice_column_name
                            ).first()
                            
                            if choice_field:
                                # Créer la règle conditionnelle
                                rule, created = ConditionalFieldRule.objects.get_or_create(
                                    parent_table=project_table,
                                    parent_field=type_field,
                                    parent_value=type_name,
                                    conditional_field_name=choice_column_name.lower().replace(' ', '_'),
                                    defaults={
                                        'conditional_field_label': column_label,
                                        'is_required': column.get('is_required', False),
                                        'order': 0,
                                        'source_table': choix_table,
                                        'source_field': choice_field,
                                        'created_by': request.user
                                    }
                                )
                                
                                if created:
                                    print(f"✅ Règle conditionnelle créée: {type_name} → {column_label}")
                    
                    # 2. NOUVEAU: Détection automatique des champs "Sous type X" existants
                    # Chercher un champ "Sous type {type_name}" dans la table Choix
                    potential_field_names = [
                        f"Sous type {type_name}",
                        f"sous type {type_name.lower()}",
                        f"Sous-type {type_name}",
                        f"sous-type {type_name.lower()}"
                    ]
                    
                    auto_detected_field = None
                    for field_name in potential_field_names:
                        auto_detected_field = choix_table.fields.filter(name__iexact=field_name).first()
                        if auto_detected_field:
                            break
                    
                    if auto_detected_field:
                        # Créer la règle automatiquement si elle n'existe pas déjà
                        rule, created = ConditionalFieldRule.objects.get_or_create(
                            parent_table=project_table,
                            parent_field=type_field,
                            parent_value=type_name.lower(),  # Stocker en minuscules pour la compatibilité
                            conditional_field_name=auto_detected_field.name.lower().replace(' ', '_'),
                            defaults={
                                'conditional_field_label': auto_detected_field.name,
                                'is_required': True,
                                'order': 0,
                                'source_table': choix_table,
                                'source_field': auto_detected_field,
                                'created_by': request.user
                            }
                        )
                        
                        if created:
                            print(f"🎯 Règle auto-détectée créée: {type_name} → {auto_detected_field.name}")
                        else:
                            print(f"ℹ️ Règle déjà existante: {type_name} → {auto_detected_field.name}")
                    else:
                        print(f"⚠️ Aucun champ 'Sous type {type_name}' trouvé dans la table Choix")
            
            return Response({
                'success': True,
                'message': f'Type "{type_name}" créé avec succès',
                'type_record': {
                    'id': type_record.id,
                    'type_name': type_name
                },
                'details_table': DynamicTableSerializer(details_table).data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Erreur lors de la création du type: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class DynamicFieldViewSet(viewsets.ModelViewSet):
    queryset = DynamicField.objects.all()
    serializer_class = DynamicFieldSerializer
    permission_classes = []  # Permissions supprimées temporairement
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