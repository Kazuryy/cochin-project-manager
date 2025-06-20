#!/bin/bash
set -e

echo "🚀 Assistant de déploiement - Cochin Project Manager"
echo "==================================================="

# Si des arguments sont fournis, les utiliser directement
if [ $# -gt 0 ]; then
    if [ "$1" = "local" ]; then
        MODE=local ./deploy-prod.sh
    elif [ "$1" = "dockerhub" ]; then
        if [ -z "$2" ]; then
            echo "❌ Nom d'utilisateur Docker Hub requis"
            echo "Usage: ./deploy.sh dockerhub votre-username"
            exit 1
        fi
        DOCKERHUB_USERNAME=$2 MODE=dockerhub ./deploy-prod.sh
    else
        echo "❌ Mode invalide: $1"
        echo "Usage: ./deploy.sh [local|dockerhub] [username]"
        exit 1
    fi
    exit 0
fi

# Mode interactif
echo ""
echo "Choisissez votre mode de déploiement :"
echo "1) Images locales (construites sur cette machine)"
echo "2) Images Docker Hub (téléchargées depuis le registry)"
echo ""
read -p "Votre choix (1 ou 2) : " choice

case $choice in
    1)
        echo ""
        echo "🔍 Vérification des images locales..."
        if ! docker images | grep -q "cochin-project-manager-backend.*local"; then
            echo "❌ Images locales introuvables"
            echo ""
            read -p "Voulez-vous les construire maintenant ? (y/N) : " build_choice
            if [[ $build_choice =~ ^[Yy]$ ]]; then
                ./build-local.sh
                if [ $? -eq 0 ]; then
                    echo ""
                    echo "✅ Construction terminée, lancement du déploiement..."
                    MODE=local ./deploy-prod.sh
                else
                    echo "❌ Erreur lors de la construction"
                    exit 1
                fi
            else
                echo "Construisez d'abord les images avec: ./build-local.sh"
                exit 1
            fi
        else
            echo "✅ Images locales trouvées"
            MODE=local ./deploy-prod.sh
        fi
        ;;
    2)
        echo ""
        read -p "Nom d'utilisateur Docker Hub : " username
        if [ -z "$username" ]; then
            echo "❌ Nom d'utilisateur requis"
            exit 1
        fi
        DOCKERHUB_USERNAME=$username MODE=dockerhub ./deploy-prod.sh
        ;;
    *)
        echo "❌ Choix invalide"
        exit 1
        ;;
esac

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
mkdir -p init-data

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
EOF
    echo "✅ Fichier .env créé"
else
    echo "✅ Fichier .env existe déjà"
fi

# Vérifier les permissions
echo "🔒 Configuration des permissions..."
chmod +x entrypoint.sh
chmod +x init-data/create_initial_tables.py
sudo chown -R $USER:$USER data/

# Construire et démarrer
echo "🏗️  Construction des images Docker..."
docker-compose build

echo "🚀 Démarrage des services..."
docker-compose up -d

# Attendre que les services soient prêts
echo "⏳ Attente du démarrage des services..."
sleep 30

# Vérifier l'état
echo "🔍 Vérification de l'état des services..."
docker-compose ps

# Tests
echo "🧪 Tests de connectivité..."
if curl -s http://project-manager.local > /dev/null; then
    echo "✅ Application accessible sur http://project-manager.local"
else
    echo "⚠️  Application non accessible, vérifiez les logs: docker-compose logs"
fi

echo ""
echo "🎉 Déploiement terminé !"
echo "================================================"
echo "📱 Interface principale : http://project-manager.local"
echo "🔧 Administration      : http://project-manager.local/admin"
echo "👤 Identifiants admin  : admin / changeme"
echo ""
echo "📋 Commandes utiles :"
echo "  Voir les logs       : docker-compose logs -f"
echo "  Redémarrer          : docker-compose restart"
echo "  Arrêter             : docker-compose down"
echo "  Shell Django        : docker-compose exec backend python manage.py shell"
echo "  Sauvegarde manuelle : docker-compose exec backend python manage.py run_backup --all"
echo "" 