#!/usr/bin/env python3
"""
Script pour créer les 6 tables business principales avec leurs vraies colonnes
SANS insérer de données - juste la structure
"""
import os
import sys
import django

# Configuration Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from django.contrib.auth import get_user_model
from database.models import DynamicTable, DynamicField

User = get_user_model()

def create_initial_tables():
    print("🏗️  Création des 6 tables business principales...")
    
    # Obtenir l'utilisateur admin
    admin_user = User.objects.filter(is_superuser=True).first()
    if not admin_user:
        print("❌ Aucun admin trouvé")
        return
    
    # Définition des 6 tables principales avec leurs vraies colonnes actuelles
    tables_config = {
        'Contacts': {
            'description': 'Liste des contacts',
            'fields': [
                ('email', 'text', True, 'email du contact'),
                ('nom', 'text', True, 'Nom du contact'),
                ('prenom', 'text', True, 'Prénom de la personne'),
                ('equipe', 'text', True, 'Nom de l\'équipe'),
            ]
        },
        'Choix': {
            'description': 'Regroupement des divers choix',
            'fields': [
                ('sous_type_prestation', 'text', False, ''),
                ('espèce', 'text', False, ''),
                ('qualité', 'text', False, ''),
                ('sous_type_formation', 'text', False, ''),
                ('sous_type_collaboration', 'text', False, ''),
                ('option', 'text', False, ''),
            ]
        },
        'TableNames': {
            'description': 'Indexer les types de projet',
            'fields': [
                ('nom', 'text', True, 'Noms des types de projet', True),  # unique
                ('description', 'text', False, 'Détails du type'),
            ]
        },
        'Projet': {
            'description': 'Stocker tous les projets',
            'fields': [
                ('nom_projet', 'text', True, 'nom du projet'),
                ('statut', 'choice', True, ''),
                ('numero_projet', 'text', True, 'Numéro du Projet', True),  # unique
                ('contact_principal', 'foreign_key', True, 'Contact avec qui se passe le projet'),
                ('equipe', 'text', False, ''),
                ('type_projet', 'choice', False, ''),
                ('description', 'text', True, ''),
            ]
        },
        'Devis': {
            'description': 'Stocker les devis des projets',
            'fields': [
                ('numero_devis', 'text', True, ''),
                ('montant', 'decimal', True, ''),
                ('statut', 'boolean', True, ''),
                ('date_debut', 'date', False, ''),
                ('date_rendu', 'date', False, ''),
                ('agent_plateforme', 'text', False, ''),
            ]
        },
        'DevisParProjet': {
            'description': 'Indexer les devis par projet',
            'fields': [
                ('projet_id', 'decimal', True, '', True),  # unique
                ('lien_devis', 'text', False, ''),
            ]
        },
    }
    
    # Créer les tables dans l'ordre (Contacts et Choix d'abord pour les FK)
    table_order = ['Contacts', 'Choix', 'TableNames', 'Projet', 'Devis', 'DevisParProjet']
    created_tables = {}
    
    for table_name in table_order:
        config = tables_config[table_name]
        
        # Vérifier si la table existe déjà
        if DynamicTable.objects.filter(name=table_name).exists():
            print(f"⚠️  Table {table_name} existe déjà")
            created_tables[table_name] = DynamicTable.objects.get(name=table_name)
            continue
        
        # Créer la table
        table = DynamicTable.objects.create(
            name=table_name,
            slug=table_name.lower(),
            description=config['description'],
            created_by=admin_user
        )
        created_tables[table_name] = table
        print(f"✅ Table {table_name} créée")
        
        # Créer les champs
        for order, field_info in enumerate(config['fields'], 1):
            # Gérer les différents formats de field_info
            if len(field_info) == 4:
                field_name, field_type, is_required, description = field_info
                is_unique = False
            elif len(field_info) == 5:
                field_name, field_type, is_required, description, is_unique = field_info
            else:
                continue
            
            field_data = {
                'table': table,
                'name': field_name.replace('_', ' ').title(),  # Convertir en titre
                'slug': field_name,
                'field_type': field_type,
                'is_required': is_required,
                'is_unique': is_unique,
                'description': description,
                'order': order
            }
            
            # Gérer les clés étrangères
            if field_type == 'foreign_key':
                if field_name == 'contact_principal':
                    field_data['related_table'] = created_tables.get('Contacts')
                elif field_name == 'projet':
                    field_data['related_table'] = created_tables.get('Projet')
                elif field_name == 'devis':
                    field_data['related_table'] = created_tables.get('Devis')
            
            # Gérer les champs de choix - ils ont des options prédéfinies
            elif field_type == 'choice':
                if field_name == 'statut' and table_name == 'Projet':
                    field_data['options'] = ["Pas commencé", "En cours", "Terminé"]
                elif field_name == 'type_projet':
                    field_data['options'] = ["Prestation", "Formation", "Collaboration"]
            
            # Gérer les valeurs par défaut spéciales
            if field_name == 'nom_projet':
                field_data['default_value'] = 'NULL'
            
            DynamicField.objects.create(**field_data)
            print(f"  ➕ Champ {field_data['name']} ajouté")
    
    print("🎉 Les 6 tables business principales ont été créées avec succès!")
    print("📝 Aucune donnée n'a été insérée - structure seulement")

if __name__ == "__main__":
    create_initial_tables() 