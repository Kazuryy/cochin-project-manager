#!/bin/bash

# Script de nettoyage des fichiers temporaires de sauvegarde
# Usage: ./cleanup_temp_files.sh [options]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🧹 Script de nettoyage des fichiers temporaires"
echo "📍 Répertoire de travail: $PROJECT_DIR"
echo ""

# Fonction d'aide
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --stats-only         Afficher seulement les statistiques"
    echo "  --aggressive         Nettoyage agressif (2h au lieu de 24h)"
    echo "  --max-age-hours N    Âge maximum en heures (défaut: 24)"
    echo "  --force              Pas de confirmation"
    echo "  --dry-run            Simulation du nettoyage"
    echo "  --help               Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0 --stats-only                  # Voir l'espace utilisé"
    echo "  $0 --aggressive                  # Nettoyage agressif (2h)"
    echo "  $0 --max-age-hours 6 --force     # Nettoyer fichiers > 6h sans confirmation"
    echo "  $0 --dry-run                     # Voir ce qui serait supprimé"
}

# Variables par défaut
STATS_ONLY=false
AGGRESSIVE=false
MAX_AGE_HOURS=""
FORCE=false
DRY_RUN=false

# Analyser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --stats-only)
            STATS_ONLY=true
            shift
            ;;
        --aggressive)
            AGGRESSIVE=true
            shift
            ;;
        --max-age-hours)
            MAX_AGE_HOURS="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "❌ Option inconnue: $1"
            show_help
            exit 1
            ;;
    esac
done

# Construire la commande Django
CMD="python manage.py cleanup_temp_files"

if [ "$STATS_ONLY" = true ]; then
    CMD="$CMD --stats-only"
elif [ "$DRY_RUN" = true ]; then
    CMD="$CMD --dry-run"
else
    # Commande de nettoyage normale
    if [ "$AGGRESSIVE" = true ]; then
        CMD="$CMD --aggressive"
    fi
    
    if [ -n "$MAX_AGE_HOURS" ]; then
        CMD="$CMD --max-age-hours $MAX_AGE_HOURS"
    fi
    
    if [ "$FORCE" = true ]; then
        CMD="$CMD --force"
    fi
fi

echo "🚀 Exécution: $CMD"
echo ""

# Exécuter la commande
exec $CMD 