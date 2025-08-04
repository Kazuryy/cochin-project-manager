# 🐳 Déploiement Portainer - Guide Complet

## 📋 Prérequis
- Portainer installé et fonctionnel
- Docker/Docker Compose disponible sur le serveur
- Accès réseau aux ports 8000 (backend) et 5050 (frontend)

## 🚀 Déploiement en 5 étapes

### 1. Préparer le Stack Portainer

Dans Portainer :
1. Aller dans **Stacks** → **Add stack**
2. Nommer le stack : `cochin-project-manager`
3. Copier le contenu de `docker-compose.prod-clean.yml` dans l'éditeur

### 2. Configurer les variables d'environnement

Dans l'onglet **"Environment variables"** de Portainer, ajouter :

#### 🔑 OBLIGATOIRES (À CHANGER !)
```
SECRET_KEY=your_super_secret_django_key_here_50_chars_minimum
BACKUP_ENCRYPTION_KEY=your_backup_encryption_key_here
EXTERNAL_DOMAIN=192.168.1.100
```

#### 🌐 OPTIONNELLES
```
EXTERNAL_PORT=5050
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK
```

### 3. Générer des clés sécurisées

```bash
# Pour SECRET_KEY (50+ caractères)
python -c "import secrets; print(secrets.token_urlsafe(50))"

# Ou avec OpenSSL
openssl rand -base64 32

# Ou en ligne : https://djecrety.ir/
```

### 4. Déployer le Stack

1. Cliquer sur **"Deploy the stack"**
2. Attendre que les containers démarrent
3. Vérifier les logs dans Portainer

### 5. Accéder à l'application

- **URL** : `http://VOTRE_IP:5050`
- **Login par défaut** : `admin` / `changeme`

## 🛠️ Configuration avancée

### Pour HTTPS (avec reverse proxy)

Si vous avez nginx/traefik devant :

```bash
# Variables d'environnement
EXTERNAL_DOMAIN=projet.mondomaine.com
EXTERNAL_PORT=443
FORCE_SSL=true
CSRF_COOKIE_SECURE=true
SESSION_COOKIE_SECURE=true
```

### Pour environnements haute sécurité

```bash
# Désactiver les permissions adaptatives
ADAPTIVE_PERMISSIONS=false

# Activer SSL strict
FORCE_SSL=true
DEBUG=False
```

## 🏗️ Structure des volumes

Les données sont stockées dans `./data/` :
```
./data/
├── db/          # Base de données SQLite
├── media/       # Fichiers uploadés
├── backups/     # Sauvegardes automatiques
├── logs/        # Logs de l'application
└── staticfiles/ # Fichiers statiques Django
```

## 🔧 Dépannage

### Container backend ne démarre pas
```bash
# Vérifier les logs
docker logs cochin_backend --tail=50

# Problème de permissions ?
sudo chown -R 1000:1000 ./data/
```

### Erreur CSRF/Login
```bash
# Vérifier les variables réseau
echo $EXTERNAL_DOMAIN
echo $EXTERNAL_PORT

# Redémarrer le stack si nécessaire
```

### Performance/Backup
```bash
# Voir l'état des sauvegardes
docker exec cochin_backend python manage.py run_backup --dry-run

# Nettoyer les logs
docker exec cochin_backend python manage.py cleanup_logs --days=30
```

## 📞 Support

En cas de problème, vérifier :
1. Les logs des containers dans Portainer
2. Les variables d'environnement 
3. La connectivité réseau (ping/telnet)
4. Les permissions des volumes

---

**🎯 Avec ce guide, votre application devrait fonctionner sur n'importe quel environnement Portainer !**