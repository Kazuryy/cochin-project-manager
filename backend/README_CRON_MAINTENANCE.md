# 🕐 Système de Maintenance Automatique via Cron

Ce système utilise **django-crontab** pour automatiser la maintenance de votre gestionnaire de projets Cochin.

## 📋 Tâches Configurées

### 🔔 Notifications de Devis
- **Planification** : Tous les jours à 8h00
- **Commande** : `check_devis_notifications`
- **Description** : Vérifie et envoie les notifications Discord pour les devis

### 🧹 Nettoyage des Fichiers Temporaires
- **Planification** : Tous les jours à 2h00
- **Commande** : `cleanup_temp_files --auto`
- **Description** : Nettoie automatiquement les fichiers temporaires anciens

### 🔧 Nettoyage des Opérations Bloquées
- **Planification** : Toutes les 6 heures
- **Commande** : `cleanup_stuck_operations --hours=6 --force`
- **Description** : Supprime les opérations de backup/restore bloquées

### 🔄 Resynchronisation Base de Données
- **Planification** : Tous les dimanches à 3h00
- **Commande** : `rebuild_backup_paths --force`
- **Description** : Synchronise la base de données avec les fichiers physiques

### 🗑️ Nettoyage Agressif Weekend
- **Planification** : Tous les samedis à 1h00
- **Commande** : `cleanup_temp_files --age-hours=2 --force`
- **Description** : Nettoyage plus agressif des fichiers temporaires

## 🛠️ Gestion des Tâches Cron

### Script Utilitaire
Un script Python est fourni pour gérer facilement les tâches cron :

```bash
# Afficher les tâches configurées
python scripts/manage_crontab.py show

# Vérifier le statut du système
python scripts/manage_crontab.py status

# Ajouter les tâches au crontab système
python scripts/manage_crontab.py add

# Supprimer les tâches du crontab système
python scripts/manage_crontab.py remove

# Tester une tâche manuellement
python scripts/manage_crontab.py test
```

### Commandes Django Crontab

```bash
# Ajouter toutes les tâches
python manage.py crontab add

# Afficher les tâches actives
python manage.py crontab show

# Supprimer toutes les tâches
python manage.py crontab remove

# Exécuter une tâche spécifique par son hash
python manage.py crontab run <hash>
```

## 📊 Surveillance et Logs

### Vérification du Statut
```bash
# Vérifier les tâches dans le crontab système
crontab -l | grep django-cronjobs

# Compter les tâches actives
crontab -l | grep django-cronjobs | wc -l
```

### Logs des Tâches
Les logs des tâches cron sont automatiquement générés par le système et peuvent être consultés via :

```bash
# Logs système cron (macOS)
tail -f /var/log/system.log | grep cron

# Logs d'application Django
tail -f logs/app.log
```

## ⚙️ Configuration

### Paramètres dans settings.py
```python
CRONJOBS = [
    # Vos tâches cron configurées...
]

# Configuration crontab
CRONTAB_COMMAND_PREFIX = 'cd ' + str(BASE_DIR) + ' && '
CRONTAB_DJANGO_SETTINGS_MODULE = 'app.settings'
CRONTAB_LOCK_JOBS = True  # Empêche les tâches concurrentes
```

### Variables d'Environnement
```bash
# Si nécessaire, configurez ces variables :
DJANGO_SETTINGS_MODULE=app.settings
```

## 🚨 Dépannage

### Problèmes Courants

1. **Tâches non exécutées**
   ```bash
   # Vérifier que le service cron est actif (macOS)
   sudo launchctl list | grep cron
   
   # Redémarrer le service si nécessaire
   sudo launchctl stop com.apple.atrun
   sudo launchctl start com.apple.atrun
   ```

2. **Permissions insuffisantes**
   ```bash
   # Vérifier les permissions des répertoires
   ls -la backups/ logs/
   
   # Corriger si nécessaire
   chmod 755 backups/ logs/
   ```

3. **Environnement virtuel non trouvé**
   - Les tâches utilisent automatiquement le chemin complet vers l'environnement virtuel
   - Vérifiez que le venv existe : `/chemin/vers/projet/venv/bin/python`

### Tests Manuels

```bash
# Tester chaque commande individuellement
python manage.py cleanup_temp_files --dry-run --verbose
python manage.py cleanup_stuck_operations --dry-run
python manage.py rebuild_backup_paths --scan-only
python manage.py check_devis_notifications
```

## 📈 Optimisation des Performances

### Recommandations
- Les tâches sont planifiées à des heures creuses (nuit/weekend)
- `CRONTAB_LOCK_JOBS = True` évite les conflits entre tâches
- Nettoyage intelligent basé sur l'âge des fichiers
- Surveillance automatique des opérations bloquées

### Monitoring
Le système inclut :
- Comptage automatique des éléments traités
- Logs détaillés avec timestamps
- Notifications d'erreur via Discord (si configuré)
- Statistiques de taille des fichiers

## 🔒 Sécurité

- Toutes les tâches s'exécutent dans l'environnement Django sécurisé
- Utilisation des chemins absolus pour éviter les injections
- Validation des paramètres avant exécution
- Logs des actions pour audit

---

**Note** : Ce système est conçu pour fonctionner 24/7 sans intervention manuelle. Les tâches sont idempotentes et sûres à ré-exécuter en cas de problème. 