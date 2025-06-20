#!/bin/bash
#
# Script de vérification de santé du système de sauvegarde
# Ce script effectue des vérifications basiques et corrige les problèmes courants
#

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[AVERTISSEMENT]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERREUR]${NC} $1"
}

# Vérifier que le script est exécuté depuis le répertoire racine du projet
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    log_error "Ce script doit être exécuté depuis le répertoire racine du projet"
    log_info "Exemple: ./backend/scripts/backup_health_check.sh"
    exit 1
fi

# Bannière
echo "=================================================="
echo "   VÉRIFICATION DE SANTÉ DU SYSTÈME DE SAUVEGARDE"
echo "=================================================="
echo ""

# Vérifier l'existence des répertoires nécessaires
log_info "Vérification des répertoires..."

# Répertoire de sauvegarde
if [ ! -d "backend/backups" ]; then
    log_warning "Répertoire de sauvegarde manquant"
    read -p "Créer le répertoire de sauvegarde ? (o/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        mkdir -p backend/backups
        mkdir -p backend/backups/temp
        chmod -R 755 backend/backups
        log_info "Répertoire de sauvegarde créé"
    fi
else
    log_info "Répertoire de sauvegarde existant: OK"
    
    # Vérifier les permissions
    if [ ! -w "backend/backups" ]; then
        log_warning "Permissions insuffisantes sur le répertoire de sauvegarde"
        read -p "Corriger les permissions ? (o/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Oo]$ ]]; then
            chmod -R 755 backend/backups
            log_info "Permissions corrigées"
        fi
    fi
fi

# Vérifier l'espace disque
log_info "Vérification de l'espace disque..."
df_output=$(df -h . | tail -n 1)
available=$(echo $df_output | awk '{print $4}')
use_percent=$(echo $df_output | awk '{print $5}')

if [[ $use_percent == *"9"* ]] || [[ $use_percent == "100%" ]]; then
    log_error "Espace disque critique: $available disponible ($use_percent utilisé)"
elif [[ $use_percent == *"8"* ]]; then
    log_warning "Espace disque faible: $available disponible ($use_percent utilisé)"
else
    log_info "Espace disque suffisant: $available disponible ($use_percent utilisé)"
fi

# Vérifier l'environnement virtuel Python
log_info "Vérification de l'environnement Python..."
if [ -d "venv" ] || [ -d "env" ]; then
    log_info "Environnement virtuel détecté: OK"
else
    log_warning "Aucun environnement virtuel détecté"
    log_info "Conseil: Créez un environnement virtuel avec 'python -m venv venv'"
fi

# Vérifier les opérations bloquées
log_info "Vérification des opérations bloquées..."
echo "Cette opération nécessite Django. Continuer ? (o/n)"
read -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
    # Activer l'environnement virtuel si présent
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    elif [ -f "env/bin/activate" ]; then
        source env/bin/activate
    fi
    
    # Exécuter la commande de nettoyage
    cd backend
    python manage.py cleanup_stuck_operations --hours 6
    cd ..
fi

# Vérifier les fichiers temporaires
log_info "Vérification des fichiers temporaires..."
temp_files=$(find backend/backups/temp -type f 2>/dev/null | wc -l)
if [ "$temp_files" -gt 0 ]; then
    log_warning "$temp_files fichier(s) temporaire(s) trouvé(s)"
    read -p "Nettoyer les fichiers temporaires ? (o/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        # Nettoyage sécurisé des fichiers temporaires
        if [ -d "backend/backups/temp" ]; then
            find backend/backups/temp -type f -mtime +1 -exec rm -f {} \;
            find backend/backups/temp -type d -empty -delete 2>/dev/null || true
            log_info "Fichiers temporaires nettoyés de façon sécurisée"
        else
            log_warning "Répertoire temp non trouvé"
        fi
    fi
else
    log_info "Aucun fichier temporaire: OK"
fi

# Vérifier les logs
log_info "Vérification des logs..."
if [ ! -d "backend/logs" ]; then
    log_warning "Répertoire de logs manquant"
    read -p "Créer le répertoire de logs ? (o/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        mkdir -p backend/logs
        chmod 755 backend/logs
        log_info "Répertoire de logs créé"
    fi
else
    # Vérifier la taille des logs
    log_size=$(du -sh backend/logs 2>/dev/null | cut -f1)
    log_info "Taille des logs: $log_size"
    
    # Vérifier si les logs sont trop volumineux
    log_size_bytes=$(du -s backend/logs 2>/dev/null | cut -f1)
    if [ "$log_size_bytes" -gt 100000 ]; then  # ~100MB
        log_warning "Les logs sont volumineux"
        read -p "Archiver les anciens logs ? (o/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Oo]$ ]]; then
            timestamp=$(date +"%Y%m%d_%H%M%S")
            mkdir -p backend/logs/archives
            for log_file in backend/logs/*.log; do
                if [ -f "$log_file" ]; then
                    base_name=$(basename "$log_file")
                    cp "$log_file" "backend/logs/archives/${base_name}_${timestamp}"
                    echo "" > "$log_file"
                fi
            done
            log_info "Logs archivés"
        fi
    fi
fi

# Vérifier les dépendances
log_info "Vérification des dépendances..."
dependencies=("sqlite3" "zip" "openssl")
missing=0

for dep in "${dependencies[@]}"; do
    if ! command -v $dep &> /dev/null; then
        log_warning "Dépendance manquante: $dep"
        missing=$((missing + 1))
    fi
done

if [ $missing -eq 0 ]; then
    log_info "Toutes les dépendances sont installées: OK"
else
    log_warning "$missing dépendance(s) manquante(s)"
fi

# Vérifier la configuration Django
log_info "Vérification de la configuration Django..."
if [ -f "backend/app/settings.py" ]; then
    # Vérifier si DEBUG est activé en production
    debug_mode=$(grep -c "DEBUG = True" backend/app/settings.py)
    if [ "$debug_mode" -gt 0 ]; then
        log_warning "Mode DEBUG activé dans settings.py"
        log_info "Conseil: Désactivez le mode DEBUG en production"
    else
        log_info "Mode DEBUG correctement configuré: OK"
    fi
    
    # Vérifier la configuration de sauvegarde
    backup_config=$(grep -c "BACKUP_ROOT" backend/app/settings.py)
    if [ "$backup_config" -eq 0 ]; then
        log_warning "Configuration BACKUP_ROOT non trouvée dans settings.py"
        log_info "Conseil: Ajoutez BACKUP_ROOT dans settings.py pour personnaliser le chemin de sauvegarde"
    else
        log_info "Configuration BACKUP_ROOT trouvée: OK"
    fi
else
    log_warning "Fichier settings.py non trouvé à l'emplacement attendu"
fi

# Résumé et recommandations
echo ""
echo "=================================================="
echo "                     RÉSUMÉ                       "
echo "=================================================="
echo ""
echo "Vérifications terminées. Recommandations:"
echo ""
echo "1. Exécutez régulièrement 'python manage.py cleanup_stuck_operations'"
echo "2. Vérifiez l'espace disque disponible régulièrement"
echo "3. Archivez ou supprimez les anciennes sauvegardes inutiles"
echo "4. Consultez les logs pour détecter les problèmes récurrents"
echo ""
echo "Pour une vérification complète du système de sauvegarde:"
echo "cd backend && python manage.py check_backup_system"
echo ""

log_info "Script terminé"
exit 0 