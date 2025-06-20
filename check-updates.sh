#!/bin/bash
set -e

echo "🔍 Vérification des mises à jour - Cochin Project Manager"
echo "========================================================"

# Configuration
DOCKERHUB_USERNAME=${DOCKERHUB_USERNAME:-}
BACKEND_IMAGE="cochin-project-manager-backend"
FRONTEND_IMAGE="cochin-project-manager-frontend"

# Vérifier les variables requises
if [ -z "$DOCKERHUB_USERNAME" ]; then
    echo "❌ DOCKERHUB_USERNAME est requis"
    echo "Usage: DOCKERHUB_USERNAME=votre-username ./check-updates.sh"
    exit 1
fi

echo "🐳 Vérification pour l'utilisateur Docker Hub: $DOCKERHUB_USERNAME"
echo ""

# Fonction pour obtenir le digest d'une image
get_remote_digest() {
    local image=$1
    docker manifest inspect ${DOCKERHUB_USERNAME}/${image}:latest 2>/dev/null | grep -E '"digest".*"sha256:' | head -1 | sed 's/.*"sha256:\([^"]*\)".*/\1/' || echo "unavailable"
}

get_local_digest() {
    local image=$1
    docker images --digests ${DOCKERHUB_USERNAME}/${image}:latest --format "table {{.Digest}}" | tail -1 | sed 's/sha256://' || echo "not_found"
}

# Fonction pour vérifier une image
check_image_update() {
    local image=$1
    local name=$2
    
    echo "🔍 Vérification $name..."
    
    # Obtenir les digests
    local remote_digest=$(get_remote_digest $image)
    local local_digest=$(get_local_digest $image)
    
    if [ "$remote_digest" = "unavailable" ]; then
        echo "  ❌ Impossible de vérifier l'image distante (image inexistante ou problème réseau)"
        return 1
    fi
    
    if [ "$local_digest" = "not_found" ] || [ "$local_digest" = "<none>" ]; then
        echo "  ⬇️  Image locale non trouvée - téléchargement requis"
        echo "      Image distante: sha256:${remote_digest:0:12}..."
        return 2
    fi
    
    if [ "$remote_digest" = "$local_digest" ]; then
        echo "  ✅ À jour (sha256:${local_digest:0:12}...)"
        return 0
    else
        echo "  🆕 Mise à jour disponible !"
        echo "      Local:   sha256:${local_digest:0:12}..."
        echo "      Distant: sha256:${remote_digest:0:12}..."
        return 3
    fi
}

# Vérifier les deux images
backend_status=0
frontend_status=0

check_image_update $BACKEND_IMAGE "Backend"
backend_status=$?

echo ""

check_image_update $FRONTEND_IMAGE "Frontend" 
frontend_status=$?

echo ""
echo "📊 Résumé :"

updates_available=false

if [ $backend_status -eq 3 ] || [ $backend_status -eq 2 ]; then
    echo "  🔄 Backend: Mise à jour disponible"
    updates_available=true
elif [ $backend_status -eq 0 ]; then
    echo "  ✅ Backend: À jour"
else
    echo "  ❌ Backend: Erreur de vérification"
fi

if [ $frontend_status -eq 3 ] || [ $frontend_status -eq 2 ]; then
    echo "  🔄 Frontend: Mise à jour disponible"  
    updates_available=true
elif [ $frontend_status -eq 0 ]; then
    echo "  ✅ Frontend: À jour"
else
    echo "  ❌ Frontend: Erreur de vérification"
fi

echo ""

if [ "$updates_available" = true ]; then
    echo "🚀 MISES À JOUR DISPONIBLES !"
    echo ""
    echo "Pour mettre à jour :"
    echo "  DOCKERHUB_USERNAME=$DOCKERHUB_USERNAME ./deploy-prod.sh"
    echo ""
    echo "Ou avec le mode interactif :"
    echo "  ./deploy.sh"
    exit 1
else
    echo "🎉 Toutes vos images sont à jour !"
    exit 0
fi 