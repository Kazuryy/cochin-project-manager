#!/bin/bash
set -e

echo "🚀 Démarrage de Cochin Project Manager..."

# Attendre que les dossiers soient montés
sleep 2

# Corriger les permissions des dossiers critiques
echo "🔧 Correction des permissions..."
mkdir -p /app/logs /app/backups /app/staticfiles /app/media /app/db
chmod -R 777 /app/logs
chmod -R 755 /app/backups /app/staticfiles /app/media /app/db

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
    
    # Créer une configuration de sauvegarde par défaut
    python manage.py shell -c "
from backup_manager.models import BackupConfiguration
from django.contrib.auth import get_user_model
User = get_user_model()
admin = User.objects.filter(is_superuser=True).first()
if admin and not BackupConfiguration.objects.filter(name='Daily Backup').exists():
    BackupConfiguration.objects.create(
        name='Daily Backup',
        backup_type='full',
        frequency='daily',
        retention_days=30,
        created_by=admin
    )
    print('✅ Configuration sauvegarde créée')
"
    
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