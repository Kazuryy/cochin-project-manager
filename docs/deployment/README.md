# 📦 Documentation Déploiement

Cette section contient toute la documentation relative au déploiement et à la mise en production de l'application Cochin Project Manager.

## 🎯 **Guides par ordre de priorité**

### 🚀 **Démarrage rapide**
1. **[Déploiement Simple](./README_DEPLOYMENT_SIMPLE.md)** - Pour débuter rapidement
2. **[Docker](./README_DOCKER.md)** - Configuration de base Docker

### 📋 **Stratégies et modes**
3. **[Stratégie de Déploiement](./README_DEPLOYMENT_STRATEGY.md)** - Planification du déploiement
4. **[Modes de Déploiement](./README_MODES_DEPLOIEMENT.md)** - Différents environnements
5. **[Production](./README_TO_PROD.md)** - Migration vers la production

### 🔄 **CI/CD et automatisation**
6. **[CI/CD](./README_CI_CD.md)** - Intégration continue basique
7. **[CI/CD Avancé](./README_CI_CD_ADVANCED.md)** - Configuration avancée
8. **[GitHub Packages](./README_GITHUB_PACKAGES.md)** - Gestion des packages

### 🔒 **Configuration avancée**
9. **[SSL](./README_SSL_CONFIG.md)** - Configuration SSL/TLS
10. **[Général](./README_DEPLOIEMENT.md)** - Guide général de déploiement

---

## 📊 **Vue d'ensemble des environnements**

| Environnement | Fichier de config | Objectif |
|---------------|-------------------|----------|
| **Local** | `docker-compose.local.yml` | Développement |
| **Production** | `docker-compose.prod.yml` | Production |
| **Staging** | `docker-compose.yml` | Tests |

## 🛠️ **Commandes essentielles**

```bash
# Démarrage rapide local
docker-compose -f docker-compose.local.yml up --build

# Déploiement production
docker-compose -f docker-compose.prod.yml up -d

# Vérification des logs
docker-compose logs -f
```

---

[← Retour à la documentation principale](../README.md) 