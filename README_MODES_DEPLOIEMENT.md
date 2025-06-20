# 🚀 Modes de déploiement - Cochin Project Manager

Ce projet propose **deux modes de déploiement** pour s'adapter à vos besoins :

## 📦 Mode Docker Hub (recommandé pour la production)

Les images sont **automatiquement construites** par GitHub Actions et **publiées sur Docker Hub**.

### Avantages
- ✅ **Rapide** : pas de temps de compilation
- ✅ **Fiable** : images testées et validées
- ✅ **Versionné** : tags de version disponibles
- ✅ **Léger** : pas besoin du code source sur le serveur

### Utilisation
```bash
# Déploiement simple
DOCKERHUB_USERNAME=votre-username ./deploy-prod.sh

# Ou avec l'assistant interactif
./deploy.sh

# Ou en mode direct
./deploy.sh dockerhub votre-username

# Avec une version spécifique
DOCKERHUB_USERNAME=votre-username BACKEND_TAG=v1.2.0 FRONTEND_TAG=v1.2.0 ./deploy-prod.sh
```

## 🔨 Mode Images Locales (pour le développement/tests)

Les images sont **construites localement** sur votre machine à partir du code source.

### Avantages
- ✅ **Contrôle total** : vous construisez vous-même
- ✅ **Modifications locales** : testez vos changements
- ✅ **Pas de dépendance** : fonctionne sans Docker Hub
- ✅ **Debug facile** : accès complet au processus de build

### Utilisation
```bash
# 1. Construire les images
./build-local.sh

# 2. Déployer avec les images locales
MODE=local ./deploy-prod.sh

# Ou avec l'assistant interactif
./deploy.sh

# Ou en mode direct
./deploy.sh local

# Tout en une fois (build + deploy)
./build-local.sh && MODE=local ./deploy-prod.sh
```

## 🎯 Fichiers de configuration

| Fichier | Usage |
|---------|--------|
| `docker-compose.prod.yml` | Configuration pour images Docker Hub |
| `docker-compose.local.yml` | Configuration pour images locales |
| `deploy-prod.sh` | Script principal de déploiement |
| `build-local.sh` | Construction des images locales |
| `deploy.sh` | Assistant interactif simplifié |
| `check-updates.sh` | Vérification des mises à jour Docker Hub |
| `auto-update.sh` | Mise à jour semi/automatique |

## 🔄 Basculer entre les modes

### De Docker Hub vers Local
```bash
# Arrêter les services Docker Hub
DOCKERHUB_USERNAME=votre-username docker-compose -f docker-compose.prod.yml down

# Construire et déployer en local
./build-local.sh && MODE=local ./deploy-prod.sh
```

### De Local vers Docker Hub
```bash
# Arrêter les services locaux
docker-compose -f docker-compose.local.yml down

# Déployer depuis Docker Hub
DOCKERHUB_USERNAME=votre-username ./deploy-prod.sh
```

## 🛠️ Commandes utiles

### Mode Docker Hub
```bash
# Voir les logs
docker-compose -f docker-compose.prod.yml logs -f

# Mettre à jour vers une nouvelle version
BACKEND_TAG=v1.3.0 FRONTEND_TAG=v1.3.0 ./deploy-prod.sh

# Redémarrer
docker-compose -f docker-compose.prod.yml restart
```

### Mode Local
```bash
# Voir les logs
docker-compose -f docker-compose.local.yml logs -f

# Reconstruire et redéployer
./build-local.sh && MODE=local ./deploy-prod.sh

# Redémarrer
docker-compose -f docker-compose.local.yml restart
```

## 🔄 Vérification des mises à jour (Mode Docker Hub)

### Vérification manuelle
```bash
# Vérifier si des mises à jour sont disponibles
DOCKERHUB_USERNAME=votre-username ./check-updates.sh

# Le script vous indique :
# ✅ Si vos images sont à jour
# 🆕 Si des mises à jour sont disponibles  
# ⬇️ Si vous devez télécharger les images
```

### Mise à jour semi-automatique
```bash
# Vérifier ET proposer la mise à jour
DOCKERHUB_USERNAME=votre-username ./auto-update.sh

# Le script vous demande confirmation avant de mettre à jour
```

### Mise à jour automatique (pour scripts/cron)
```bash
# Mise à jour forcée sans confirmation
FORCE_UPDATE=true DOCKERHUB_USERNAME=votre-username ./auto-update.sh
```

### Vérification intégrée
Le script `deploy-prod.sh` vérifie **automatiquement** les mises à jour quand vous utilisez le tag `latest` !

## 📋 Exemples d'usage

### Développeur qui teste des modifications
```bash
# Je modifie le code, puis :
./build-local.sh
MODE=local ./deploy-prod.sh
```

### Administrateur qui déploie en production
```bash
# Je veux la dernière version stable :
DOCKERHUB_USERNAME=moncompte ./deploy-prod.sh

# Vérifier les mises à jour régulièrement :
DOCKERHUB_USERNAME=moncompte ./check-updates.sh

# Ou une version spécifique :
DOCKERHUB_USERNAME=moncompte BACKEND_TAG=v2.1.0 FRONTEND_TAG=v2.1.0 ./deploy-prod.sh
```

### Utilisateur qui découvre le projet
```bash
# Mode interactif pour choisir facilement :
./deploy.sh
```

### Maintenance automatique
```bash
# Dans un crontab pour vérification quotidienne :
# 0 9 * * * cd /path/to/project && DOCKERHUB_USERNAME=username ./check-updates.sh
```

## 🎛️ Variables d'environnement

| Variable | Description | Requis |
|----------|-------------|---------|
| `MODE` | `dockerhub` ou `local` | Optionnel (défaut: dockerhub) |
| `DOCKERHUB_USERNAME` | Votre nom d'utilisateur Docker Hub | Requis en mode dockerhub |
| `BACKEND_TAG` | Tag de l'image backend | Optionnel (défaut: latest) |
| `FRONTEND_TAG` | Tag de l'image frontend | Optionnel (défaut: latest) |

---

**🏆 Notre recommandation :**
- **Développement/tests** → Mode local
- **Production** → Mode Docker Hub 