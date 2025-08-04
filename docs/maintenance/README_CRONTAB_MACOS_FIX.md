# 🍎 Solution Crontab pour macOS

## Problème Identifié

Sur macOS, l'installation des tâches cron Django peut échouer avec l'erreur :
```
Operation not permitted
```

Cette erreur est due aux **restrictions de sécurité renforcées** de macOS, particulièrement avec :
- SIP (System Integrity Protection)
- Gatekeeper
- Sandbox des applications
- Restrictions d'accès au répertoire `/tmp`

## 🔧 Solutions Implémentées

### Solution 1 : Script Spécialisé macOS
```bash
# Utiliser le script optimisé pour macOS
python scripts/manage_crontab_macos.py install
```

Ce script propose **3 stratégies automatiques** :

1. **Répertoire temporaire alternatif** (`~/.local/tmp/django-cron`)
2. **Installation avec sudo** (temporaire)
3. **Installation manuelle** avec génération du crontab

### Solution 2 : Variables d'Environnement
```bash
# Définir un répertoire temporaire alternatif
export TMPDIR=$HOME/.local/tmp
mkdir -p $TMPDIR
python manage.py crontab add
```

### Solution 3 : Installation Manuelle
```bash
# Générer et installer manuellement
python scripts/manage_crontab_macos.py install
# Suivre les instructions d'installation manuelle affichées
```

## 🎯 Commandes Disponibles

```bash
# Installation avec solutions macOS
python scripts/manage_crontab_macos.py install

# Diagnostic complet
python scripts/manage_crontab_macos.py status

# Test d'une tâche
python scripts/manage_crontab_macos.py test

# Suppression
python scripts/manage_crontab_macos.py remove
```

## ✅ Vérification

```bash
# Vérifier les tâches installées
crontab -l | grep manage.py

# Compter les tâches Django
crontab -l | grep django-cronjobs | wc -l
# Doit afficher : 10
```

## 📋 Tâches Configurées

Le système configure automatiquement **10 tâches** :

### Notifications
- **8h00 quotidien** : Vérification notifications devis

### Sauvegardes
- **4h00 quotidien** : Sauvegarde quotidienne
- **5h00 dimanche** : Sauvegarde hebdomadaire  
- **6h00 1er du mois** : Sauvegarde mensuelle

### Maintenance
- **2h00 quotidien** : Nettoyage fichiers temporaires
- **Toutes les 6h** : Nettoyage opérations bloquées
- **3h00 dimanche** : Resynchronisation DB/fichiers
- **1h00 samedi** : Nettoyage agressif temporaires

### Logs
- **3h00 quotidien** : Compression logs (7+ jours)
- **4h00 dimanche** : Nettoyage logs anciens (30+ jours)

## 🚨 Dépannage

### Erreur persiste ?
1. **Vérifier les permissions** :
   ```bash
   ls -la /tmp/ | head -5
   whoami
   id
   ```

2. **Tester l'écriture** :
   ```bash
   echo "test" > /tmp/test_cron.txt
   rm /tmp/test_cron.txt
   ```

3. **Utiliser l'installation manuelle** :
   ```bash
   python scripts/manage_crontab_macos.py install
   # Copier-coller les tâches dans : crontab -e
   ```

### Alternatives
Si le cron système pose toujours problème, utiliser **launchd** (natif macOS) :
```bash
# Créer un agent launchd (plus complexe mais plus fiable)
# Documentation dans : docs/deployment/README_LAUNCHD_MACOS.md
```

## 📚 Références

- [Django-crontab Documentation](https://github.com/kraiz/django-crontab)
- [macOS Cron Restrictions](https://support.apple.com/en-us/HT202860)
- [SIP and Developer Tools](https://developer.apple.com/documentation/security/disabling_and_enabling_system_integrity_protection)

---

**Note** : Cette solution est spécifiquement conçue pour l'environnement de développement macOS. Pour la production Linux, utiliser le script standard.