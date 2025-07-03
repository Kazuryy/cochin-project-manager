# 🚀 Guide de Déploiement en Production - Cochin Project Manager

Ce guide détaille toutes les étapes nécessaires pour déployer l'application Cochin Project Manager en production via Docker sur serveur dédié Linux.

## 📋 Architecture de l'Application

### Stack Technique
- **Backend** : Django 5.2.1 + Django REST Framework
- **Frontend** : React + Vite + TailwindCSS + DaisyUI
- **Base de données** : SQLite (production optimisée)
- **Authentification** : Django Auth personnalisé avec sécurité ANSSI
- **Système de sauvegarde** : Intégré avec chiffrement
- **Notifications** : Discord webhook
- **Tâches automatisées** : Django-crontab
- **Domaine** : project-manager.local (VLAN privé)

### Modules Principaux
1. **Authentication** - Gestion utilisateurs avec sécurité renforcée
2. **Database** - Tables dynamiques (cœur métier)
3. **Backup Manager** - Système de sauvegarde/restauration
4. **Conditional Fields** - Champs conditionnels intelligents

## 🗄️ Structure de la Base de Données

### Tables Système (Django)
- `auth_user` (étendu par `authentication_user`)
- `auth_group`, `auth_permission`
- `authentication_passwordhistory`

### Tables Métier (Créées automatiquement)
- `database_dynamictable` - Tables créées dynamiquement
- `database_dynamicfield` - Champs des tables dynamiques
- `database_dynamicrecord` - Enregistrements
- `database_dynamicvalue` - Valeurs des champs
- `conditional_fields_conditionalfieldrule` - Règles de champs conditionnels
- `conditional_fields_conditionalfieldoption` - Options des champs

### Tables Business (Pré-créées)
- **Projet** - Gestion des projets
- **Devis** - Gestion des devis
- **DevisParProjet** - Relation devis/projets
- **Contact** - Gestion des contacts
- **Choix** - Tables de référence pour listes déroulantes
- **TableNames** - Métadonnées des types

### Tables Sauvegarde
- `backup_manager_backupconfiguration` - Configurations de sauvegarde
- `backup_manager_backuphistory` - Historique des sauvegardes
- `backup_manager_restorehistory` - Historique des restaurations
- `backup_manager_uploadedbackup` - Sauvegardes uploadées
- `backup_manager_externalrestoration` - Restaurations externes

## 🔧 Variables d'Environnement

### Variables Obligatoires (Production)
```env
# Django
DJANGO_ENV=production
SECRET_KEY=your-super-secret-key-here
DEBUG=False
ALLOWED_HOSTS=project-manager.local,localhost,127.0.0.1

# Sécurité
CORS_ALLOWED_ORIGINS=http://project-manager.local,https://project-manager.local
CSRF_TRUSTED_ORIGINS=http://project-manager.local,https://project-manager.local

# Sauvegarde
BACKUP_ENCRYPTION_KEY=your-32-char-encryption-key-here

# Discord (optionnel)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Variables Optionnelles avec Valeurs par Défaut
```env
# Session et sécurité
SESSION_TIMEOUT=3600
ACCOUNT_LOCKOUT_DURATION=15
MAX_LOGIN_ATTEMPTS=5
PASSWORD_EXPIRY_DAYS=90
PASSWORD_RESET_TIMEOUT=3600
```

## 👥 Données par Défaut (Créées Automatiquement)

### 1. Utilisateur Administrateur
**OBLIGATOIRE** - Créé lors du premier démarrage

### 2. Tables Business (Pré-configurées)
Les tables suivantes seront créées automatiquement avec leurs champs :

#### **Projet**
- `nom_projet` (texte, obligatoire)
- `description` (texte long)
- `date_debut` (date)
- `date_fin` (date)
- `statut` (choix via table Choix)
- `type_projet` (choix via table Choix)
- `contact_principal` (FK vers Contact)

#### **Contact**
- `nom` (texte, obligatoire)
- `prenom` (texte)
- `email` (texte)
- `telephone` (texte)
- `entreprise` (texte)
- `poste` (texte)

#### **Devis**
- `numero_devis` (texte, obligatoire, unique)
- `nom_devis` (texte, obligatoire)
- `montant_ht` (décimal)
- `montant_ttc` (décimal)
- `date_creation` (date)
- `date_validite` (date)
- `statut` (choix via table Choix)
- `contact` (FK vers Contact)

#### **DevisParProjet**
- `projet` (FK vers Projet)
- `devis` (FK vers Devis)
- `date_association` (date)
- `principal` (booléen)

#### **Choix**
- `categorie` (texte) - Ex: "statut_projet", "type_projet", "statut_devis"
- `valeur` (texte) - La valeur technique
- `libelle` (texte) - Le libellé affiché
- `ordre` (nombre) - Ordre d'affichage

#### **TableNames**
- `nom` (texte) - Nom des types de projets ou entités
- `description` (texte long)
- `actif` (booléen)

### 3. Données Exemple (Pré-remplies)
- **Statuts projets** : "En cours", "Terminé", "En attente", "Annulé"
- **Types projets** : "Développement", "Formation", "Prestation", "Maintenance"
- **Statuts devis** : "Brouillon", "Envoyé", "Accepté", "Refusé", "Expiré"

## 🐳 Configuration Docker

### Structure du Projet
```
project-manager/
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend  
├── nginx.conf
├── .env
└── init-data/
    └── create_initial_tables.py
```

### 1. Dockerfile Backend
```dockerfile
FROM python:3.11-slim

# Variables d'environnement
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_ENV=production

# Dépendances système
RUN apt-get update && apt-get install -y \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Répertoire de travail
WORKDIR /app

# Installation des dépendances Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install gunicorn

# Copie du code
COPY backend/ .

# Script d'initialisation
COPY init-data/ ./init-data/

# Création des dossiers nécessaires
RUN mkdir -p logs backups staticfiles media db

# Script de démarrage
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Commande par défaut
ENTRYPOINT ["./entrypoint.sh"]
```

### 2. Dockerfile Frontend
```dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
# Configuration pour domaine local
ENV VITE_API_URL=http://project-manager.local
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

### 3. Docker Compose (SQLite Optimisé)
```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    environment:
      - DJANGO_ENV=production
      - SECRET_KEY=${SECRET_KEY}
      - ALLOWED_HOSTS=project-manager.local,localhost,127.0.0.1
      - CORS_ALLOWED_ORIGINS=http://project-manager.local,https://project-manager.local
      - CSRF_TRUSTED_ORIGINS=http://project-manager.local,https://project-manager.local
      - BACKUP_ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY}
      - DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL:-}
    volumes:
      - ./data/db:/app/db              # Base SQLite persistante
      - ./data/media:/app/media        # Fichiers média
      - ./data/backups:/app/backups    # Sauvegardes
      - ./data/logs:/app/logs          # Logs
      - ./data/staticfiles:/app/staticfiles  # Fichiers statiques
    networks:
      - app-network
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - app-network
    restart: unless-stopped

networks:
  app-network:
    driver: bridge
```

### 4. Configuration Nginx
```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    upstream backend {
        server backend:8000;
    }

    server {
        listen 80;
        server_name project-manager.local localhost;
        
        client_max_body_size 100M;  # Pour les uploads de sauvegarde

        # Fichiers statiques frontend
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
            
            # Headers pour SPA
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }

        # API Backend
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # Admin Django
        location /admin/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # Fichiers media et statiques
        location /media/ {
            proxy_pass http://backend;
        }

        location /static/ {
            proxy_pass http://backend;
        }
    }
}
```

### 5. Script d'Initialisation (entrypoint.sh)
```bash
#!/bin/bash
set -e

echo "🚀 Démarrage de Cochin Project Manager..."

# Attendre que les dossiers soient montés
sleep 2

# Appliquer les migrations
echo "📊 Application des migrations..."
python manage.py migrate --noinput

# Créer les tables par défaut si premier démarrage
if [ ! -f /app/db/.initialized ]; then
    echo "🎯 Premier démarrage - Création des données initiales..."
    
    # Créer superuser automatiquement
    python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser('admin', 'admin@project-manager.local', 'changeme')
print('✅ Superuser créé: admin / changeme')
"
    
    # Créer les tables business
    python init-data/create_initial_tables.py
    
    # Marquer comme initialisé
    touch /app/db/.initialized
    echo "✅ Initialisation terminée"
fi

# Collecter les fichiers statiques
echo "📁 Collection des fichiers statiques..."
python manage.py collectstatic --noinput

# Installer les tâches cron
echo "⏰ Installation des tâches cron..."
python manage.py crontab add

# Démarrer le serveur
echo "🌐 Démarrage du serveur Gunicorn..."
exec gunicorn app.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 300 \
    --max-requests 1000 \
    --preload
```

## 📜 Script de Création des Tables (create_initial_tables.py)
```python
#!/usr/bin/env python3
"""
Script pour créer les tables business par défaut
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
    print("🏗️  Création des tables business...")
    
    # Obtenir l'utilisateur admin
    admin_user = User.objects.filter(is_superuser=True).first()
    if not admin_user:
        print("❌ Aucun admin trouvé")
        return
    
    # Définition des tables à créer
    tables_config = {
        'Contact': [
            ('nom', 'text', True),
            ('prenom', 'text', False),
            ('email', 'text', False),
            ('telephone', 'text', False),
            ('entreprise', 'text', False),
            ('poste', 'text', False),
        ],
        'Choix': [
            ('categorie', 'text', True),
            ('valeur', 'text', True),
            ('libelle', 'text', True),
            ('ordre', 'number', False),
        ],
        'TableNames': [
            ('nom', 'text', True),
            ('description', 'long_text', False),
            ('actif', 'boolean', False),
        ],
        'Projet': [
            ('nom_projet', 'text', True),
            ('description', 'long_text', False),
            ('date_debut', 'date', False),
            ('date_fin', 'date', False),
            ('statut', 'choice', False),
            ('type_projet', 'choice', False),
            ('contact_principal', 'foreign_key', False),
        ],
        'Devis': [
            ('numero_devis', 'text', True),
            ('nom_devis', 'text', True),
            ('montant_ht', 'decimal', False),
            ('montant_ttc', 'decimal', False),
            ('date_creation', 'date', False),
            ('date_validite', 'date', False),
            ('statut', 'choice', False),
            ('contact', 'foreign_key', False),
        ],
        'DevisParProjet': [
            ('projet', 'foreign_key', True),
            ('devis', 'foreign_key', True),
            ('date_association', 'date', False),
            ('principal', 'boolean', False),
        ],
    }
    
    # Créer les tables
    created_tables = {}
    for table_name, fields in tables_config.items():
        # Vérifier si la table existe déjà
        if DynamicTable.objects.filter(name=table_name).exists():
            print(f"⚠️  Table {table_name} existe déjà")
            created_tables[table_name] = DynamicTable.objects.get(name=table_name)
            continue
        
        # Créer la table
        table = DynamicTable.objects.create(
            name=table_name,
            slug=table_name.lower(),
            description=f"Table {table_name} - Créée automatiquement",
            created_by=admin_user
        )
        created_tables[table_name] = table
        print(f"✅ Table {table_name} créée")
        
        # Créer les champs
        for order, (field_name, field_type, is_required) in enumerate(fields, 1):
            field_data = {
                'table': table,
                'name': field_name,
                'slug': field_name.lower().replace(' ', '_'),
                'field_type': field_type,
                'is_required': is_required,
                'order': order
            }
            
            # Gérer les clés étrangères
            if field_type == 'foreign_key':
                if field_name == 'contact_principal' or field_name == 'contact':
                    field_data['related_table'] = created_tables.get('Contact')
                elif field_name == 'projet':
                    field_data['related_table'] = created_tables.get('Projet')
                elif field_name == 'devis':
                    field_data['related_table'] = created_tables.get('Devis')
            
            # Gérer les champs de choix
            elif field_type == 'choice':
                field_data['related_table'] = created_tables.get('Choix')
            
            DynamicField.objects.create(**field_data)
            print(f"  ➕ Champ {field_name} ajouté")
    
    # Créer les données exemple dans Choix
    create_choice_data(created_tables.get('Choix'))
    
    print("🎉 Tables business créées avec succès!")

def create_choice_data(choix_table):
    """Crée les données exemple dans la table Choix"""
    if not choix_table:
        return
    
    from database.models import DynamicRecord, DynamicValue
    
    # Données de choix par défaut
    choice_data = [
        # Statuts projet
        ('statut_projet', 'en_cours', 'En cours', 1),
        ('statut_projet', 'termine', 'Terminé', 2),
        ('statut_projet', 'en_attente', 'En attente', 3),
        ('statut_projet', 'annule', 'Annulé', 4),
        
        # Types projet
        ('type_projet', 'developpement', 'Développement', 1),
        ('type_projet', 'formation', 'Formation', 2),
        ('type_projet', 'prestation', 'Prestation', 3),
        ('type_projet', 'maintenance', 'Maintenance', 4),
        
        # Statuts devis
        ('statut_devis', 'brouillon', 'Brouillon', 1),
        ('statut_devis', 'envoye', 'Envoyé', 2),
        ('statut_devis', 'accepte', 'Accepté', 3),
        ('statut_devis', 'refuse', 'Refusé', 4),
        ('statut_devis', 'expire', 'Expiré', 5),
    ]
    
    # Obtenir les champs de la table Choix
    fields = {field.slug: field for field in choix_table.fields.all()}
    
    for categorie, valeur, libelle, ordre in choice_data:
        # Créer l'enregistrement
        record = DynamicRecord.objects.create(
            table=choix_table,
            custom_id=DynamicRecord.objects.filter(table=choix_table).count() + 1
        )
        
        # Créer les valeurs
        if 'categorie' in fields:
            DynamicValue.objects.create(record=record, field=fields['categorie'], value=categorie)
        if 'valeur' in fields:
            DynamicValue.objects.create(record=record, field=fields['valeur'], value=valeur)
        if 'libelle' in fields:
            DynamicValue.objects.create(record=record, field=fields['libelle'], value=libelle)
        if 'ordre' in fields:
            DynamicValue.objects.create(record=record, field=fields['ordre'], value=str(ordre))
    
    print("✅ Données de choix créées")

if __name__ == '__main__':
    create_initial_tables()
```

## 🚀 Étapes de Déploiement

### 1. Configuration du Serveur
```bash
# 1. Installer Docker et Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 2. Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. Configurer le DNS local
echo "127.0.0.1 project-manager.local" | sudo tee -a /etc/hosts
```

### 2. Préparation du Projet
```bash
# 1. Cloner et préparer
git clone https://github.com/votre-repo/cochin-project-manager.git
cd cochin-project-manager

# 2. Créer la structure des dossiers
mkdir -p data/{db,media,backups,logs,staticfiles}
mkdir -p init-data

# 3. Créer le fichier .env
cat > .env << 'EOF'
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
BACKUP_ENCRYPTION_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
DISCORD_WEBHOOK_URL=
EOF

# 4. Copier les fichiers de configuration
# (Dockerfiles, nginx.conf, entrypoint.sh, create_initial_tables.py)
```

### 3. Déploiement
```bash
# 1. Construire et démarrer
docker-compose build
docker-compose up -d

# 2. Vérifier les logs
docker-compose logs -f

# 3. Tester l'accès
curl http://project-manager.local
```

### 4. Configuration Post-Déploiement
```bash
# 1. Vérifier les tables créées
docker-compose exec backend python manage.py shell -c "
from database.models import DynamicTable
print('Tables créées:', [t.name for t in DynamicTable.objects.all()])
"

# 2. Vérifier le superuser
# Se connecter sur http://project-manager.local/admin
# Identifiants : admin / changeme

# 3. Configurer les sauvegardes
docker-compose exec backend python manage.py shell -c "
from backup_manager.models import BackupConfiguration
from django.contrib.auth import get_user_model
User = get_user_model()
admin = User.objects.filter(is_superuser=True).first()
BackupConfiguration.objects.get_or_create(
    name='Daily Backup',
    defaults={
        'backup_type': 'full',
        'frequency': 'daily',
        'retention_days': 30,
        'created_by': admin
    }
)
print('Configuration sauvegarde créée')
"
```

## 🔧 Maintenance et Surveillance

### Commandes Utiles
```bash
# Logs en temps réel
docker-compose logs -f backend

# Sauvegarde manuelle
docker-compose exec backend python manage.py run_backup --all

# Vérification système
docker-compose exec backend python manage.py check_backup_system

# Accès shell Django
docker-compose exec backend python manage.py shell

# Redémarrage propre
docker-compose down && docker-compose up -d
```

### Structure des Données Persistantes
```
data/
├── db/
│   ├── db.sqlite3           # Base de données
│   └── .initialized         # Marqueur d'initialisation
├── media/                   # Fichiers uploadés
├── backups/                 # Sauvegardes
├── logs/                    # Logs applicatifs
└── staticfiles/             # Fichiers statiques Django
```

## 🎯 Accès à l'Application

- **Interface principale** : http://project-manager.local
- **Administration** : http://project-manager.local/admin (admin / changeme)
- **API** : http://project-manager.local/api/

## ✅ Vérifications Finales

1. ✅ Tables business créées automatiquement
2. ✅ Superuser admin configuré
3. ✅ Données de choix pré-remplies
4. ✅ Configuration sauvegarde par défaut
5. ✅ Tâches cron installées
6. ✅ Domaine local configuré
7. ✅ Persistance SQLite garantie 