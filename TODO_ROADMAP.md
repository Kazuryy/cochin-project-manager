# 🗺️ Roadmap & TODOs - Cochin Project Manager

> **Fichier de suivi général** - Roadmap technique et fonctionnelle du projet
> 
> **Dernière mise à jour :** Août 2025

---

## 🚨 **URGENT - PROBLÈMES DE PRODUCTION**

### ⏰ **Système Crontab Docker (CRITIQUE)**
**Status :** 🔴 **BLOQUANT** - Les tâches planifiées ne s'exécutent pas en production

**Problème identifié :**
- Le service cron n'est jamais démarré dans le conteneur Docker
- `python manage.py crontab add` ajoute les tâches mais elles ne s'exécutent jamais
- 10 tâches critiques affectées (sauvegardes, notifications, nettoyage)

**Solutions analysées :**

| Solution | Complexité | Délai | Fiabilité | Recommandation |
|----------|------------|-------|-----------|----------------|
| **Crontab hôte Ubuntu** | 🟢 Simple | 30min | ⭐⭐⭐ | ✅ **Solution immédiate** |
| **Conteneur cron dédié** | 🟡 Moyen | 2-3j | ⭐⭐⭐⭐ | ✅ **Solution pérenne** |
| **Migration Celery** | 🔴 Complexe | 7-11j | ⭐⭐⭐⭐⭐ | ✅ **Solution enterprise** |

---

## 🎯 **ROADMAP PRIORITAIRE**

### **🔥 Phase 1 - Stabilisation (1-2 semaines)**

#### **1.1 - Fix Crontab Immédiat** 
- [ ] **Implémentation crontab hôte Ubuntu** (30min)
  ```bash
  # Sur serveur production
  sudo crontab -e
  # Ajouter les 10 tâches avec docker exec
  ```
- [ ] **Tests des 10 tâches planifiées** (2h)
- [ ] **Documentation procédure** (1h)
- [ ] **Monitoring logs cron** (30min)

#### **1.2 - Amélioration Docker Architecture**
- [ ] **Conteneur cron dédié** (2-3 jours)
  - [ ] Dockerfile.cron
  - [ ] docker-compose.prod-with-cron.yml  
  - [ ] Script entrypoint cron
  - [ ] Tests et déploiement
- [ ] **Documentation architecture** (1 jour)

---

### **🚀 Phase 2 - Modernisation (1-3 mois)**

#### **2.1 - Migration Celery** 
**Estimation :** 7-11 jours développement + 2-3 jours tests

**Impact Codebase :**
- ✅ **+800 lignes** nouveau code
- ✅ **+50 lignes** modifications existantes  
- ✅ **+4 services** Docker (redis, celery-worker, celery-beat, flower)
- ✅ **+3 dépendances** Python

**Détail implémentation :**

```
📁 Nouveaux fichiers
├── backend/app/celery.py          (~100 lignes)
├── backend/app/tasks.py           (~500 lignes)  
├── backend/app/schedules.py       (~200 lignes)
└── docker-compose.celery.yml      (~100 lignes)

📝 Modifications
├── backend/app/settings.py        (+50 lignes Celery config)
├── backend/app/__init__.py         (+3 lignes import)
└── backend/requirements.txt       (+3 dépendances)
```

**Tasks à migrer :**
- [ ] `check_devis_notifications` → Celery task
- [ ] `run_backup` (daily/weekly/monthly) → Celery tasks
- [ ] `cleanup_temp_files` → Celery task
- [ ] `cleanup_stuck_operations` → Celery task  
- [ ] `rebuild_backup_paths` → Celery task
- [ ] `cleanup_logs` → Celery task

**Avantages Celery :**
- ✅ **Retry automatique** avec backoff exponentiel
- ✅ **Monitoring temps réel** (interface Flower)
- ✅ **Pas de problème Docker** (workers dédiés)
- ✅ **Scaling horizontal** (multiple workers)
- ✅ **Standard Django production**

#### **2.2 - Monitoring & Observabilité**
- [ ] **Interface Flower** (monitoring Celery)
- [ ] **Alertes Discord** automatiques sur échecs
- [ ] **Métriques Prometheus** (optionnel)
- [ ] **Dashboard Grafana** (optionnel)

---

### **🔧 Phase 3 - Optimisations (3-6 mois)**

#### **3.1 - Performance & Scaling**
- [ ] **Cache Redis** pour Django
- [ ] **Optimisation base de données**
- [ ] **CDN pour assets statiques**
- [ ] **Load balancing** multi-instances

#### **3.2 - Sécurité & Compliance**
- [ ] **Authentification 2FA**
- [ ] **Audit logs détaillés**  
- [ ] **Chiffrement base de données**
- [ ] **Scan vulnérabilités automatique**

---

## 🐛 **BUGS & AMÉLIORATIONS CONTINUES**

### **Bugs Identifiés**
- [ ] **TODO_BUGS_STAGE.md** - Voir fichier dédié pour détails

### **Tech Debt**
- [ ] **Migration Django 5.3** (quand disponible)
- [ ] **Modernisation frontend** (React → Vue.js ?)
- [ ] **API versioning** (v2)
- [ ] **Tests coverage** > 80%

### **Features Requests**
- [ ] **Export données Excel/PDF** amélioré
- [ ] **Templates devis** personnalisables
- [ ] **Integration comptabilité** (Sage, QuickBooks)
- [ ] **Mobile app** (PWA ou native)

---

## 📊 **MÉTRIQUES & SUIVI**

### **KPIs Techniques**
- [ ] **Uptime > 99.5%**
- [ ] **Temps réponse < 200ms**  
- [ ] **0 tâches cron échouées**
- [ ] **Tests coverage > 80%**

### **KPIs Business**
- [ ] **Notifications devis : 100% fiabilité**
- [ ] **Sauvegardes : 100% automatiques** 
- [ ] **Temps création devis < 5min**
- [ ] **0 perte de données**

---

## 🗓️ **PLANNING PRÉVISIONNEL**

| Période | Focus | Livrables |
|---------|-------|-----------|
| **Semaine 1** | 🔥 Fix crontab urgent | Crontab hôte + conteneur dédié |
| **Mois 1** | 🚀 Migration Celery | Architecture moderne, monitoring |
| **Mois 2-3** | 🔧 Optimisations | Performance, sécurité |
| **Mois 4-6** | 📱 Nouvelles features | Mobile, intégrations |

---

## 📝 **NOTES & DÉCISIONS**

### **Décisions Techniques**
- **2025-08-26** : Choix Celery vs alternatives pour fiabilité maximale
- **2025-08-26** : Architecture conteneurs séparés (anti-pattern supervisor évité)

### **Dépendances Externes**
- **Redis** : Broker Celery (standard industrie)
- **Docker Compose** : Orchestration actuelle (vs Kubernetes future ?)

### **Ressources Nécessaires**
- **Dev Backend** : 70% du temps migration Celery
- **DevOps** : 30% configuration infrastructure  
- **Tests** : QA sur chaque phase avant production

---

## 🎯 **PROCHAINES ACTIONS IMMÉDIATES**

### **Cette semaine :**
1. [ ] **FIX URGENT** - Implémentation crontab hôte (30min)
2. [ ] **Tests** production des 10 tâches planifiées (2h)
3. [ ] **Documentation** procédure de fallback (1h)

### **Ce mois :**
1. [ ] **Architecture** conteneur cron dédié (2-3j)
2. [ ] **Planification** migration Celery (1j planning)
3. [ ] **Setup** environnement de test Celery (1j)

---

**📱 Pour ajouter un TODO :** Éditer ce fichier en respectant la structure par phases
**🔄 Révision :** Mensuelle ou après chaque livraison majeure  
**👥 Responsable :** Lead Dev + Product Owner
