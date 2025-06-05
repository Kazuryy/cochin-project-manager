# backend/database/views.py
from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
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

    @action(detail=False, methods=['post'])
    def create_project_with_details(self, request):
        """
        Créer un nouveau projet avec ses détails de façon transactionnelle
        """
        try:
            # Données du projet principal
            project_data = request.data.get('project_data', {})
            # Données des champs conditionnels pour la table Details
            conditional_fields = request.data.get('conditional_fields', {})
            # Type de projet pour déterminer quelle table Details utiliser
            project_type_id = request.data.get('project_type_id')
            
            if not project_data.get('nom_projet'):
                return Response(
                    {'error': 'Le nom du projet est requis'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Utiliser une transaction pour garantir l'atomicité
            with transaction.atomic():
                # 1. Trouver la table Projet
                project_table = DynamicTable.objects.filter(
                    models.Q(name='Projet') | 
                    models.Q(slug='projet') | 
                    models.Q(name='Projets') | 
                    models.Q(slug='projets')
                ).first()
                
                if not project_table:
                    return Response(
                        {'error': 'Table Projet introuvable'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # 2. Créer l'enregistrement projet principal
                project_record = DynamicRecord.objects.create(
                    table=project_table,
                    created_by=request.user
                )
                
                # 3. Ajouter les valeurs du projet principal (en excluant type_projet pour éviter les collisions)
                processed_fields = set()  # Pour éviter les doublons
                
                for field_name, field_value in project_data.items():
                    if field_value and field_name != 'type_projet':  # Exclure type_projet
                        # Trouver le champ correspondant dans la table Projet
                        project_field = project_table.fields.filter(
                            models.Q(slug=field_name) | 
                            models.Q(name__iexact=field_name.replace('_', ' '))
                        ).first()
                        
                        if project_field and project_field.id not in processed_fields:
                            DynamicValue.objects.create(
                                record=project_record,
                                field=project_field,
                                value=str(field_value)
                            )
                            processed_fields.add(project_field.id)
                
                # 4. Ajouter séparément le type de projet si fourni
                if project_type_id:
                    # Pour les champs FK, toujours stocker l'ID, pas le nom
                    type_field = project_table.fields.filter(
                        models.Q(slug='type_projet') | 
                        models.Q(name__iexact='type projet') |
                        models.Q(name__iexact='type')
                    ).first()
                    
                    if type_field and type_field.id not in processed_fields:
                        # Vérifier si c'est un champ FK ou un champ texte
                        if type_field.field_type == 'foreign_key':
                            # Champ FK : stocker l'ID
                            DynamicValue.objects.create(
                                record=project_record,
                                field=type_field,
                                value=str(project_type_id)  # Stocker l'ID pour la FK
                            )
                            print(f"✅ Type de projet FK enregistré: ID {project_type_id}")
                        else:
                            # Champ texte : stocker le nom (legacy)
                            table_names_table = DynamicTable.objects.filter(
                                models.Q(name__icontains='tablename') |
                                models.Q(name__icontains='table_name') |
                                models.Q(name__icontains='type')
                            ).first()
                            
                            project_type_value = project_type_id  # Valeur par défaut
                            
                            if table_names_table:
                                type_record = DynamicRecord.objects.filter(
                                    table=table_names_table,
                                    id=project_type_id,
                                    is_active=True
                                ).first()
                                
                                if type_record:
                                    # Récupérer le nom du type
                                    type_name_field = table_names_table.fields.filter(
                                        models.Q(name__icontains='nom') |
                                        models.Q(slug__icontains='nom')
                                    ).first()
                                    
                                    if type_name_field:
                                        type_name_value_obj = type_record.values.filter(field=type_name_field).first()
                                        if type_name_value_obj:
                                            project_type_value = type_name_value_obj.value
                            
                            DynamicValue.objects.create(
                                record=project_record,
                                field=type_field,
                                value=str(project_type_value)  # Stocker le nom pour champ texte
                            )
                            print(f"✅ Type de projet texte enregistré: {project_type_value}")
                        
                        processed_fields.add(type_field.id)
                
                # 5. Si on a des champs conditionnels, créer l'enregistrement Details
                if conditional_fields and project_type_id:
                    print(f"🔍 Traitement des champs conditionnels: {conditional_fields}")
                    
                    # Trouver le type de projet pour déterminer la table Details
                    table_names_table = DynamicTable.objects.filter(
                        models.Q(name__icontains='tablename') |
                        models.Q(name__icontains='table_name') |
                        models.Q(name__icontains='type')
                    ).first()
                    
                    if table_names_table:
                        # Récupérer l'enregistrement du type
                        type_record = DynamicRecord.objects.filter(
                            table=table_names_table,
                            id=project_type_id,
                            is_active=True
                        ).first()
                        
                        if type_record:
                            # Récupérer le nom du type
                            type_name_field = table_names_table.fields.filter(
                                models.Q(name__icontains='nom') |
                                models.Q(slug__icontains='nom')
                            ).first()
                            
                            if type_name_field:
                                type_name_value = type_record.values.filter(field=type_name_field).first()
                                if type_name_value:
                                    type_name = type_name_value.value
                                    details_table_name = f"{type_name}Details"
                                    print(f"🎯 Recherche de la table: {details_table_name}")
                                    
                                    # Trouver la table Details correspondante
                                    details_table = DynamicTable.objects.filter(
                                        name=details_table_name
                                    ).first()
                                    
                                    if details_table:
                                        print(f"✅ Table Details trouvée: {details_table.name}")
                                        print(f"📋 Champs disponibles dans {details_table.name}:")
                                        for field in details_table.fields.filter(is_active=True):
                                            print(f"  - {field.name} (slug: {field.slug}, type: {field.field_type})")
                                        
                                        # Créer l'enregistrement dans la table Details
                                        details_record = DynamicRecord.objects.create(
                                            table=details_table,
                                            created_by=request.user
                                        )
                                        print(f"✅ Enregistrement Details créé avec ID: {details_record.id}")
                                        
                                        details_processed_fields = set()  # Pour éviter les doublons
                                        
                                        # Ajouter les valeurs des champs conditionnels
                                        for field_name, field_value in conditional_fields.items():
                                            print(f"🔍 Traitement champ: {field_name} = {field_value}")
                                            
                                            # Ignorer les champs liés au projet (déjà traités séparément)
                                            if 'projet' in field_name.lower() or 'project' in field_name.lower():
                                                print(f"🚫 Champ projet ignoré: {field_name}")
                                                continue
                                            
                                            # Trouver le champ correspondant dans la table Details
                                            details_field = details_table.fields.filter(
                                                models.Q(slug=field_name) |
                                                models.Q(name__iexact=field_name.replace('_', ' '))
                                            ).first()
                                            
                                            if details_field and details_field.id not in details_processed_fields:
                                                # Vérifier si c'est un champ FK vers Projet (double sécurité)
                                                if (details_field.field_type == 'foreign_key' and 
                                                    details_field.related_table == project_table):
                                                    print(f"🚫 Champ FK vers Projet ignoré: {details_field.name}")
                                                    continue
                                                
                                                # Pour les champs FK, essayer de convertir le label en ID si nécessaire
                                                final_value = field_value
                                                if details_field.field_type == 'foreign_key' and details_field.related_table:
                                                    print(f"🔗 Champ FK détecté: {details_field.name} -> {details_field.related_table.name}")
                                                    
                                                    # Vérifier si la valeur est déjà un ID numérique
                                                    try:
                                                        int(field_value)
                                                        print(f"📊 Valeur numérique détectée: {field_value}")
                                                        final_value = field_value
                                                    except ValueError:
                                                        print(f"🏷️ Valeur texte détectée: {field_value}")
                                                        # Logique de conversion label->ID si nécessaire
                                                        # (même logique que dans create_project_with_details)
                                                
                                                # Mettre à jour ou créer la valeur
                                                dynamic_value, created = DynamicValue.objects.get_or_create(
                                                    record=details_record,
                                                    field=details_field,
                                                    defaults={'value': str(final_value)}
                                                )
                                                if not created:
                                                    dynamic_value.value = str(final_value)
                                                    dynamic_value.save()
                                                
                                                details_processed_fields.add(details_field.id)
                                                print(f"✅ Valeur Details mise à jour: {details_field.name} = {final_value}")
                        else:
                            print(f"❌ Enregistrement de type non trouvé: ID {project_type_id}")
                    else:
                        print(f"❌ Table TableNames non trouvée")
                
                # 6. Retourner le projet créé avec ses détails
            return Response({
                'success': True,
                    'message': f'Projet "{project_data.get("nom_projet")}" créé avec succès',
                    'project': {
                        'id': project_record.id,
                        'table_id': project_table.id
                    }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            # Log détaillé de l'erreur pour le débogage
            import traceback
            error_detail = traceback.format_exc()
            print(f"❌ Erreur détaillée dans create_project_with_details: {error_detail}")
            
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
            # ID du projet à modifier
            project_id = request.data.get('project_id')
            # Données du projet principal
            project_data = request.data.get('project_data', {})
            # Données des champs conditionnels pour la table Details
            conditional_fields = request.data.get('conditional_fields', {})
            # Type de projet pour déterminer quelle table Details utiliser
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
            
            # Utiliser une transaction pour garantir l'atomicité
            with transaction.atomic():
                # 1. Trouver la table Projet
                project_table = DynamicTable.objects.filter(
                    models.Q(name='Projet') | 
                    models.Q(slug='projet') | 
                    models.Q(name='Projets') | 
                    models.Q(slug='projets')
                ).first()
                
                if not project_table:
                    return Response(
                        {'error': 'Table Projet introuvable'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # 2. Récupérer l'enregistrement projet existant
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
                
                print(f"✅ Projet trouvé pour modification: {project_record.id}")
                
                # 3. Mettre à jour les valeurs du projet principal
                processed_fields = set()  # Pour éviter les doublons
                
                for field_name, field_value in project_data.items():
                    if field_name != 'type_projet':  # Exclure type_projet pour le traiter séparément
                        # Trouver le champ correspondant dans la table Projet
                        project_field = project_table.fields.filter(
                            models.Q(slug=field_name) | 
                            models.Q(name__iexact=field_name.replace('_', ' '))
                        ).first()
                        
                        if project_field and project_field.id not in processed_fields:
                            # Mettre à jour ou créer la valeur
                            dynamic_value, created = DynamicValue.objects.get_or_create(
                                record=project_record,
                                field=project_field,
                                defaults={'value': str(field_value)}
                            )
                            if not created:
                                dynamic_value.value = str(field_value)
                                dynamic_value.save()
                            
                            processed_fields.add(project_field.id)
                            print(f"✅ Champ projet mis à jour: {field_name} = {field_value}")
                
                # 4. Mettre à jour le type de projet si fourni
                if project_type_id:
                    # Pour les champs FK, toujours stocker l'ID, pas le nom
                    type_field = project_table.fields.filter(
                        models.Q(slug='type_projet') | 
                        models.Q(name__iexact='type projet') |
                        models.Q(name__iexact='type')
                    ).first()
                    
                    if type_field and type_field.id not in processed_fields:
                        # Vérifier si c'est un champ FK ou un champ texte
                        if type_field.field_type == 'foreign_key':
                            # Champ FK : stocker l'ID
                            dynamic_value, created = DynamicValue.objects.get_or_create(
                                record=project_record,
                                field=type_field,
                                defaults={'value': str(project_type_id)}
                            )
                            if not created:
                                dynamic_value.value = str(project_type_id)
                                dynamic_value.save()
                            print(f"✅ Type de projet FK mis à jour: ID {project_type_id}")
                        else:
                            # Champ texte : stocker le nom (legacy)
                            table_names_table = DynamicTable.objects.filter(
                                models.Q(name__icontains='tablename') |
                                models.Q(name__icontains='table_name') |
                                models.Q(name__icontains='type')
                            ).first()
                            
                            project_type_value = project_type_id  # Valeur par défaut
                            
                            if table_names_table:
                                type_record = DynamicRecord.objects.filter(
                                    table=table_names_table,
                                    id=project_type_id,
                                    is_active=True
                                ).first()
                                
                                if type_record:
                                    # Récupérer le nom du type
                                    type_name_field = table_names_table.fields.filter(
                                        models.Q(name__icontains='nom') |
                                        models.Q(slug__icontains='nom')
                                    ).first()
                                    
                                    if type_name_field:
                                        type_name_value_obj = type_record.values.filter(field=type_name_field).first()
                                        if type_name_value_obj:
                                            project_type_value = type_name_value_obj.value
                            
                            dynamic_value, created = DynamicValue.objects.get_or_create(
                                record=project_record,
                                field=type_field,
                                defaults={'value': str(project_type_value)}
                            )
                            if not created:
                                dynamic_value.value = str(project_type_value)
                                dynamic_value.save()
                            print(f"✅ Type de projet texte mis à jour: {project_type_value}")
                        
                        processed_fields.add(type_field.id)
                
                # 5. Mettre à jour les champs conditionnels dans la table Details
                if conditional_fields and project_type_id:
                    print(f"🔍 Mise à jour des champs conditionnels: {conditional_fields}")
                    
                    # Trouver le type de projet pour déterminer la table Details
                    table_names_table = DynamicTable.objects.filter(
                        models.Q(name__icontains='tablename') |
                        models.Q(name__icontains='table_name') |
                        models.Q(name__icontains='type')
                    ).first()
                    
                    if table_names_table:
                        # Récupérer l'enregistrement du type
                        type_record = DynamicRecord.objects.filter(
                            table=table_names_table,
                            id=project_type_id,
                            is_active=True
                        ).first()
                        
                        if type_record:
                            # Récupérer le nom du type
                            type_name_field = table_names_table.fields.filter(
                                models.Q(name__icontains='nom') |
                                models.Q(slug__icontains='nom')
                            ).first()
                            
                            if type_name_field:
                                type_name_value = type_record.values.filter(field=type_name_field).first()
                                if type_name_value:
                                    type_name = type_name_value.value
                                    details_table_name = f"{type_name}Details"
                                    print(f"🎯 Recherche de la table: {details_table_name}")
                                    
                                    # Trouver la table Details correspondante
                                    details_table = DynamicTable.objects.filter(
                                        name=details_table_name
                                    ).first()
                                    
                                    if details_table:
                                        print(f"✅ Table Details trouvée: {details_table.name}")
                                        
                                        # Trouver l'enregistrement Details existant
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
                                                created_by=request.user
                                            )
                                            print(f"✅ Nouvel enregistrement Details créé avec ID: {details_record.id}")
                                            
                                            # Ajouter la FK vers le projet
                                            project_fk_field = details_table.fields.filter(
                                                field_type='foreign_key',
                                                related_table=project_table
                                            ).first()
                                            
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
                                                print(f"✅ Champ FK Projet créé automatiquement")
                                            
                                            DynamicValue.objects.create(
                                                record=details_record,
                                                field=project_fk_field,
                                                value=str(project_record.id)
                                            )
                                            print(f"✅ FK Projet enregistrée: {project_record.id}")
                                        else:
                                            print(f"✅ Enregistrement Details existant trouvé: {details_record.id}")
                                        
                                        # Mettre à jour les valeurs des champs conditionnels
                                        details_processed_fields = set()
                                        
                                        for field_name, field_value in conditional_fields.items():
                                            print(f"🔍 Traitement champ: {field_name} = {field_value}")
                                            
                                            # Ignorer les champs liés au projet (déjà traités séparément)
                                            if 'projet' in field_name.lower() or 'project' in field_name.lower():
                                                print(f"🚫 Champ projet ignoré: {field_name}")
                                                continue
                                            
                                            # Trouver le champ correspondant dans la table Details
                                            details_field = details_table.fields.filter(
                                                models.Q(slug=field_name) |
                                                models.Q(name__iexact=field_name.replace('_', ' '))
                                            ).first()
                                            
                                            if details_field and details_field.id not in details_processed_fields:
                                                # Vérifier si c'est un champ FK vers Projet (double sécurité)
                                                if (details_field.field_type == 'foreign_key' and 
                                                    details_field.related_table == project_table):
                                                    print(f"🚫 Champ FK vers Projet ignoré: {details_field.name}")
                                                    continue
                                                
                                                # Pour les champs FK, essayer de convertir le label en ID si nécessaire
                                                final_value = field_value
                                                if details_field.field_type == 'foreign_key' and details_field.related_table:
                                                    print(f"🔗 Champ FK détecté: {details_field.name} -> {details_field.related_table.name}")
                                                    
                                                    # Vérifier si la valeur est déjà un ID numérique
                                                    try:
                                                        int(field_value)
                                                        print(f"📊 Valeur numérique détectée: {field_value}")
                                                        final_value = field_value
                                                    except ValueError:
                                                        print(f"🏷️ Valeur texte détectée: {field_value}")
                                                        # Logique de conversion label->ID si nécessaire
                                                        # (même logique que dans create_project_with_details)
                                                
                                                # Mettre à jour ou créer la valeur
                                                dynamic_value, created = DynamicValue.objects.get_or_create(
                                                    record=details_record,
                                                    field=details_field,
                                                    defaults={'value': str(final_value)}
                                                )
                                                if not created:
                                                    dynamic_value.value = str(final_value)
                                                    dynamic_value.save()
                                                
                                                details_processed_fields.add(details_field.id)
                                                print(f"✅ Valeur Details mise à jour: {details_field.name} = {final_value}")
                                            else:
                                                if not details_field:
                                                    print(f"❌ Champ non trouvé dans {details_table.name}: {field_name}")
                                                else:
                                                    print(f"⚠️ Champ déjà traité: {field_name}")
                                    else:
                                        print(f"❌ Table Details non trouvée: {details_table_name}")
                        else:
                            print(f"❌ Enregistrement de type non trouvé: ID {project_type_id}")
                    else:
                        print(f"❌ Table TableNames non trouvée")
                
                # 6. Retourner le succès
                return Response({
                    'success': True,
                    'message': f'Projet "{project_data.get("nom_projet")}" modifié avec succès',
                    'project': {
                        'id': project_record.id,
                        'table_id': project_table.id
                    }
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            # Log détaillé de l'erreur pour le débogage
            import traceback
            error_detail = traceback.format_exc()
            print(f"❌ Erreur détaillée dans update_project_with_details: {error_detail}")
            
            return Response(
                {'error': f'Erreur lors de la modification du projet: {str(e)}'},
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
    permission_classes = []  # Permissions supprimées temporairement
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
        print(f"🎯 create_with_values appelé avec les données: {request.data}")
        
        table_id = request.data.get('table_id')
        if not table_id:
            print("❌ table_id manquant")
            return Response(
                {"detail": "Le paramètre table_id est requis"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        print(f"📋 Table ID reçu: {table_id}")
        
        try:
            table = get_object_or_404(DynamicTable, id=table_id)
            print(f"✅ Table trouvée: {table.name} (ID: {table.id})")
        except Exception as e:
            print(f"❌ Erreur lors de la récupération de la table: {e}")
            return Response(
                {"detail": f"Table introuvable: {e}"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        print(f"📤 Données complètes reçues: {request.data}")
        print(f"🔧 Context: request={request}, table={table}")
        
        # Préparer les données pour le serializer en remplaçant table_id par l'objet table
        serializer_data = request.data.copy()
        serializer_data['table'] = table.id  # Le serializer attend l'ID de la table
        # Supprimer table_id s'il existe pour éviter les conflits
        if 'table_id' in serializer_data:
            del serializer_data['table_id']
        
        print(f"📋 Données préparées pour le serializer: {serializer_data}")
        
        serializer = DynamicRecordCreateSerializer(
            data=serializer_data,
            context={'request': request, 'table': table}
        )
        
        print("🔍 Validation du serializer...")
        if serializer.is_valid():
            print("✅ Serializer valide, création de l'enregistrement...")
            try:
                record = serializer.save()
                print(f"✅ Enregistrement créé avec succès: ID {record.id}")
                return Response(
                    FlatDynamicRecordSerializer(record).data,
                    status=status.HTTP_201_CREATED
                )
            except Exception as e:
                print(f"❌ Erreur lors de la sauvegarde: {e}")
                import traceback
                traceback.print_exc()
                return Response(
                    {"detail": f"Erreur lors de la sauvegarde: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            print(f"❌ Erreurs de validation du serializer: {serializer.errors}")
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
    permission_classes = []  # Permissions supprimées temporairement
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['record', 'field']