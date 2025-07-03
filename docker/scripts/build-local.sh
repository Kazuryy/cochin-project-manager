#!/bin/bash
set -e

echo "🔨 Script de construction locale - Cochin Project Manager"
echo "========================================================"

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    echo "Installez Docker avec: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
    exit 1
fi

# Vérifier que Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé"
    echo "Installez Docker Compose avec: sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose"
    exit 1
fi

echo "🧹 Nettoyage des images existantes..."
docker rmi cochin-project-manager-backend:local 2>/dev/null || true
docker rmi cochin-project-manager-frontend:local 2>/dev/null || true

echo "🔨 Construction de l'image backend..."
docker build -t cochin-project-manager-backend:local -f Dockerfile.backend .

echo "🔨 Construction de l'image frontend..."
docker build -t cochin-project-manager-frontend:local -f Dockerfile.frontend .

echo "📦 Images construites avec succès !"
echo "  - cochin-project-manager-backend:local"
echo "  - cochin-project-manager-frontend:local"

echo ""
echo "🚀 Pour déployer avec ces images locales :"
echo "  MODE=local ./deploy-prod.sh"
echo ""
echo "📋 Autres commandes utiles :"
echo "  Voir les images       : docker images | grep cochin-project-manager"
echo "  Tester localement     : docker-compose -f docker-compose.local.yml up"
echo "  Supprimer les images  : docker rmi cochin-project-manager-backend:local cochin-project-manager-frontend:local" 