# 🐛 TO-DO BUGS STAGE

## 🔴 Bugs Critiques à Corriger

### 💰 Système de Devis
- [ ] **Total du devis** - Problème de calcul ou d'affichage du montant total
- [ ] **Prix du devis** - Clarifier la structure d'affichage des prix :
  - [ ] Option A : Une ligne par devis avec prix global
  - [ ] Option B : Affichage détaillé des différents prix/composants
- [ ] **Sous-types** - Les listes affichent tous les sous-types au lieu de filtrer par type sélectionné

### 🖥️ Interface Utilisateur  
- [ ] **Crontab (tâches automatiques)** - ⚠️ Problème de permissions détecté
  - ✅ Tâches correctement configurées dans Django (10 tâches)
  - ✅ Service cron actif sur le système (com.vix.cron)
  - ❌ Erreur "Operation not permitted" lors de l'installation
  - 🔍 À tester sur machine de production/test

## 📝 Bugs Identifiés (À Détailler)

### 🔍 Diagnostic Crontab (Machine Dev)
- ✅ **Configuration Django** : 10 tâches bien définies dans settings.py
- ✅ **Service système** : cron actif (PID 77514, com.vix.cron)
- ✅ **Test manuel** : commandes s'exécutent correctement
- ❌ **Permissions** : erreur "Operation not permitted" sur `/tmp/tmp.*`
- 📍 **Cause probable** : restrictions de sécurité macOS ou antivirus

### À Investiguer (Machine Test)
- [ ] **Crontab** : Réinstaller les tâches avec `python manage.py crontab add`
- [ ] **Crontab** : Vérifier les permissions système sur la machine de test
- [ ] **Devis totaux** : Analyser le système de calcul des montants totaux
- [ ] **Sous-types** : Vérifier la logique de filtrage par type parent

## 🎯 Prochaines Étapes

1. **CRONTAB** - Diagnostiquer et réparer les tâches automatiques
   ```bash
   python scripts/manage_crontab.py status
   python scripts/manage_crontab.py show
   python manage.py crontab add
   ```

2. **DEVIS** - Analyser le calcul des totaux dans DevisManager.jsx
   - Vérifier la logique dans `getFieldValue()` 
   - Tester l'affichage des montants

3. **TYPES/SOUS-TYPES** - Corriger le filtrage conditionnel
   - Examiner le système de règles conditionnelles
   - Vérifier les mappings types → sous-types

4. **TESTS** - Valider chaque correction individuellement

## 📊 Statut Global
- **Total bugs identifiés** : 4
- **Bugs analysés** : 4 (✅ Tous identifiés précisément)
- **Bugs corrigés** : 0
- **En cours d'investigation** : 4
- **À faire** : Correction et tests

## 🔧 Commandes pour Machine de Test

### 🕐 Diagnostic Crontab Complet
```bash
# 1. Vérifier l'état du système
cd backend && python scripts/manage_crontab.py status

# 2. Supprimer et réinstaller toutes les tâches
python manage.py crontab remove
python manage.py crontab add

# 3. Vérifier l'installation dans le crontab système
crontab -l | grep django-cronjobs | wc -l  # Doit afficher 10

# 4. Tester une tâche manuellement
python manage.py cleanup_temp_files --dry-run --verbose

# 5. Vérifier les logs d'exécution (si problème persiste)
grep -i cron /var/log/system.log | tail -10
```

### 💡 Si erreur "Operation not permitted"
```bash
# Vérifier les permissions du répertoire temporaire
ls -la /tmp/ | grep tmp

# Essayer avec sudo (temporairement)
sudo python manage.py crontab add

# Ou utiliser un répertoire alternatif pour les temp files
export TMPDIR=/Users/$USER/tmp
mkdir -p $TMPDIR
python manage.py crontab add
```

### Devis
```bash
# Tester le service de devis
python manage.py shell
>>> from frontend.src.services.devisService import devisService
```

### Types/Sous-types
```bash
# Vérifier les règles conditionnelles
python manage.py shell
>>> from conditional_fields.models import ConditionalFieldRule
>>> ConditionalFieldRule.objects.all()
```

---
*Mise à jour : Décembre 2024 - Bugs identifiés et documentés* 