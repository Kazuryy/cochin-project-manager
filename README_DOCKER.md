# Guide de déploiement Docker

Ce document explique comment déployer l'application Cochin Project Manager avec Docker.

## Déploiement rapide

Pour déployer l'application, exécutez simplement la commande suivante:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Cette commande va télécharger les images depuis Docker Hub et démarrer les services.

## Configuration

Le fichier `.env` est nécessaire pour la configuration. S'il n'existe pas, créez-le avec:

```bash
cat > .env << EOF
SECRET_KEY=$(openssl rand -base64 50)
BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 32)
DISCORD_WEBHOOK_URL=
DOCKERHUB_USERNAME=votre-username-dockerhub
BACKEND_TAG=latest
FRONTEND_TAG=latest
EOF
```

## Résolution des problèmes de permissions

L'application utilise des volumes Docker pour persister les données. Si vous rencontrez des erreurs de type "permission denied", voici comment les résoudre:

### Solution automatique (recommandée)

Exécutez cette commande **avant** de démarrer les conteneurs:

```bash
mkdir -p data/{db,media,backups,logs,staticfiles}
chmod -R 777 data/
```

### Solution basée sur l'UID (plus propre)

Le conteneur utilise un utilisateur avec UID 1000. Vous pouvez aligner les permissions:

```bash
mkdir -p data/{db,media,backups,logs,staticfiles}
sudo chown -R 1000:1000 data/
```

## Commandes utiles

- **Démarrer les services**: `docker compose -f docker-compose.prod.yml up -d`
- **Arrêter les services**: `docker compose -f docker-compose.prod.yml down`
- **Voir les logs**: `docker compose -f docker-compose.prod.yml logs -f`
- **Redémarrer un service**: `docker compose -f docker-compose.prod.yml restart backend`

## Notes importantes

- L'application est configurée pour utiliser l'utilisateur avec **UID 1000** dans le conteneur
- Cette valeur correspond généralement au premier utilisateur sur les systèmes Ubuntu/Debian
- Si les permissions posent problème, utilisez `chmod 777 data/` comme solution simple 