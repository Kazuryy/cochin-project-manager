# backend/conditional_fields/management/commands/setup_conditional_fields.py
from django.core.management.base import BaseCommand
from django.db import transaction
from database.models import DynamicTable, DynamicField
from conditional_fields.models import ConditionalFieldRule, ConditionalFieldOption

class Command(BaseCommand):
    help = 'Configure les champs conditionnels pour les types de projets'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Supprimer toutes les règles existantes avant de créer les nouvelles',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🚀 Configuration des champs conditionnels...'))

        if options['reset']:
            self.stdout.write('🗑️  Suppression des règles existantes...')
            ConditionalFieldRule.objects.all().delete()

        try:
            with transaction.atomic():
                # Trouver les tables nécessaires
                project_table = DynamicTable.objects.filter(name='Projet').first()
                choix_table = DynamicTable.objects.filter(name='Choix').first()
                tablenames_table = DynamicTable.objects.filter(name='TableNames').first()

                if not project_table:
                    self.stdout.write(self.style.ERROR('❌ Table "Projet" non trouvée'))
                    return

                if not choix_table:
                    self.stdout.write(self.style.ERROR('❌ Table "Choix" non trouvée'))
                    return

                # Trouver le champ "Type Projet" dans la table Projet
                type_field = project_table.fields.filter(name='Type Projet').first()

                if not type_field:
                    self.stdout.write(self.style.ERROR('❌ Champ "Type Projet" non trouvé'))
                    return

                self.stdout.write(f'✅ Table projets: {project_table.name}')
                self.stdout.write(f'✅ Table choix: {choix_table.name}')
                self.stdout.write(f'✅ Champ type: {type_field.name}')

                # Auto-détection complète : plus de mapping manuel !
                # 1. Récupérer TOUS les types depuis TableNames
                # 2. Chercher automatiquement les champs "Sous type X" correspondants dans Choix
                
                try:
                    from database.models import DynamicRecord
                    tablenames_records = DynamicRecord.objects.filter(table=tablenames_table)
                    
                    self.stdout.write('🔍 Auto-détection des types et champs correspondants...')
                    
                    # Récupérer tous les types depuis TableNames
                    available_types = []
                    for record in tablenames_records:
                        for value in record.values.all():
                            if value.field.name.lower() in ['nom', 'name', 'title', 'titre']:
                                type_name = value.value.strip()
                                available_types.append(type_name)
                                self.stdout.write(f'   📋 Type trouvé: "{type_name}"')
                                break
                    
                    # Récupérer tous les champs "Sous type X" depuis Choix
                    available_subtype_fields = []
                    for field in choix_table.fields.all():
                        if field.name.lower().startswith('sous type'):
                            available_subtype_fields.append(field)
                            self.stdout.write(f'   🏷️  Champ sous-type trouvé: "{field.name}"')
                    
                    # Mapping automatique intelligent
                    type_to_choice_mapping = {}
                    
                    for type_name in available_types:
                        type_lower = type_name.lower()
                        matched_field = None
                        
                        # Chercher le champ correspondant (plusieurs stratégies)
                        for field in available_subtype_fields:
                            field_lower = field.name.lower()
                            
                            # Stratégie 1: match exact "sous type prestation" <-> "prestation"
                            if f'sous type {type_lower}' == field_lower:
                                matched_field = field
                                break
                            
                            # Stratégie 2: le type est contenu dans le nom du champ
                            if type_lower in field_lower:
                                matched_field = field
                                break
                            
                            # Stratégie 3: le nom du champ contient le type (sans "sous type")
                            field_without_prefix = field_lower.replace('sous type ', '').strip()
                            if field_without_prefix == type_lower:
                                matched_field = field
                                break
                        
                        if matched_field:
                            type_to_choice_mapping[type_lower] = [matched_field.name]
                            self.stdout.write(f'   ✅ AUTO-MAPPING: "{type_name}" → "{matched_field.name}"')
                        else:
                            self.stdout.write(f'   ⚠️  Pas de champ trouvé pour le type: "{type_name}"')
                    
                    if not type_to_choice_mapping:
                        self.stdout.write(self.style.WARNING('⚠️  Aucun mapping automatique trouvé !'))
                        return
                    
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'❌ Erreur lors de l\'auto-détection: {e}'))
                    return

                # Créer les règles pour chaque type
                created_rules = 0
                created_options = 0

                for type_value, choice_field_names in type_to_choice_mapping.items():
                    for choice_field_name in choice_field_names:
                        # Trouver le champ de choix correspondant
                        choice_field = choix_table.fields.filter(name=choice_field_name).first()
                        
                        if not choice_field:
                            self.stdout.write(self.style.WARNING(f'⚠️  Champ "{choice_field_name}" non trouvé dans la table Choix'))
                            continue

                        # Créer la règle conditionnelle
                        rule, created = ConditionalFieldRule.objects.get_or_create(
                            parent_table=project_table,
                            parent_field=type_field,
                            parent_value=type_value,
                            conditional_field_name=choice_field_name.lower().replace(' ', '_'),
                            defaults={
                                'conditional_field_label': choice_field_name,
                                'is_required': True,
                                'order': 0,
                                'source_table': choix_table,
                                'source_field': choice_field,
                            }
                        )

                        if created:
                            created_rules += 1
                            self.stdout.write(f'   ✅ Règle créée: {type_value} → {choice_field_name}')

                        # Les options seront chargées dynamiquement depuis la table Choix
                        # Pas besoin de créer des ConditionalFieldOption statiques

                self.stdout.write(self.style.SUCCESS(f'🎉 Configuration terminée !'))
                self.stdout.write(f'📊 Règles créées: {created_rules}')
                self.stdout.write('')
                self.stdout.write('💡 Pour tester:')
                self.stdout.write('   1. Ajouter des valeurs dans la table "Choix" pour les sous-types')
                self.stdout.write('   2. Aller sur la page de création de projet')
                self.stdout.write('   3. Sélectionner un type : "prestation", "formation", ou "collaboration"')
                self.stdout.write('   4. Observer les champs conditionnels qui apparaissent avec les vraies options')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Erreur: {e}'))
            raise