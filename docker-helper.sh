#!/bin/bash

# 🐳 Docker Helper pour Cochin Project Manager
# Script de commodité pour gérer les différentes configurations Docker

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'aide
show_help() {
    echo -e "${BLUE}🐳 Docker Helper - Cochin Project Manager${NC}"
    echo ""
    echo "Usage: $0 [COMMANDE] [OPTIONS]"
    echo ""
    echo "Commandes disponibles:"
    echo -e "  ${GREEN}dev${NC}      Démarrer en mode développement (port 1337)"
    echo -e "  ${GREEN}prod${NC}     Démarrer en mode production (images pré-construites)"
    echo -e "  ${GREEN}minimal${NC}  Déploiement minimal (port 80)"
    echo -e "  ${GREEN}build${NC}    Build les images sans démarrer"
    echo -e "  ${GREEN}stop${NC}     Arrêter tous les conteneurs"
    echo -e "  ${GREEN}clean${NC}    Nettoyer les images et conteneurs"
    echo -e "  ${GREEN}logs${NC}     Afficher les logs"
    echo -e "  ${GREEN}status${NC}   Statut des conteneurs"
    echo ""
    echo "Options:"
    echo "  -d, --detach     Démarrer en arrière-plan"
    echo "  -b, --build      Forcer le rebuild des images"
    echo "  -f, --follow     Suivre les logs en temps réel"
    echo "  -h, --help       Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0 dev              # Démarrer en développement"
    echo "  $0 dev -d           # Démarrer en développement en arrière-plan"
    echo "  $0 prod -b          # Démarrer en production avec rebuild"
    echo "  $0 logs -f          # Suivre les logs en temps réel"
}

# Fonction pour exécuter docker-compose avec le bon fichier
run_compose() {
    local compose_file=$1
    shift
    echo -e "${BLUE}📦 Exécution: docker-compose -f $compose_file $@${NC}"
    docker-compose -f "$compose_file" "$@"
}

# Variables
DETACH=""
BUILD=""
FOLLOW=""

# Parser les arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--detach)
            DETACH="-d"
            shift
            ;;
        -b|--build)
            BUILD="--build"
            shift
            ;;
        -f|--follow)
            FOLLOW="-f"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        dev)
            COMMAND="dev"
            shift
            ;;
        prod)
            COMMAND="prod"
            shift
            ;;
        minimal)
            COMMAND="minimal"
            shift
            ;;
        build)
            COMMAND="build"
            shift
            ;;
        stop)
            COMMAND="stop"
            shift
            ;;
        clean)
            COMMAND="clean"
            shift
            ;;
        logs)
            COMMAND="logs"
            shift
            ;;
        status)
            COMMAND="status"
            shift
            ;;
        *)
            echo -e "${RED}❌ Commande inconnue: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Vérifier qu'une commande a été fournie
if [[ -z "$COMMAND" ]]; then
    echo -e "${YELLOW}⚠️  Aucune commande spécifiée${NC}"
    show_help
    exit 1
fi

# Exécuter la commande
case $COMMAND in
    dev)
        echo -e "${GREEN}🚀 Démarrage en mode développement...${NC}"
        run_compose "docker/compose/docker-compose.local.yml" up $BUILD $DETACH
        if [[ -z "$DETACH" ]]; then
            echo -e "${GREEN}✅ Application disponible sur: http://localhost:1337${NC}"
        fi
        ;;
    prod)
        echo -e "${GREEN}🚀 Démarrage en mode production...${NC}"
        run_compose "docker/compose/docker-compose.prod.yml" up $BUILD $DETACH
        if [[ -z "$DETACH" ]]; then
            echo -e "${GREEN}✅ Application disponible sur: http://localhost:5050${NC}"
        fi
        ;;
    minimal)
        echo -e "${GREEN}🚀 Déploiement minimal...${NC}"
        run_compose "docker/compose/deploy-minimal.yml" up $DETACH
        if [[ -z "$DETACH" ]]; then
            echo -e "${GREEN}✅ Application disponible sur: http://localhost:80${NC}"
        fi
        ;;
    build)
        echo -e "${BLUE}🔨 Build des images...${NC}"
        run_compose "docker/compose/docker-compose.local.yml" build
        echo -e "${GREEN}✅ Build terminé${NC}"
        ;;
    stop)
        echo -e "${YELLOW}🛑 Arrêt des conteneurs...${NC}"
        docker-compose -f docker/compose/docker-compose.local.yml down 2>/dev/null || true
        docker-compose -f docker/compose/docker-compose.prod.yml down 2>/dev/null || true
        docker-compose -f docker/compose/deploy-minimal.yml down 2>/dev/null || true
        echo -e "${GREEN}✅ Conteneurs arrêtés${NC}"
        ;;
    clean)
        echo -e "${YELLOW}🧹 Nettoyage des images et conteneurs...${NC}"
        docker-compose -f docker/compose/docker-compose.local.yml down --rmi all --volumes 2>/dev/null || true
        docker-compose -f docker/compose/docker-compose.prod.yml down --rmi all --volumes 2>/dev/null || true
        docker-compose -f docker/compose/deploy-minimal.yml down --rmi all --volumes 2>/dev/null || true
        docker system prune -f
        echo -e "${GREEN}✅ Nettoyage terminé${NC}"
        ;;
    logs)
        echo -e "${BLUE}📋 Affichage des logs...${NC}"
        if docker ps --format "table {{.Names}}" | grep -q "cochin_"; then
            if [[ -n "$FOLLOW" ]]; then
                docker-compose -f docker/compose/docker-compose.local.yml logs -f 2>/dev/null || \
                docker-compose -f docker/compose/docker-compose.prod.yml logs -f 2>/dev/null || \
                docker-compose -f docker/compose/deploy-minimal.yml logs -f
            else
                docker-compose -f docker/compose/docker-compose.local.yml logs --tail=100 2>/dev/null || \
                docker-compose -f docker/compose/docker-compose.prod.yml logs --tail=100 2>/dev/null || \
                docker-compose -f docker/compose/deploy-minimal.yml logs --tail=100
            fi
        else
            echo -e "${YELLOW}⚠️  Aucun conteneur en cours d'exécution${NC}"
        fi
        ;;
    status)
        echo -e "${BLUE}📊 Statut des conteneurs:${NC}"
        docker ps --filter "name=cochin_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo -e "${BLUE}💾 Utilisation des volumes:${NC}"
        docker volume ls --filter "name=cochin" --format "table {{.Name}}\t{{.Driver}}"
        ;;
esac 