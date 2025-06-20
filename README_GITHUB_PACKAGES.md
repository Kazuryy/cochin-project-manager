# 📦 **GitHub Packages - Guide d'utilisation**

## 🎯 **Qu'est-ce que GitHub Container Registry (ghcr.io) ?**

GitHub Container Registry est le service de registry de conteneurs Docker intégré à GitHub. Il permet de stocker, gérer et distribuer vos images Docker directement depuis votre repository GitHub.

## ✅ **Avantages de la double publication (Docker Hub + GitHub Packages)**

### **1. 🔄 Redondance et disponibilité**
- Images disponibles sur **2 registries** différents
- Si l'un est en panne, l'autre reste accessible
- **Meilleure fiabilité** pour vos déploiements

### **2. 🔐 Sécurité renforcée** 
- GitHub Packages utilise les **permissions GitHub natives**
- Contrôle d'accès granulaire via équipes/organisations
- Audit des accès intégré

### **3. 💰 Coûts optimisés**
- GitHub Container Registry **gratuit** pour repos publics
- Pas de limitation de bande passante sur les repos publics
- Docker Hub gratuit mais avec des limitations

### **4. 🔗 Intégration native**
- Images liées directement au **code source**
- Visibilité des packages dans l'interface GitHub
- Traçabilité commit → image facilitée

## 📦 **Images publiées automatiquement**

Votre projet publie maintenant sur **2 registries** :

### **Docker Hub** (registry existant)
```bash
# Backend
docker pull ronanjacques/cochin-project-manager-backend:latest

# Frontend  
docker pull ronanjacques/cochin-project-manager-frontend:latest
```

### **GitHub Container Registry** (nouveau)
```bash
# Backend
docker pull ghcr.io/ronanjacques/cochin-project-manager/backend:latest

# Frontend
docker pull ghcr.io/ronanjacques/cochin-project-manager/frontend:latest
```

## 🚀 **Utilisation des packages GitHub**

### **1. Pull d'images depuis GitHub Packages**
```bash
# Authentification (une seule fois)
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull des images
docker pull ghcr.io/ronanjacques/cochin-project-manager/backend:v1.0.0
docker pull ghcr.io/ronanjacques/cochin-project-manager/frontend:v1.0.0
```

### **2. Modification des docker-compose pour utiliser GitHub Packages**
```yaml
# docker-compose.github.yml
version: '3.8'

services:
  backend:
    image: ghcr.io/ronanjacques/cochin-project-manager/backend:${BACKEND_TAG:-latest}
    # ... rest of config

  frontend:
    image: ghcr.io/ronanjacques/cochin-project-manager/frontend:${FRONTEND_TAG:-latest}
    # ... rest of config
```

### **3. Déploiement avec les packages GitHub**
```bash
# Utiliser GitHub packages au lieu de Docker Hub
GHCR_REGISTRY=ghcr.io
BACKEND_IMAGE=ghcr.io/ronanjacques/cochin-project-manager/backend
FRONTEND_IMAGE=ghcr.io/ronanjacques/cochin-project-manager/frontend

docker-compose -f docker-compose.github.yml up -d
```

## 🔍 **Gestion des packages dans GitHub**

### **Visibilité des packages**
1. Allez sur votre repository GitHub
2. Cliquez sur l'onglet **"Packages"** 
3. Vous verrez vos images Docker avec :
   - **Tags disponibles**
   - **Taille des images**
   - **Date de publication**
   - **Informations de sécurité**

### **Gestion des permissions**
```bash
# Rendre un package public
gh api --method PATCH /orgs/ORG/packages/container/PACKAGE_NAME \
  --field visibility=public

# Rendre un package privé  
gh api --method PATCH /orgs/ORG/packages/container/PACKAGE_NAME \
  --field visibility=private
```

## 🛡️ **Sécurité et bonnes pratiques**

### **1. Token d'authentification**
```bash
# Créer un Personal Access Token avec les scopes :
# - read:packages
# - write:packages
# - delete:packages (si nécessaire)

# Utilisation recommandée
export GITHUB_TOKEN="your_token_here"
echo $GITHUB_TOKEN | docker login ghcr.io -u your-username --password-stdin
```

### **2. Scan de sécurité automatique**
GitHub Packages inclut :
- **Vulnerability scanning** automatique
- **Security advisories** pour les CVE détectées
- **Dependency insights** 

### **3. Nettoyage automatique**
```bash
# Script de nettoyage des anciens packages
gh api --method GET /orgs/ORG/packages/container/PACKAGE/versions \
  --jq '.[] | select(.metadata.created_at < "2023-01-01") | .id' \
  | xargs -I {} gh api --method DELETE /orgs/ORG/packages/container/PACKAGE/versions/{}
```

## 📊 **Comparaison des registries**

| Fonctionnalité | Docker Hub | GitHub Packages |
|----------------|------------|-----------------|
| **Coût (public)** | Gratuit + limites | Totalement gratuit |
| **Bande passante** | Limitée | Illimitée (public) |
| **Intégration GitHub** | ❌ | ✅ Native |
| **Scan sécurité** | ✅ (payant) | ✅ Gratuit |
| **UI/UX** | ✅ Dédiée | ✅ Intégrée GitHub |
| **Popularité** | ✅ Standard | 🟡 Croissante |

## 🔄 **Stratégie de failover**

En cas de problème avec un registry :

### **Script de déploiement robuste**
```bash
#!/bin/bash
# deploy-robust.sh

DOCKER_IMAGES=(
  "ronanjacques/cochin-project-manager-backend:$TAG"
  "ghcr.io/ronanjacques/cochin-project-manager/backend:$TAG"
)

FRONTEND_IMAGES=(
  "ronanjacques/cochin-project-manager-frontend:$TAG"
  "ghcr.io/ronanjacques/cochin-project-manager/frontend:$TAG"
)

# Fonction pour tester la disponibilité d'une image
test_image() {
  docker pull "$1" >/dev/null 2>&1
  return $?
}

# Sélection automatique du registry disponible
for img in "${DOCKER_IMAGES[@]}"; do
  if test_image "$img"; then
    BACKEND_IMAGE="$img"
    echo "✅ Backend image found: $BACKEND_IMAGE"
    break
  fi
done

for img in "${FRONTEND_IMAGES[@]}"; do
  if test_image "$img"; then
    FRONTEND_IMAGE="$img"
    echo "✅ Frontend image found: $FRONTEND_IMAGE"
    break
  fi
done

# Déploiement avec les images trouvées
BACKEND_IMAGE="$BACKEND_IMAGE" FRONTEND_IMAGE="$FRONTEND_IMAGE" \
docker-compose up -d
```

## 📈 **Monitoring et métriques**

### **GitHub Insights**
- **Download statistics** par package
- **Usage metrics** par version
- **Geographic distribution** des pulls

### **Commandes utiles**
```bash
# Lister tous les packages
gh api /user/packages

# Détails d'un package spécifique
gh api /users/ronanjacques/packages/container/backend

# Statistiques de téléchargement
gh api /orgs/ORG/packages/container/PACKAGE/versions \
  --jq '.[] | {tag: .metadata.tag.name, downloads: .downloads}'
```

## 🎯 **Recommandations**

### **Pour la production**
1. **Utilisez GitHub Packages** comme registry principal (gratuit, intégré)
2. **Gardez Docker Hub** comme backup et pour la compatibilité
3. **Automatisez le failover** entre les deux registries
4. **Surveillez les métriques** de chaque registry

### **Pour le développement**
1. **Testez avec les deux registries** pour valider la compatibilité
2. **Utilisez les tags semantiques** (v1.0.0, v1.1.0) pour les releases
3. **Nettoyez régulièrement** les anciennes versions

---

**🔗 Liens utiles :**
- [GitHub Packages Documentation](https://docs.github.com/en/packages)
- [Container Registry Guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Migrating to Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/migrating-to-the-container-registry-from-the-docker-registry) 