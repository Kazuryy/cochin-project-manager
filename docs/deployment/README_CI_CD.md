# 🔄 Guide CI/CD - GitHub Actions + Docker Hub

Ce guide explique comment configurer le pipeline CI/CD pour automatiser le build et le déploiement des images Docker.

## 🎯 Architecture CI/CD

```
Code Push → GitHub Actions → Build Images → Push Docker Hub → Deploy Production
```

## 1️⃣ **Configuration Docker Hub**

### Créer un compte Docker Hub
1. Aller sur [https://hub.docker.com](https://hub.docker.com)
2. Créer un compte ou se connecter
3. Noter votre **username Docker Hub**

### Créer un Access Token
1. Aller dans **Account Settings** → **Security**
2. Cliquer sur **New Access Token**
3. Nom : `github-actions-cochin`
4. Permissions : **Read, Write, Delete**
5. **Copier le token généré** (ne sera plus visible après)

## 2️⃣ **Configuration GitHub Secrets**

Dans votre repo GitHub, aller dans **Settings** → **Secrets and variables** → **Actions**

Ajouter ces secrets :

| Secret | Valeur | Description |
|--------|--------|-------------|
| `DOCKERHUB_USERNAME` | `votre-username` | Votre nom d'utilisateur Docker Hub |
| `DOCKERHUB_TOKEN` | `dckr_pat_...` | Token d'accès Docker Hub |

## 3️⃣ **Workflow GitHub Actions**

Le fichier `.github/workflows/docker-build-push.yml` est déjà configuré. Il se déclenche sur :

- **Push sur `main`** → Build et push avec tag `latest`
- **Push sur `production`** → Build et push avec tag `production`
- **Tag `v*`** → Build et push avec tag version (ex: `v1.0.0`)
- **Pull Requests** → Build seulement (test)

### Tags Automatiques
- `latest` → Branche main
- `production` → Branche production  
- `v1.0.0` → Tag git v1.0.0
- `main` → Push sur branche main
- `pr-123` → Pull Request #123

## 4️⃣ **Déploiement Production**

### Images Disponibles

Après le premier push, vos images seront disponibles sur :
- `votre-username/cochin-project-manager-backend:latest`
- `votre-username/cochin-project-manager-frontend:latest`

### Déploiement Manuel

```bash
# Déploiement avec images latest
DOCKERHUB_USERNAME=votre-username ./deploy-prod.sh

# Déploiement avec version spécifique
DOCKERHUB_USERNAME=votre-username \
BACKEND_TAG=v1.0.0 \
FRONTEND_TAG=v1.0.0 \
./deploy-prod.sh
```

### Déploiement Automatique

Vous pouvez créer un webhook ou un script pour déployer automatiquement :

```bash
#!/bin/bash
# deploy-auto.sh
cd /path/to/your/project
git pull
DOCKERHUB_USERNAME=votre-username ./deploy-prod.sh
```

## 5️⃣ **Workflow de Développement**

### Pour une nouvelle feature
```bash
# Créer une branche
git checkout -b feature/nouvelle-fonctionnalite

# Développer...
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin feature/nouvelle-fonctionnalite

# Créer une Pull Request
# → GitHub Actions va builder les images pour tests
```

### Pour un déploiement
```bash
# Merger dans main
git checkout main
git merge feature/nouvelle-fonctionnalite
git push origin main

# → GitHub Actions build et push automatiquement
# → Images disponibles avec tag "latest"
```

### Pour une release
```bash
# Créer un tag de version
git tag v1.0.0
git push origin v1.0.0

# → GitHub Actions build et push avec tag "v1.0.0"
# → Déployable avec BACKEND_TAG=v1.0.0
```

## 6️⃣ **Monitoring des Builds**

### GitHub Actions
- Aller dans l'onglet **Actions** de votre repo
- Voir l'état des builds en temps réel
- Télécharger les logs en cas d'erreur

### Docker Hub
- Voir vos images sur [hub.docker.com](https://hub.docker.com)
- Vérifier les tags disponibles
- Voir les statistiques de téléchargement

## 7️⃣ **Commandes Utiles**

### Vérifier les images locales
```bash
# Lister les images locales
docker images | grep cochin-project-manager

# Supprimer les images locales
docker rmi votre-username/cochin-project-manager-backend:latest
docker rmi votre-username/cochin-project-manager-frontend:latest
```

### Debugging
```bash
# Voir les logs GitHub Actions
gh run list
gh run view [RUN_ID]

# Tester le build localement
docker buildx build -f Dockerfile.backend -t test-backend .
docker buildx build -f Dockerfile.frontend -t test-frontend .
```

### Gestion des versions
```bash
# Lister les tags Git
git tag -l

# Supprimer un tag
git tag -d v1.0.0
git push origin --delete v1.0.0

# Créer une release GitHub
gh release create v1.0.0 --title "Version 1.0.0" --notes "Première version stable"
```

## 8️⃣ **Avantages de cette Approche**

✅ **Déploiement rapide** : Plus besoin de builder sur le serveur  
✅ **Images optimisées** : Build cache et optimisations GitHub  
✅ **Versions tracées** : Chaque version est taggée et disponible  
✅ **Rollback facile** : Redéployer une version antérieure  
✅ **Tests automatiques** : Build testé avant push  
✅ **Sécurité** : Images buildées dans un environnement contrôlé  

## 9️⃣ **Mise à Jour du README_DEPLOIEMENT.md**

Après configuration, mettre à jour la section déploiement :

```bash
# Au lieu de ./deploy.sh
DOCKERHUB_USERNAME=votre-username ./deploy-prod.sh
```

## 🚀 **Prêt !**

Maintenant, à chaque push sur `main`, vos images sont automatiquement buildées et mises à disposition sur Docker Hub ! 

Le déploiement devient ultra rapide : plus besoin de builder, juste télécharger et lancer ! 🎉 