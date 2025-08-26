# 🔧 Diagnostic : npm Rate Limiting sur ARM64

## 🚨 **Symptômes**

```
npm error code E429
npm error 429 Too Many Requests - GET https://registry.npmjs.org/@tailwindcss%2fvite
```

### **Contexte typique :**
- ✅ Build AMD64 réussit
- ❌ Build ARM64 échoue avec rate limiting
- 🐌 Émulation QEMU pour ARM64

## 🔍 **Diagnostic pas à pas**

### **1. Identifier le problème**

```bash
# Vérifier les logs de build
act push -j build-frontend --container-architecture linux/amd64

# Ou regarder directement sur GitHub Actions
# Chercher "buildkit_qemu_emulator" dans les logs
```

### **2. Causes racines**

| **Cause** | **Description** | **Solution** |
|-----------|-----------------|--------------|
| **Émulation lente** | QEMU ARM64 plus lent | Configuration npm adaptée |
| **Cache manquant** | Pas de package-lock.json | Copier le lock file |
| **Builds parallèles** | AMD64 + ARM64 simultanés | Build séquentiel |
| **npm install vs ci** | npm install moins stable | Utiliser npm ci |

## ✅ **Solutions appliquées**

### **1. Dockerfile optimisé**

```dockerfile
# ❌ AVANT : Instable
COPY frontend/package.json ./
RUN npm install && npm cache clean --force

# ✅ APRÈS : Stable et optimisé pour ARM64
COPY frontend/package.json frontend/package-lock.json ./
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    npm config set maxsockets 3 && \
    npm ci --only=production=false --no-audit --prefer-offline && \
    npm cache clean --force
```

### **2. Cache GitHub Actions séparé**

```yaml
# ❌ AVANT : Cache partagé
cache-from: type=gha,scope=frontend
cache-to: type=gha,mode=max,scope=frontend

# ✅ APRÈS : Cache par architecture
cache-from: |
  type=gha,scope=frontend-amd64
  type=gha,scope=frontend-arm64
cache-to: |
  type=gha,mode=max,scope=frontend-amd64
  type=gha,mode=max,scope=frontend-arm64
```

### **3. Workflow de fallback**

Si le problème persiste :

```bash
# Déclencher le build séquentiel manuellement
gh workflow run docker-build-sequential.yml \
  -f target_image=frontend \
  -f push_images=true
```

## 🛠️ **Configuration npm optimale pour ARM64**

```bash
# Timeouts étendus pour émulation lente
npm config set fetch-retry-mintimeout 20000    # 20s minimum
npm config set fetch-retry-maxtimeout 120000   # 2 minutes maximum  
npm config set fetch-timeout 300000            # 5 minutes timeout global

# Réduire la charge réseau
npm config set maxsockets 3                    # Max 3 connexions simultanées
npm config set fetch-retries 5                 # Plus de tentatives

# Utiliser le cache autant que possible
npm ci --prefer-offline --no-audit
```

## 📊 **Monitoring et métriques**

### **Logs à surveiller :**

```bash
# ✅ Signes de succès
"added X packages, and audited Y packages"
"npm ci" (au lieu de "npm install")
"Cache hit from previous build"

# ❌ Signes de problème  
"npm error code E429"
"Too Many Requests"
"buildkit_qemu_emulator"
"timeout" dans les logs npm
```

### **Temps de build normaux :**

| **Architecture** | **Temps npm ci** | **Temps total** |
|------------------|------------------|-----------------|
| **AMD64**        | 30-60s          | 2-4 minutes     |
| **ARM64**        | 60-180s         | 4-8 minutes     |

## 🚀 **Prévention future**

### **1. Dockerfile best practices**

- ✅ Toujours copier `package-lock.json`
- ✅ Utiliser `npm ci` au lieu de `npm install`
- ✅ Configurer les timeouts npm pour ARM64
- ✅ Activer `--prefer-offline` quand possible

### **2. CI/CD monitoring**

```yaml
# Ajouter des métriques dans les workflows
- name: 📊 Build timing
  run: |
    echo "Build started at: $(date)"
    echo "Architecture: ${{ matrix.platform }}"
```

### **3. Plan de contingence**

1. **Premier essai** : Build parallèle optimisé
2. **Si échec** : Déclencher workflow séquentiel
3. **Si persistant** : Build AMD64 seulement temporairement
4. **Investigation** : Analyser les logs npm registry

## 🔗 **Ressources utiles**

- [npm registry status](https://status.npmjs.org/)
- [Docker Multi-platform builds](https://docs.docker.com/build/building/multi-platform/)
- [GitHub Actions cache documentation](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)

## 📝 **Commandes de diagnostic rapide**

```bash
# Tester build local ARM64
docker buildx build --platform linux/arm64 \
  -f docker/dockerfiles/Dockerfile.frontend .

# Vérifier le cache GitHub Actions
gh api /repos/OWNER/REPO/actions/caches

# Forcer un rebuild sans cache
gh workflow run ci-cd-advanced.yml -f force_rebuild=true
```
