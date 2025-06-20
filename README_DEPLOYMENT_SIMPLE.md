# 🚀 Déploiement Simple - Cochin Project Manager

Guide rapide pour déployer sur **Portainer** ou **Synology** sans cloner le repo complet.

## 📁 Fichiers Nécessaires

Tu n'as besoin que de **2 fichiers** :

1. **docker-compose.yml** (ou deploy-minimal.yml)
2. **Ce guide** (optionnel)

## 🎯 Déploiement sur Portainer

### 1️⃣ Créer la Stack

1. **Se connecter à Portainer**
2. **Aller dans "Stacks"**
3. **Cliquer "Add Stack"**
4. **Nommer la stack** : `cochin-project-manager`

### 2️⃣ Coller le Docker Compose

Copier-coller ce contenu dans l'éditeur :

```yaml
version: '3.8'

services:
  backend:
    image: ronanjacques/cochin-project-manager-backend:latest
    container_name: cochin_backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - ./data/db:/app/data/db
      - ./data/media:/app/media
      - ./data/backups:/app/backups
      - ./data/logs:/app/logs
      - ./data/staticfiles:/app/staticfiles
    environment:
      - DJANGO_SETTINGS_MODULE=app.settings
      - SECRET_KEY=django-insecure-change-this-in-production-12345
      - BACKUP_ENCRYPTION_KEY=change-this-key-in-production
      - DISCORD_WEBHOOK_URL=
      - ALLOWED_HOSTS=localhost,127.0.0.1,*
      - CORS_ALLOWED_ORIGINS=*
      - DEBUG=False
    networks:
      - cochin_network

  frontend:
    image: ronanjacques/cochin-project-manager-frontend:latest
    container_name: cochin_frontend
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./data/staticfiles:/usr/share/nginx/html/static:ro
      - ./data/media:/usr/share/nginx/html/media:ro
    depends_on:
      - backend
    networks:
      - cochin_network

networks:
  cochin_network:
    driver: bridge
```

### 3️⃣ Variables d'Environnement (Optionnel)

Dans la section "Environment variables" :

```
SECRET_KEY=votre-cle-secrete-plus-forte
BACKUP_ENCRYPTION_KEY=votre-cle-de-chiffrement
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/votre-webhook
```

### 4️⃣ Déployer

1. **Cliquer "Deploy the stack"**
2. **Attendre 3-4 minutes** (téléchargement + initialisation)
3. **Vérifier** que les 2 conteneurs sont "Running"
4. **C'est tout !** L'app est prête avec toutes les tables 🎉

## 🎯 Déploiement sur Synology

### 1️⃣ Docker sur Synology

1. **Installer Docker** depuis le Package Center
2. **Ouvrir Docker**
3. **Aller dans "Projet"**

### 2️⃣ Créer le Projet

1. **Nouveau → Créer un projet Docker Compose**
2. **Nom du projet** : `cochin-project-manager`
3. **Coller le même contenu** que pour Portainer
4. **Cliquer "Suivant"** puis **"Terminer"**
5. **Attendre 3-4 minutes** → Application prête ! 🎉

### 3️⃣ Configuration Synology

```bash
# Si accès SSH au Synology
sudo mkdir -p /volume1/docker/cochin-project-manager/data/{db,media,backups,logs,staticfiles}
sudo chown -R 1000:1000 /volume1/docker/cochin-project-manager/data/
```

## 🌐 Accès à l'Application

Après le déploiement :

- **🏠 Interface** : `http://ip-du-serveur:80`
- **⚙️ Admin** : `http://ip-du-serveur:80/admin`
- **🔑 Login** : `admin` / `changeme`

## ✨ Configuration Automatique

**Bonne nouvelle !** L'application se configure **automatiquement** au premier démarrage :

- ✅ **Tables business** créées automatiquement (6 tables)
- ✅ **Utilisateur admin** créé : `admin` / `changeme`
- ✅ **Configuration sauvegarde** initialisée
- ✅ **Base de données** prête à l'emploi

**Aucune action manuelle requise !** 🎉

### Tables Créées Automatiquement

1. **Contacts** - Gestion des contacts clients
2. **Choix** - Options et valeurs de référence
3. **TableNames** - Types de projets
4. **Projet** - Projets principaux avec statuts
5. **Devis** - Gestion des devis
6. **DevisParProjet** - Liaison projets/devis

### Temps d'Initialisation

- **Premier démarrage** : ~90 secondes (création BDD + tables)
- **Démarrages suivants** : ~30 secondes

## 🔄 Mise à Jour

### Sur Portainer
1. **Stack** → `cochin-project-manager`
2. **Cliquer "Update"**
3. **Cocher "Re-pull image"**
4. **Update stack**

### Sur Synology
1. **Docker** → **Projet**
2. **Sélectionner le projet**
3. **Action** → **Reconstruire**

## 🆘 Dépannage

**Port 80 occupé :**
- Changer `"80:80"` en `"8080:80"` dans le docker-compose
- Accès via `http://ip:8080`

**Volumes non créés :**
- Créer manuellement le dossier `data/` avec sous-dossiers
- Vérifier les permissions

**Images non trouvées :**
- Vérifier la connexion internet
- Essayer de pull manuellement : `docker pull ronanjacques/cochin-project-manager-backend:latest`

## 📱 URLs de Téléchargement Direct

Si tu veux juste télécharger les fichiers :

- **Docker Compose** : `https://raw.githubusercontent.com/votre-repo/main/deploy-minimal.yml`
- **Ce guide** : `https://raw.githubusercontent.com/votre-repo/main/README_DEPLOYMENT_SIMPLE.md`

## 🎉 C'est Tout !

Avec cette méthode, tu n'as besoin que du fichier docker-compose.yml. Tout le reste est dans les images Docker Hub ! 🚀 