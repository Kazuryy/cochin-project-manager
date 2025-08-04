# 🔧 Système de Permissions Adaptatif

## Problème Résolu

Sur différentes plateformes (Synology, QNAP, Linux classique), Docker peut avoir des **problèmes de permissions** car :
- Les UID/GID varient selon les systèmes
- Les volumes montés ont des propriétaires différents
- Forcer `user: "1000:1000"` ne fonctionne pas partout

## 🎯 Solution : Mode Adaptatif

Le système détecte automatiquement les problèmes de permissions et tente de les corriger.

### Activation

Dans `docker-compose.prod.yml` :
```yaml
services:
  backend:
    environment:
      - ADAPTIVE_PERMISSIONS=true  # Activer le mode adaptatif
```

### Fonctionnement

#### 1. **Détection Automatique**
```bash
🔧 Vérification des dossiers critiques...
🔍 Analyse de logs (/app/logs)...
   ❌ /app/logs - Permissions insuffisantes
   🔧 Mode adaptatif activé - Tentative de correction...
   ↳ chmod 755 appliqué
   ✅ /app/logs - Permissions corrigées !
```

#### 2. **Mode Standard (Sans ADAPTIVE_PERMISSIONS)**
```bash
❌ 1 dossier(s) avec des problèmes de permissions:
   - /app/logs

💡 Solutions:
   1. Corriger les permissions: sudo chown -R 1000:1000 ./data/
   2. Activer le mode adaptatif: ADAPTIVE_PERMISSIONS=true
```

#### 3. **Mode Dégradé**
Si certains dossiers restent inaccessibles :
```bash
⚠️ 1 dossier(s) avec des problèmes persistants:
   - /app/logs
   ↳ Démarrage en mode dégradé...
```

## 🛠️ Solutions par Plateforme

### **Synology NAS**
```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      - ADAPTIVE_PERMISSIONS=true  # ✅ Recommandé
```

### **QNAP / Autres NAS**
```yaml
# docker-compose.prod.yml  
services:
  backend:
    environment:
      - ADAPTIVE_PERMISSIONS=true  # ✅ Recommandé
```

### **Linux Classique**
```bash
# Option 1: Permissions manuelles (plus sûr)
sudo chown -R 1000:1000 ./data/

# Option 2: Mode adaptatif
ADAPTIVE_PERMISSIONS=true docker-compose up
```

### **Docker Rootless**
```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      - ADAPTIVE_PERMISSIONS=true  # ✅ Nécessaire
```

## 🔍 Diagnostic

### Vérifier l'État
```bash
# Voir les logs du conteneur
docker logs cochin_backend | grep "Analyse de"

# Vérifier les permissions actuelles
docker exec cochin_backend ls -la /app/
```

### Messages Typiques

#### ✅ **Succès**
```
✅ /app/logs - Permissions OK
✅ /app/backups - Permissions corrigées !
```

#### ⚠️ **Avertissement**
```
⚠️ 1 dossier(s) avec des problèmes persistants:
   - /app/logs
   ↳ Démarrage en mode dégradé...
```

#### ❌ **Erreur (Mode Standard)**
```
❌ 1 dossier(s) avec des problèmes de permissions:
   - /app/logs

💡 Solutions:
   1. Corriger les permissions: sudo chown -R 1000:1000 ./data/
   2. Activer le mode adaptatif: ADAPTIVE_PERMISSIONS=true
```

## 🎯 Recommandations

### **Production**
- ✅ Utilisez `ADAPTIVE_PERMISSIONS=true` sur NAS/plateformes non-standard
- ✅ Corrigez manuellement les permissions sur Linux standard si possible
- ✅ Surveillez les logs pour détecter les modes dégradés

### **Développement**
- ✅ Toujours utiliser `ADAPTIVE_PERMISSIONS=true` pour éviter les blocages
- ✅ Documenter les permissions nécessaires par plateforme

### **Sécurité**
- ⚠️ Le mode adaptatif tente `chmod 755` seulement
- ⚠️ Il ne change jamais les propriétaires (chown) automatiquement
- ✅ En cas d'échec, propose des solutions manuelles sécurisées

## 📋 Dossiers Surveillés

Le système vérifie automatiquement ces dossiers critiques :
- `/app/logs` - Logs de l'application
- `/app/backups` - Sauvegardes 
- `/app/staticfiles` - Fichiers statiques Django
- `/app/media` - Fichiers uploadés
- `/app/db` - Base de données SQLite
- `/app/data/db` - Données de base de données

## 🔗 Liens Utiles

- [Guide Synology](README_SYNOLOGY_SETUP.md)
- [Troubleshooting Docker](README_DOCKER_TROUBLESHOOTING.md)
- [Configuration Avancée](README_ADVANCED_CONFIG.md)

---

**Note**: Cette fonctionnalité est compatible avec toutes les versions existantes et s'active uniquement avec `ADAPTIVE_PERMISSIONS=true`.