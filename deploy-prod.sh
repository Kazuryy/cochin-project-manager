#!/bin/bash
set -e

echo "🚀 Script de déploiement PRODUCTION - Cochin Project Manager"
echo "============================================================"

# Configuration par défaut
MODE=${MODE:-dockerhub}  # dockerhub ou local
DOCKERHUB_USERNAME=${DOCKERHUB_USERNAME:-}
BACKEND_TAG=${BACKEND_TAG:-latest}
FRONTEND_TAG=${FRONTEND_TAG:-latest}

# Afficher le mode de déploiement
echo "📦 Mode de déploiement : $MODE"
if [ "$MODE" = "local" ]; then
    echo "   → Utilisation des images construites localement"
    COMPOSE_FILE="docker-compose.local.yml"
elif [ "$MODE" = "dockerhub" ]; then
    echo "   → Utilisation des images Docker Hub"
    COMPOSE_FILE="docker-compose.prod.yml"
else
    echo "❌ MODE invalide. Utilisez 'local' ou 'dockerhub'"
    echo "Exemples :"
    echo "  MODE=local ./deploy-prod.sh"
    echo "  MODE=dockerhub DOCKERHUB_USERNAME=votre-username ./deploy-prod.sh"
    exit 1
fi

# Vérifier les variables requises selon le mode
if [ "$MODE" = "dockerhub" ] && [ -z "$DOCKERHUB_USERNAME" ]; then
    echo "❌ DOCKERHUB_USERNAME est requis en mode dockerhub"
    echo "Utilisation: DOCKERHUB_USERNAME=votre-username ./deploy-prod.sh"
    echo "Ou utilisez le mode local: MODE=local ./deploy-prod.sh"
    exit 1
fi

if [ "$MODE" = "local" ]; then
    echo "🔍 Vérification des images locales..."
    if ! docker images | grep -q "cochin-project-manager-backend.*local"; then
        echo "❌ Image backend locale introuvable"
        echo "Construisez d'abord les images avec: ./build-local.sh"
        exit 1
    fi
    if ! docker images | grep -q "cochin-project-manager-frontend.*local"; then
        echo "❌ Image frontend locale introuvable"
        echo "Construisez d'abord les images avec: ./build-local.sh"
        exit 1
    fi
    echo "✅ Images locales trouvées"
fi

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Installation..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installé"
fi

# Vérifier que Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé. Installation..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installé"
fi

# Créer la structure des dossiers
echo "📁 Création de la structure des dossiers..."
mkdir -p data/{db,media,backups,logs,staticfiles}

# Configurer le DNS local
echo "🌐 Configuration du DNS local..."
if ! grep -q "project-manager.local" /etc/hosts; then
    echo "127.0.0.1 project-manager.local" | sudo tee -a /etc/hosts
    echo "✅ DNS local configuré"
else
    echo "✅ DNS local déjà configuré"
fi

# Créer le fichier .env s'il n'existe pas
if [ ! -f .env ]; then
    echo "🔑 Génération des clés de sécurité..."
    cat > .env << EOF
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
BACKUP_ENCRYPTION_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
DISCORD_WEBHOOK_URL=
DOCKERHUB_USERNAME=${DOCKERHUB_USERNAME}
BACKEND_TAG=${BACKEND_TAG}
FRONTEND_TAG=${FRONTEND_TAG}
EOF
    echo "✅ Fichier .env créé"
else
    echo "✅ Fichier .env existe, mise à jour des tags..."
    # Mettre à jour les variables dans le .env existant
    if grep -q "DOCKERHUB_USERNAME=" .env; then
        sed -i "s/DOCKERHUB_USERNAME=.*/DOCKERHUB_USERNAME=${DOCKERHUB_USERNAME}/" .env
    else
        echo "DOCKERHUB_USERNAME=${DOCKERHUB_USERNAME}" >> .env
    fi
    
    if grep -q "BACKEND_TAG=" .env; then
        sed -i "s/BACKEND_TAG=.*/BACKEND_TAG=${BACKEND_TAG}/" .env
    else
        echo "BACKEND_TAG=${BACKEND_TAG}" >> .env
    fi
    
    if grep -q "FRONTEND_TAG=" .env; then
        sed -i "s/FRONTEND_TAG=.*/FRONTEND_TAG=${FRONTEND_TAG}/" .env
    else
        echo "FRONTEND_TAG=${FRONTEND_TAG}" >> .env
    fi
fi

# Vérifier les permissions
echo "🔒 Configuration des permissions..."
mkdir -p data/{db,media,backups,logs,staticfiles}

# Option 1: Permissions simples compatibles partout (chmod 777)
if [ "$1" = "--secure" ]; then
  echo "   ↳ Application de permissions sécurisées (uniquement UID 1000)..."
  sudo chown -R 1000:1000 data/
  sudo chmod -R 755 data/
  echo "   ✅ Permissions configurées pour l'utilisateur avec UID 1000 uniquement"
else
  echo "   ↳ Application de permissions universelles (chmod 777)..."
  chmod -R 777 data/
  echo "   ✅ Permissions 777 appliquées (tout le monde peut lire/écrire)"
fi

echo "   ↳ Vérification des permissions actuelles:"
ls -la data/

# Arrêter les services existants
echo "🛑 Arrêt des services existants..."
docker-compose -f $COMPOSE_FILE down 2>/dev/null || true

if [ "$MODE" = "dockerhub" ]; then
    # Vérifier les mises à jour disponibles (seulement pour le tag latest)
    if [ "$BACKEND_TAG" = "latest" ] && [ "$FRONTEND_TAG" = "latest" ]; then
        echo "🔍 Vérification des mises à jour disponibles..."
        
        # Fonction pour obtenir le digest distant
        get_remote_digest() {
            local image=$1
            docker manifest inspect ${DOCKERHUB_USERNAME}/${image}:latest 2>/dev/null | grep -E '"digest".*"sha256:' | head -1 | sed 's/.*"sha256:\([^"]*\)".*/\1/' || echo "unavailable"
        }
        
        # Fonction pour obtenir le digest local
        get_local_digest() {
            local image=$1
            docker images --digests ${DOCKERHUB_USERNAME}/${image}:latest --format "table {{.Digest}}" | tail -1 | sed 's/sha256://' 2>/dev/null || echo "not_found"
        }
        
        # Vérifier backend
        backend_remote=$(get_remote_digest "cochin-project-manager-backend")
        backend_local=$(get_local_digest "cochin-project-manager-backend")
        
        # Vérifier frontend  
        frontend_remote=$(get_remote_digest "cochin-project-manager-frontend")
        frontend_local=$(get_local_digest "cochin-project-manager-frontend")
        
        updates_found=false
        
        if [ "$backend_remote" != "unavailable" ] && [ "$backend_remote" != "$backend_local" ] && [ "$backend_local" != "not_found" ]; then
            echo "  🆕 Nouvelle version backend disponible !"
            updates_found=true
        fi
        
        if [ "$frontend_remote" != "unavailable" ] && [ "$frontend_remote" != "$frontend_local" ] && [ "$frontend_local" != "not_found" ]; then
            echo "  🆕 Nouvelle version frontend disponible !"
            updates_found=true
        fi
        
        if [ "$updates_found" = true ]; then
            echo "  ✅ Des mises à jour seront téléchargées"
        elif [ "$backend_local" != "not_found" ] && [ "$frontend_local" != "not_found" ]; then
            echo "  ✅ Images déjà à jour"
        fi
    fi
    
    # Télécharger les images depuis Docker Hub
    echo "📦 Téléchargement des images Docker Hub..."
    echo "  - Backend: ${DOCKERHUB_USERNAME}/cochin-project-manager-backend:${BACKEND_TAG}"
    echo "  - Frontend: ${DOCKERHUB_USERNAME}/cochin-project-manager-frontend:${FRONTEND_TAG}"
    docker-compose -f $COMPOSE_FILE pull
elif [ "$MODE" = "local" ]; then
    # Construire les images localement si nécessaire
    echo "🔨 Construction/mise à jour des images locales..."
    docker-compose -f $COMPOSE_FILE build --no-cache
fi

# Démarrer les services
echo "🚀 Démarrage des services..."
docker-compose -f $COMPOSE_FILE up -d

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 45

# Vérifier l'état
echo "🔍 Vérification de l'état des services..."
docker-compose -f $COMPOSE_FILE ps

# Tests de connectivité
echo "🧪 Tests de connectivité..."
sleep 15

if curl -s http://project-manager.local > /dev/null; then
    echo "✅ Application accessible sur http://project-manager.local"
else
    echo "⚠️  Application non accessible, vérifiez les logs: docker-compose -f $COMPOSE_FILE logs"
fi

# Vérifier la santé des services
echo "🏥 Vérification de la santé des services..."
docker-compose -f $COMPOSE_FILE ps --filter "health=healthy" --quiet | wc -l | xargs -I {} echo "Services en bonne santé: {}"

echo ""
echo "🎉 Déploiement PRODUCTION terminé !"
echo "============================================================"
echo "📱 Interface principale : http://project-manager.local"
echo "🔧 Administration      : http://project-manager.local/admin"
echo "👤 Identifiants admin  : admin / changeme"
echo ""
if [ "$MODE" = "dockerhub" ]; then
    echo "📊 Images Docker Hub utilisées :"
    echo "  - Backend : ${DOCKERHUB_USERNAME}/cochin-project-manager-backend:${BACKEND_TAG}"
    echo "  - Frontend: ${DOCKERHUB_USERNAME}/cochin-project-manager-frontend:${FRONTEND_TAG}"
elif [ "$MODE" = "local" ]; then
    echo "📊 Images locales utilisées :"
    echo "  - Backend : cochin-project-manager-backend:local"
    echo "  - Frontend: cochin-project-manager-frontend:local"
fi
echo ""
echo "📋 Commandes utiles :"
echo "  Voir les logs       : docker-compose -f $COMPOSE_FILE logs -f"
echo "  Redémarrer          : docker-compose -f $COMPOSE_FILE restart"
echo "  Arrêter             : docker-compose -f $COMPOSE_FILE down"
if [ "$MODE" = "dockerhub" ]; then
    echo "  Mettre à jour       : BACKEND_TAG=v1.1.0 FRONTEND_TAG=v1.1.0 ./deploy-prod.sh"
    echo "  Changer pour local  : MODE=local ./deploy-prod.sh"
elif [ "$MODE" = "local" ]; then
    echo "  Reconstruire        : ./build-local.sh && MODE=local ./deploy-prod.sh"
    echo "  Changer pour Docker : MODE=dockerhub DOCKERHUB_USERNAME=username ./deploy-prod.sh"
fi
echo "" 