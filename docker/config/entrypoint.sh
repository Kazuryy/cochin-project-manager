#!/bin/bash
set -e

echo "🚀 Démarrage de Cochin Project Manager..."

# Vérification de l'utilisateur
CURRENT_USER=$(whoami)
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)
echo "   ↳ Utilisateur: $CURRENT_USER (UID: $CURRENT_UID, GID: $CURRENT_GID)"

# Attendre que les volumes soient montés
sleep 2

# Vérification et adaptation des permissions critiques
echo "🔧 Vérification des dossiers critiques..."
CRITICAL_DIRS=("/app/logs" "/app/backups" "/app/staticfiles" "/app/media" "/app/db" "/app/data/db")

adapt_permissions() {
    local dir="$1"
    local dir_name=$(basename "$dir")
    
    echo "🔍 Analyse de $dir_name ($dir)..."
    
    # Créer le dossier s'il n'existe pas
    if [ ! -d "$dir" ]; then
        echo "   ↳ Création du dossier: $dir"
        mkdir -p "$dir" 2>/dev/null || {
            echo "   ⚠️ Impossible de créer $dir, tentative avec permissions sudo..."
            return 1
        }
    fi
    
    # Vérifier si on peut écrire
    if touch "$dir/.write_test" 2>/dev/null; then
        rm "$dir/.write_test"
        echo "   ✅ $dir - Permissions OK"
        return 0
    else
        echo "   ❌ $dir - Permissions insuffisantes"
        echo "      Détails: $(ls -ld $dir 2>/dev/null || echo 'Dossier inaccessible')"
        
        # Si ADAPTIVE_PERMISSIONS est activé, tenter de corriger
        if [ "$ADAPTIVE_PERMISSIONS" = "true" ]; then
            echo "   🔧 Mode adaptatif activé - Tentative de correction..."
            
            # Essayer de changer les permissions
            if chmod 755 "$dir" 2>/dev/null; then
                echo "   ↳ chmod 755 appliqué"
                
                # Re-tester l'écriture
                if touch "$dir/.write_test" 2>/dev/null; then
                    rm "$dir/.write_test"
                    echo "   ✅ $dir - Permissions corrigées !"
                    return 0
                fi
            fi
            
            echo "   ⚠️ Correction automatique impossible"
            echo "      SOLUTION: Sur l'hôte, exécutez: sudo chown -R $CURRENT_UID:$CURRENT_GID ./data/"
            echo "                Ou: sudo chmod -R 755 ./data/"
            return 1
        else
            echo "      SOLUTION: Sur l'hôte, exécutez: sudo chown -R $CURRENT_UID:$CURRENT_GID ./data/"
            echo "      OU: Activez le mode adaptatif avec ADAPTIVE_PERMISSIONS=true"
            return 1
        fi
    fi
}

# Vérification de tous les dossiers
failed_dirs=()
for dir in "${CRITICAL_DIRS[@]}"; do
    if ! adapt_permissions "$dir"; then
        failed_dirs+=("$dir")
    fi
done

# Si des dossiers ont échoué et qu'on n'est pas en mode adaptatif, arrêter
if [ ${#failed_dirs[@]} -gt 0 ] && [ "$ADAPTIVE_PERMISSIONS" != "true" ]; then
    echo ""
    echo "❌ ${#failed_dirs[@]} dossier(s) avec des problèmes de permissions:"
    printf '   - %s\n' "${failed_dirs[@]}"
    echo ""
    echo "💡 Solutions:"
    echo "   1. Corriger les permissions: sudo chown -R $CURRENT_UID:$CURRENT_GID ./data/"
    echo "   2. Activer le mode adaptatif: ADAPTIVE_PERMISSIONS=true"
    exit 1
elif [ ${#failed_dirs[@]} -gt 0 ]; then
    echo ""
    echo "⚠️ ${#failed_dirs[@]} dossier(s) avec des problèmes persistants:"
    printf '   - %s\n' "${failed_dirs[@]}"
    echo "   ↳ Démarrage en mode dégradé..."
fi

# Réparation de l'intégrité de la base de données
echo "🔧 Vérification de l'intégrité de la base de données..."
python manage.py shell -c "
try:
    from django.db import connection
    
    # Désactiver temporairement les vérifications de clés étrangères
    with connection.cursor() as cursor:
        cursor.execute('PRAGMA foreign_keys = OFF;')
        
        # Réparer les références cassées dans database_dynamicfield
        cursor.execute('''
            DELETE FROM database_dynamicfield 
            WHERE table_id NOT IN (SELECT id FROM database_dynamictable);
        ''')
        
        # Réactiver les vérifications
        cursor.execute('PRAGMA foreign_keys = ON;')
        
    print('✅ Réparation des références de base de données terminée')
except Exception as e:
    print(f'⚠️ Erreur lors de la réparation de la base de données: {e}')
"

# Créer les migrations manquantes si nécessaire
echo "📊 Vérification des migrations manquantes..."
python manage.py makemigrations backup_manager

# Appliquer les migrations
echo "📊 Application des migrations..."
python manage.py migrate --noinput || echo "⚠️ Des erreurs sont survenues pendant la migration mais le démarrage continue"

# Initialisation si premier démarrage
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
    echo "📊 Création des tables business..."
    python init-data/create_initial_tables.py
    
    # Créer une configuration de sauvegarde par défaut
    echo "🔧 Création de la configuration de sauvegarde par défaut..."
    python manage.py shell -c "
try:
    from backup_manager.models import BackupConfiguration
    from django.contrib.auth import get_user_model
    from django.db import OperationalError

    try:
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
    except OperationalError as e:
        print(f'⚠️ Table non disponible pour BackupConfiguration: {e}')
    except Exception as e:
        print(f'⚠️ Erreur lors de la création de la config de sauvegarde: {e}')
except Exception as e:
    print(f'⚠️ Erreur module: {e}')
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
echo "   ↳ Utilisateur final: $(whoami) ($(id))"
exec gunicorn app.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 300 \
    --max-requests 1000