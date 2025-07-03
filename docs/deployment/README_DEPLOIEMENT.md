# 🚀 Guide de Déploiement - Cochin Project Manager

Guide simple pour déployer l'application Cochin Project Manager en production avec Docker.

## 📋 Prérequis

- **Serveur Linux** (Ubuntu/Debian recommandé)
- **Accès sudo** sur le serveur
- **Port 80 libre** pour l'application
- **2GB d'espace disque** minimum

## 🎯 Déploiement Rapide (Méthode Recommandée)

### 1️⃣ Transfert du Code

```bash
# Option A : Clone depuis Git
git clone https://github.com/votre-username/cochin-project-manager.git
cd cochin-project-manager

# Option B : Transfert par SCP/FTP
# Transférer tous les fichiers du projet sur le serveur
```

### 2️⃣ Lancement Automatique

```bash
# Rendre le script exécutable
chmod +x deploy.sh

# Lancer le déploiement complet
./deploy.sh
```

**C'est tout !** 🎉 Le script fait tout automatiquement.

---

## 📖 Déploiement Manuel (Étape par Étape)

Si tu préfères comprendre chaque étape :

### 1️⃣ Installation des Dépendances

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2️⃣ Configuration du Système

```bash
# Configurer le DNS local
echo "127.0.0.1 project-manager.local" | sudo tee -a /etc/hosts

# Créer la structure des dossiers
mkdir -p data/{db,media,backups,logs,staticfiles}

# Générer les clés de sécurité
cat > .env << EOF
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
BACKUP_ENCRYPTION_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
DISCORD_WEBHOOK_URL=
EOF
```

### 3️⃣ Construction et Démarrage

```bash
# Construire les images Docker
docker-compose build

# Démarrer l'application
docker-compose up -d

# Attendre le démarrage (30 secondes)
sleep 30

# Vérifier l'état
docker-compose ps
```

---

## 🌐 Accès à l'Application

Après le déploiement :

- **🏠 Interface principale** : http://project-manager.local
- **⚙️ Administration Django** : http://project-manager.local/admin
- **🔑 Identifiants** : `admin` / `changeme`

## 📊 Tables Business Créées Automatiquement

L'application créé automatiquement ces 6 tables :

1. **Contacts** - Gestion des contacts
2. **Choix** - Options et valeurs de choix
3. **TableNames** - Types de projets
4. **Projet** - Projets principaux
5. **Devis** - Gestion des devis
6. **DevisParProjet** - Liaison projets/devis

## 🔧 Commandes de Gestion

```bash
# Voir les logs en temps réel
docker-compose logs -f

# Redémarrer l'application
docker-compose restart

# Arrêter l'application
docker-compose down

# Sauvegarder manuellement
docker-compose exec backend python manage.py run_backup --all

# Accéder au shell Django
docker-compose exec backend python manage.py shell

# Voir l'espace disque utilisé
docker system df
```

## 🔍 Vérifications Post-Déploiement

### ✅ Tests de Fonctionnement

```bash
# Test de connectivité
curl -I http://project-manager.local

# Vérifier les services
docker-compose ps

# Vérifier les logs
docker-compose logs backend | tail -20
docker-compose logs frontend | tail -20
```

### 📋 Checklist de Vérification

- [ ] Application accessible sur http://project-manager.local
- [ ] Connexion admin fonctionne (admin/changeme)
- [ ] 6 tables business créées dans l'interface admin
- [ ] Pas d'erreurs dans les logs
- [ ] Sauvegarde automatique configurée

## 🔄 Mise à Jour de l'Application

```bash
# Récupérer les dernières modifications
git pull

# Reconstruire et redémarrer
docker-compose down
docker-compose build
docker-compose up -d
```

## 🆘 Dépannage

### Problèmes Courants

**🔴 "Port 80 already in use"**
```bash
# Voir qui utilise le port 80
sudo lsof -i :80
# Arrêter le service conflictuel ou changer de port
```

**🔴 "Permission denied"**
```bash
# Corriger les permissions
sudo chown -R $USER:$USER data/
chmod +x deploy.sh entrypoint.sh
```

**🔴 "Cannot connect to Docker daemon"**
```bash
# Redémarrer Docker
sudo systemctl restart docker
# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER
newgrp docker
```

**🔴 Application inaccessible**
```bash
# Vérifier les services
docker-compose ps
# Voir les logs détaillés
docker-compose logs -f
```

### Logs Importants

```bash
# Logs backend (Django)
docker-compose logs backend

# Logs frontend (Nginx/React)
docker-compose logs frontend

# Logs de tous les services
docker-compose logs
```

## 🔒 Sécurité

### Après Déploiement

1. **Changer le mot de passe admin** depuis l'interface
2. **Configurer HTTPS** si nécessaire
3. **Sauvegarder régulièrement** les données
4. **Monitorer les logs** pour détecter les problèmes

### Fichiers Sensibles

- `.env` - Contient les clés secrètes
- `data/db/` - Base de données SQLite
- `data/backups/` - Sauvegardes chiffrées

## 📞 Support

En cas de problème :

1. **Vérifier les logs** : `docker-compose logs -f`
2. **Redémarrer les services** : `docker-compose restart`
3. **Vérifier l'espace disque** : `df -h`
4. **Consulter la documentation** : `README_TO_PROD.md`

---

🎉 **Félicitations !** Ton application Cochin Project Manager est maintenant déployée et prête à l'emploi ! 