# 🚀 **Stratégie de Déploiement - Cochin Project Manager**

## 📋 **Vue d'ensemble de la stratégie**

Cette stratégie sépare clairement les **environnements de développement** et de **production** avec un système de tags intelligent.

---

## 🔄 **Workflow de déploiement**

### **🔧 1. Développement - Branche `main`**

**Déclenchement :** Push sur la branche `main`

```bash
git push origin main
```

**Tags générés :**
- **Backend** : `ronanjacques/cochin-project-manager-backend:dev`
- **Frontend** : `ronanjacques/cochin-project-manager-frontend:dev`
- **GitHub Packages** : `ghcr.io/kazuryy/cochin-project-manager/backend:dev`

**Objectif :** 
- ✅ Valider les nouvelles fonctionnalités
- ✅ Tests d'intégration en environnement de dev
- ✅ S'assurer que tout fonctionne avant la prod

**Utilisation :**
```bash
# Pull des images de dev pour tester
docker pull ronanjacques/cochin-project-manager-backend:dev
docker pull ronanjacques/cochin-project-manager-frontend:dev

# Déploiement dev local
BACKEND_TAG=dev FRONTEND_TAG=dev docker-compose up -d
```

---

### **🚀 2. Production - Tags `v*.*.*`**

**Déclenchement :** Création d'un tag de version

```bash
# Créer une nouvelle version de production
git tag v1.0.1
git push origin v1.0.1
```

**Tags générés :**
- **Backend** : 
  - `ronanjacques/cochin-project-manager-backend:latest` 
  - `ronanjacques/cochin-project-manager-backend:v1.0.1`
- **Frontend** :
  - `ronanjacques/cochin-project-manager-frontend:latest`
  - `ronanjacques/cochin-project-manager-frontend:v1.0.1`

**Objectif :**
- ✅ Déploiement stable en production
- ✅ `latest` pointe toujours vers la dernière version STABLE
- ✅ Traçabilité avec le tag spécifique (`v1.0.1`)

**Utilisation :**
```bash
# Production avec latest (toujours la dernière stable)
docker pull ronanjacques/cochin-project-manager-backend:latest
docker pull ronanjacques/cochin-project-manager-frontend:latest

# Ou version spécifique pour garantir la stabilité
docker pull ronanjacques/cochin-project-manager-backend:v1.0.1
docker pull ronanjacques/cochin-project-manager-frontend:v1.0.1
```

---

## 📊 **Tableau des tags par environnement**

| Environnement | Déclencheur | Tags générés | Usage |
|---------------|-------------|---------------|--------|
| **🔧 DEV** | Push sur `main` | `dev` | Test nouvelles fonctionnalités |
| **🚀 PROD** | Tag `v1.0.1` | `latest` + `v1.0.1` | Déploiement stable |
| **🐛 DEBUG** | Workflow manuel | `sha-abc123` | Debug spécifique |
| **📝 PR** | Pull Request | `pr-123` | Review code |

---

## 🎯 **Avantages de cette stratégie**

### **✅ Clarté totale**
- **`dev`** = Toujours la dernière version en développement
- **`latest`** = Toujours la dernière version STABLE en production
- **`v1.0.1`** = Version spécifique figée

### **✅ Sécurité**
- Impossible de déployer accidentellement du dev en prod
- Le tag `latest` est toujours fiable
- Rollback facile avec les tags spécifiques

### **✅ Workflow naturel**
1. Développe sur `main` → Test avec `dev` 
2. Quand c'est stable → Crée tag `v1.0.1` → Déploie `latest`
3. Si problème → Rollback sur `v1.0.0`

---

## 🛠️ **Commandes pratiques**

### **Workflow développement complet**
```bash
# 1. Développer et tester
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin main

# 2. Attendre le build dev automatique
gh run watch

# 3. Tester l'image dev
docker-compose -f docker-compose.dev.yml up -d

# 4. Si OK, créer une release prod
git tag v1.0.1
git push origin v1.0.1

# 5. Déployer en prod
./deploy-prod.sh latest
```

### **Commandes de déploiement**

**Déploiement DEV :**
```bash
# Option 1: Variables d'environnement
BACKEND_TAG=dev FRONTEND_TAG=dev docker-compose up -d

# Option 2: Script dédié
./deploy-dev.sh
```

**Déploiement PROD :**
```bash
# Option 1: Dernière version stable
BACKEND_TAG=latest FRONTEND_TAG=latest docker-compose up -d

# Option 2: Version spécifique
BACKEND_TAG=v1.0.1 FRONTEND_TAG=v1.0.1 docker-compose up -d

# Option 3: Script automatique
./deploy-prod.sh v1.0.1
```

### **Monitoring et vérification**
```bash
# Vérifier quelles images sont disponibles
docker images | grep cochin-project-manager

# Voir les tags sur Docker Hub
curl -s https://registry.hub.docker.com/v2/repositories/ronanjacques/cochin-project-manager-backend/tags/ | jq .

# Vérifier la version déployée
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

---

## 🔄 **Exemples de workflow**

### **Scénario 1: Nouvelle fonctionnalité**
```bash
# Développement
git checkout main
git pull origin main
# ... développement ...
git commit -m "feat: add user authentication"
git push origin main

# ✅ Automatic build → backend:dev, frontend:dev

# Test local
docker-compose -f docker-compose.dev.yml up -d
# ✅ Tout fonctionne

# Release en production
git tag v1.2.0
git push origin v1.2.0

# ✅ Automatic build → backend:latest, backend:v1.2.0
```

### **Scénario 2: Hotfix urgent**
```bash
# Fix urgent sur main
git commit -m "fix: critical security patch"
git push origin main

# ✅ Build dev automatique pour tester

# Si OK, release immédiate
git tag v1.1.1
git push origin v1.1.1

# ✅ Déploiement prod avec latest mis à jour
```

### **Scénario 3: Rollback**
```bash
# Problème avec v1.2.0, retour à v1.1.0
BACKEND_TAG=v1.1.0 FRONTEND_TAG=v1.1.0 docker-compose up -d

# Ou recréer latest sur la bonne version
git tag -d v1.2.0
git push origin :refs/tags/v1.2.0
git tag v1.1.1  # Patch sur la v1.1.0
git push origin v1.1.1

# ✅ latest pointe maintenant sur v1.1.1
```

---

## 📝 **Bonnes pratiques**

### **🎯 Versioning sémantique**
- **v1.0.0** : Version majeure (breaking changes)
- **v1.1.0** : Fonctionnalité nouvelle (non breaking)
- **v1.0.1** : Bug fixes et patches

### **🔍 Tests obligatoires**
- **Branche main** : Tests automatiques AVANT build dev
- **Tags prod** : Tests complets + scan sécurité AVANT build latest

### **📊 Monitoring**
- Surveiller les déploiements via GitHub Actions
- Vérifier les images avant déploiement prod
- Garder un historique des versions déployées

### **🛡️ Sécurité**
- Ne jamais utiliser le tag `dev` en production
- Toujours tester avec `dev` avant de tagger
- Conserver les anciennes versions pour rollback

---

**🎯 Cette stratégie garantit une séparation claire entre développement et production, avec un workflow simple et fiable !** 