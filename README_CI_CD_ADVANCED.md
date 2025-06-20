# 🚀 CI/CD Avancé - Cochin Project Manager

[![CI/CD Pipeline](https://github.com/ronanjacques/cochin-project-manager/actions/workflows/ci-cd-advanced.yml/badge.svg)](https://github.com/ronanjacques/cochin-project-manager/actions/workflows/ci-cd-advanced.yml)
[![Auto Release](https://github.com/ronanjacques/cochin-project-manager/actions/workflows/auto-release.yml/badge.svg)](https://github.com/ronanjacques/cochin-project-manager/actions/workflows/auto-release.yml)
[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-Available-blue?logo=docker)](https://hub.docker.com/)
[![Discord](https://img.shields.io/badge/Discord-Notifications-7289da?logo=discord)](https://discord.com/)

Ce projet dispose d'un **système CI/CD avancé** avec de nombreuses fonctionnalités automatisées pour garantir la qualité, la sécurité et le déploiement efficace.

## 🎯 Fonctionnalités du pipeline

### 🧪 **Tests et Qualité Automatisés**
- ✅ **Détection intelligente des changements** (build seulement si nécessaire)
- ✅ **Tests Python** avec linting (flake8) et analyse de sécurité (bandit, safety)
- ✅ **Tests Frontend** avec ESLint et build de validation
- ✅ **Vérification de la qualité du code** avant chaque build

### 🐳 **Build Docker Optimisé**
- ✅ **Build en parallèle** backend/frontend pour plus de rapidité
- ✅ **Cache intelligent GitHub Actions** pour accélérer les builds
- ✅ **Support multi-plateformes** et métadonnées enrichies
- ✅ **Build conditionnel** (seulement si le code a changé)

### 🛡️ **Sécurité Intégrée**
- ✅ **Scan de vulnérabilités** avec Trivy sur toutes les images
- ✅ **Analyse de sécurité du code** Python avec Bandit
- ✅ **Vérification des dépendances** avec Safety
- ✅ **Rapports de sécurité** intégrés à GitHub Security

### 🏷️ **Releases Automatiques**
- ✅ **Versioning automatique** basé sur les commits
- ✅ **Changelog généré** automatiquement
- ✅ **Release GitHub** avec notes de version
- ✅ **Tags intelligents** (patch/minor/major selon les changements)

### 🔔 **Notifications Discord**
- ✅ **Notifications en temps réel** sur Discord
- ✅ **Résumés détaillés** des builds et déploiements
- ✅ **Alertes d'échec** avec liens vers les logs
- ✅ **Notifications de nouvelles releases**

## 🔄 Workflows disponibles

### 1. **Pipeline CI/CD Principal** (`ci-cd-advanced.yml`)

**Déclencheurs :**
- Push sur `main`, `production`, `develop`
- Pull requests vers `main`, `production`
- Déclenchement manuel avec options

**Jobs exécutés :**
1. 🧪 **Tests & Quality Checks** - Tests et vérifications qualité
2. 🐳 **Build Backend** - Construction image backend (parallèle)
3. 🎨 **Build Frontend** - Construction image frontend (parallèle)
4. 🛡️ **Security Scan** - Scan de sécurité des images
5. 🏷️ **Create Release** - Création release GitHub (si tag)
6. 📢 **Notifications** - Résumé et notifications Discord

### 2. **Auto Release** (`auto-release.yml`)

**Déclencheurs :**
- Push sur `main` (release automatique)
- Déclenchement manuel avec choix du type

**Fonctionnalités :**
- 🔍 Détection automatique du type de version
- 📝 Génération de changelog
- 🏷️ Création et push du tag
- 🔔 Notification Discord de la nouvelle release

## 🎛️ Variables et Secrets requis

### Secrets GitHub nécessaires :
```bash
DOCKERHUB_USERNAME    # Votre nom d'utilisateur Docker Hub
DOCKERHUB_TOKEN       # Token d'accès Docker Hub
DISCORD_WEBHOOK_URL   # URL du webhook Discord (optionnel)
```

### Variables d'environnement :
```bash
REGISTRY=docker.io                    # Registry Docker
BACKEND_IMAGE=user/backend:tag        # Image backend
FRONTEND_IMAGE=user/frontend:tag      # Image frontend
```

## 🚀 Utilisation

### **Workflow automatique (recommandé)**
1. **Développez** votre code normalement
2. **Committez** avec des messages clairs :
   - `feat: nouvelle fonctionnalité` → version minor
   - `fix: correction bug` → version patch
   - `BREAKING: changement majeur` → version major
3. **Poussez** sur main → **Release automatique** !

### **Workflow manuel**
```bash
# Déclencher un build manuel
gh workflow run ci-cd-advanced.yml

# Créer une release manuelle
gh workflow run auto-release.yml -f release_type=minor

# Forcer un rebuild sans cache
gh workflow run ci-cd-advanced.yml -f force_rebuild=true
```

## 📊 Optimisations et performances

### **Cache intelligent**
- ✅ **Cache GitHub Actions** pour Docker layers
- ✅ **Cache séparé** backend/frontend pour éviter les conflits
- ✅ **Cache npm/pip** pour les dépendances
- ✅ **Invalidation intelligente** du cache

### **Build conditionnel**
- ✅ **Détection des changements** avec `paths-filter`
- ✅ **Skip des builds** inutiles
- ✅ **Jobs en parallèle** pour réduire le temps total
- ✅ **Optimisation des ressources** GitHub Actions

### **Sécurité renforcée**
- ✅ **Tokens avec permissions minimales**
- ✅ **Scan de vulnérabilités** intégré
- ✅ **Rapports de sécurité** automatiques
- ✅ **Isolation des secrets**

## 🔔 Notifications Discord

Le système envoie des notifications riches sur Discord :

### **✅ Succès de build**
- 📦 Repository et branche
- 👤 Auteur du commit
- 🚀 Images construites
- 🔗 Liens utiles

### **❌ Échecs de build**
- 📝 Détails de l'erreur
- 🔗 Lien vers les logs
- 🛠️ Actions suggérées

### **🏷️ Nouvelles releases**
- 📦 Numéro de version
- 📝 Changelog automatique
- 🚀 Commandes de déploiement

## 📈 Métriques et monitoring

### **Badges de statut**
Ajoutez ces badges à votre README :
```markdown
[![CI/CD Pipeline](https://github.com/USER/REPO/actions/workflows/ci-cd-advanced.yml/badge.svg)](https://github.com/USER/REPO/actions/workflows/ci-cd-advanced.yml)
[![Auto Release](https://github.com/USER/REPO/actions/workflows/auto-release.yml/badge.svg)](https://github.com/USER/REPO/actions/workflows/auto-release.yml)
```

### **Rapports de sécurité**
- 🛡️ **Security tab GitHub** : Rapports Trivy automatiques
- 📊 **Code quality** : Métriques de qualité du code
- 🔍 **Dependency insights** : Analyse des dépendances

## 🎮 Commandes utiles

### **Actions locales**
```bash
# Tester le linting Python
cd backend && flake8 .

# Tester la sécurité Python
cd backend && bandit -r .

# Tester le build frontend
cd frontend && npm run build

# Tester le linting frontend
cd frontend && npm run lint
```

### **Actions GitHub**
```bash
# Lister les workflows
gh workflow list

# Voir les runs récents
gh run list

# Voir les détails d'un run
gh run view [RUN_ID]

# Télécharger les logs
gh run download [RUN_ID]
```

## 🛠️ Configuration avancée

### **Personnaliser les notifications Discord**
Modifiez les couleurs et messages dans le workflow :
```yaml
"color": 3066993,  # Vert pour succès
"color": 15158332, # Rouge pour échec
"color": 5814783,  # Violet pour release
```

### **Ajouter de nouveaux tests**
Ajoutez vos tests dans les sections appropriées :
```yaml
- name: 🧪 Vos tests personnalisés
  run: |
    # Ajoutez vos commandes de test ici
```

### **Personnaliser les conditions de release**
Modifiez la logique de versioning dans `auto-release.yml` :
```bash
# Exemple : ajouter support pour "chore" commits
if git log ${LAST_TAG}..HEAD --oneline | grep -E "^[a-f0-9]+ chore"; then
  RELEASE_TYPE="patch"
fi
```

---

## 🎉 Avantages de ce système

✅ **Qualité garantie** : Tests automatiques avant chaque release
✅ **Sécurité renforcée** : Scan de vulnérabilités systématique
✅ **Déploiement rapide** : Build optimisé et cache intelligent
✅ **Traçabilité complète** : Logs détaillés et notifications
✅ **Workflow moderne** : Best practices DevOps intégrées
✅ **Maintenance simplifiée** : Automation maximale

**Ce système transforme votre développement en processus professionnel entièrement automatisé !** 🚀 