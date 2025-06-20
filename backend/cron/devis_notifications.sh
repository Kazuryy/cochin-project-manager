#!/bin/bash
# Script cron pour vérifier quotidiennement les notifications de devis à envoyer
# Recommandé à exécuter une fois par jour (ex: à 8h du matin)
# Exemple crontab: 0 8 * * * /chemin/vers/backend/cron/devis_notifications.sh > /chemin/vers/devis_notifs.log 2>&1

# Chemin du script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}/.."

# Activer l'environnement virtuel si nécessaire
if [ -d "../venv" ]; then
    source ../venv/bin/activate
fi

# Exécuter la commande Django
echo "$(date '+%Y-%m-%d %H:%M:%S') - Vérification des notifications de devis..."
python manage.py check_devis_notifications

# Enregistrer le statut
STATUS=$?
if [ $STATUS -eq 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Vérification terminée avec succès."
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ERREUR: La vérification a échoué avec le code $STATUS."
fi

# Désactiver l'environnement virtuel si nécessaire
if [ -d "../venv" ]; then
    deactivate
fi

exit $STATUS 