#!/bin/bash
set -e

echo "🤖 Mise à jour automatique - Cochin Project Manager"
echo "=================================================="

# Configuration
DOCKERHUB_USERNAME=${DOCKERHUB_USERNAME:-}
FORCE_UPDATE=${FORCE_UPDATE:-false}

# Vérifier les variables requises
if [ -z "$DOCKERHUB_USERNAME" ]; then
    echo "❌ DOCKERHUB_USERNAME est requis"
    echo "Usage: DOCKERHUB_USERNAME=votre-username ./auto-update.sh"
    echo "Ou avec mise à jour forcée: FORCE_UPDATE=true DOCKERHUB_USERNAME=votre-username ./auto-update.sh"
    exit 1
fi

echo "🔍 Vérification des mises à jour pour: $DOCKERHUB_USERNAME"
echo ""

# Utiliser le script de vérification
if DOCKERHUB_USERNAME=$DOCKERHUB_USERNAME ./check-updates.sh; then
    if [ "$FORCE_UPDATE" = "true" ]; then
        echo "🔄 Mise à jour forcée demandée..."
        echo ""
        DOCKERHUB_USERNAME=$DOCKERHUB_USERNAME ./deploy-prod.sh
    else
        echo ""
        echo "✅ Aucune action nécessaire"
    fi
else
    update_exit_code=$?
    if [ $update_exit_code -eq 1 ]; then
        echo ""
        if [ "$FORCE_UPDATE" = "true" ]; then
            echo "🚀 Mise à jour automatique en cours..."
            DOCKERHUB_USERNAME=$DOCKERHUB_USERNAME ./deploy-prod.sh
        else
            echo "🤔 Souhaitez-vous mettre à jour maintenant ?"
            read -p "Confirmer la mise à jour (y/N) : " confirm
            
            if [[ $confirm =~ ^[Yy]$ ]]; then
                echo ""
                echo "🚀 Mise à jour en cours..."
                DOCKERHUB_USERNAME=$DOCKERHUB_USERNAME ./deploy-prod.sh
            else
                echo "❌ Mise à jour annulée"
                echo ""
                echo "💡 Pour mettre à jour plus tard :"
                echo "   DOCKERHUB_USERNAME=$DOCKERHUB_USERNAME ./deploy-prod.sh"
                exit 1
            fi
        fi
    else
        echo "❌ Erreur lors de la vérification des mises à jour"
        exit 1
    fi
fi

echo ""
echo "🎉 Processus de mise à jour terminé !" 