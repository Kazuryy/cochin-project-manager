# Configuration SSL flexible

## Principe

La configuration SSL est maintenant contrôlée par la variable `FORCE_SSL` dans chaque fichier docker-compose :

- `FORCE_SSL=false` → Pas de redirection HTTPS forcée (développement/local)
- `FORCE_SSL=true` → Redirection HTTPS forcée (production)

## Fichiers de configuration

### Local (`docker-compose.local.yml`)
```yaml
environment:
  - FORCE_SSL=false  # Pas de SSL en local
  - DEBUG=True
```

### Production (`docker-compose.prod.yml`)
```yaml
environment:
  - FORCE_SSL=true   # SSL forcé en production
  - DEBUG=False
```

## Comment utiliser

1. **Pour le développement local :**
   ```bash
   docker-compose -f docker-compose.local.yml up -d
   ```
   → Accès HTTP : http://localhost:1337

2. **Pour la production :**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```
   → Redirection automatique vers HTTPS

## Modification de la configuration

Pour changer la configuration SSL, éditez directement le fichier docker-compose correspondant :

```yaml
# Dans docker-compose.prod.yml
environment:
  - FORCE_SSL=false  # Désactiver SSL en production si nécessaire
```

Puis rebuild et redémarrez :
```bash
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
``` 