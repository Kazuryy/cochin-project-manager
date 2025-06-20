import os
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent

# Paramètres de sauvegarde
BACKUP_ROOT = os.path.join(BASE_DIR, 'backups')
BACKUP_TEMP_DIR = os.path.join(BACKUP_ROOT, 'temp')
BACKUP_UPLOAD_DIR = os.path.join(BACKUP_ROOT, 'uploads')

# Discord webhook URL pour les notifications
DISCORD_WEBHOOK_URL = os.environ.get('DISCORD_WEBHOOK_URL', '')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'django_filters',
    'database',
    'conditional_fields',  # Nouvelle app pour les champs conditionnels
    'backup_manager',  # App pour la gestion des sauvegardes
] 