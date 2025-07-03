# Configuration Docker

Ce dossier contient tous les fichiers liés à Docker et au déploiement, organisés de manière claire et structurée.

## 📁 Structure

```
docker/
├── compose/              # Fichiers docker-compose
│   ├── docker-compose.yml           # Configuration de base
│   ├── docker-compose.local.yml     # Développement local
│   ├── docker-compose.prod.yml      # Production avec images
│   └── deploy-minimal.yml           # Déploiement minimal
├── dockerfiles/          # Tous les Dockerfiles
│   ├── Dockerfile.backend           # Image backend Django
│   ├── Dockerfile.frontend         # Image frontend React
│   └── Dockerfile.backend.bak      # Backup du Dockerfile backend
├── config/              # Fichiers de configuration
│   ├── nginx.conf                   # Configuration Nginx
│   └── entrypoint.sh               # Script d'entrée backend
└── scripts/             # Scripts de déploiement et maintenance
    ├── deploy.sh                    # Déploiement standard
    ├── deploy-prod.sh              # Déploiement production
    ├── build-local.sh              # Build local
    ├── auto-update.sh              # Mise à jour automatique
    ├── check-updates.sh            # Vérification des mises à jour
    └── security_cleanup.sh         # Nettoyage sécurité
```

## 🚀 Utilisation

### Développement local
```bash
# Depuis la racine du projet
docker-compose -f docker/compose/docker-compose.local.yml up --build

# Ou avec le raccourci depuis la racine
docker-compose up --build
```

### Production
```bash
# Avec images pré-construites
docker-compose -f docker/compose/docker-compose.prod.yml up

# Déploiement minimal
docker-compose -f docker/compose/deploy-minimal.yml up
```

### Scripts utiles
```bash
# Build local complet
./docker/scripts/build-local.sh

# Déploiement automatisé
./docker/scripts/deploy.sh

# Vérification des mises à jour
./docker/scripts/check-updates.sh
```

## 🔧 Configuration

### Variables d'environnement
Les fichiers compose utilisent des variables d'environnement pour la configuration. Créez un fichier `.env` à la racine du projet :

```env
SECRET_KEY=votre_clé_secrète_django
BACKUP_ENCRYPTION_KEY=votre_clé_de_chiffrement
DISCORD_WEBHOOK_URL=votre_webhook_discord
```

### Personnalisation
- **Backend** : Modifiez `docker/dockerfiles/Dockerfile.backend`
- **Frontend** : Modifiez `docker/dockerfiles/Dockerfile.frontend`
- **Nginx** : Modifiez `docker/config/nginx.conf`
- **Scripts** : Ajoutez vos scripts dans `docker/scripts/`

## 📚 Documentation
Pour plus d'informations, consultez :
- [Documentation de déploiement](../docs/deployment/)
- [Guide Docker complet](../docs/deployment/README_DOCKER.md) 