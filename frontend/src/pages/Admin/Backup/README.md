# Module de Gestion des Configurations de Sauvegarde

## Vue d'ensemble

Ce module fournit une interface complète pour la gestion des sauvegardes avec trois sections principales :
- **Dashboard** : Vue d'ensemble avec statistiques et actions rapides
- **Configurations** : Gestion des paramètres de sauvegarde automatique  
- **Historique** : Consultation détaillée de toutes les sauvegardes effectuées

## Composants

### 1. BackupConfigurationList
**Fichier :** `BackupConfigurationList.jsx`

Composant principal qui affiche la liste de toutes les configurations de sauvegarde avec leurs détails et actions disponibles.

**Fonctionnalités :**
- 📋 Affichage en grille des configurations
- ✅ Activation/désactivation en un clic
- ▶️ Lancement de sauvegarde manuelle avec une configuration
- ✏️ Édition de configurations existantes
- 📄 Duplication de configurations
- 🗑️ Suppression avec confirmation
- 🔄 Rechargement automatique des données
- 🎯 Notifications toast pour toutes les actions

**Actions disponibles :**
- **Lancer sauvegarde** : Exécute une sauvegarde immédiate avec les paramètres de la configuration
- **Activer/Désactiver** : Toggle le statut actif de la configuration
- **Modifier** : Ouvre le formulaire d'édition
- **Dupliquer** : Crée une copie de la configuration (inactive par défaut)
- **Supprimer** : Supprime la configuration après confirmation

### 2. BackupConfigurationForm
**Fichier :** `BackupConfigurationForm.jsx`

Formulaire modal complet pour créer ou modifier une configuration de sauvegarde.

**Champs disponibles :**
- **Nom** : Nom descriptif de la configuration
- **Type de sauvegarde** : Full, Metadata, ou Data
- **Fréquence** : Manuel, Quotidien, Hebdomadaire, Mensuel
- **Options avancées** :
  - Inclusion des fichiers
  - Compression ZIP
  - Chiffrement AES-256
  - Statut actif/inactif
- **Rétention** : Durée de conservation en jours (1-365)

**Validation :**
- Nom obligatoire
- Rétention dans les limites autorisées
- Feedback visuel en temps réel

### 3. BackupHistoryList
**Fichier :** `BackupHistoryList.jsx`

Interface complète pour consulter l'historique des sauvegardes avec filtrage et actions avancées.

**Fonctionnalités principales :**
- 📊 **Widget de statistiques** : Taux de réussite, espace total, durée moyenne, tendances
- 🔍 **Filtres avancés** : Recherche textuelle, type, statut, plage de dates
- 📄 **Pagination intelligente** : Navigation avec ellipses pour grandes listes
- 👁️ **Détails complets** : Modal avec toutes les informations d'une sauvegarde
- 📥 **Actions contextuelles** : Télécharger, restaurer, supprimer selon le statut

**Actions disponibles :**
- **Voir détails** : Modal avec informations complètes (taille, durée, erreurs, etc.)
- **Télécharger** : Disponible uniquement pour les sauvegardes réussies
- **Restaurer** : Lance une restauration à partir d'une sauvegarde
- **Supprimer** : Suppression avec confirmation

**Filtres et recherche :**
- Recherche par nom de sauvegarde
- Filtrage par type (Complète, Métadonnées, Données)
- Filtrage par statut (Terminé, Échec, En cours, En attente)
- Sélection de plage de dates (début/fin)
- Boutons Rechercher et Réinitialiser

### 4. BackupStatsWidget
**Fichier :** `BackupStatsWidget.jsx`

Widget de statistiques calculées en temps réel sur l'historique des sauvegardes.

**Métriques affichées :**
- **Taux de réussite** : Pourcentage de sauvegardes réussies
- **Espace total** : Taille cumulée de toutes les sauvegardes
- **Durée moyenne** : Temps moyen d'exécution des sauvegardes réussies
- **Tendance 7 jours** : Évolution par rapport à la semaine précédente
- **Répartition par type** : Nombre de sauvegardes par type avec badges colorés

### 5. Service Toast/Notifications
**Fichier :** `../../../components/common/Toast.jsx`

Système de notifications pour feedback utilisateur.

**Types de notifications :**
- ✅ **Success** : Actions réussies
- ❌ **Error** : Erreurs rencontrées  
- ⚠️ **Warning** : Avertissements
- ℹ️ **Info** : Informations générales

## Intégration API

### Endpoints utilisés
```
GET    /api/backup/configurations/     # Liste des configurations
POST   /api/backup/configurations/     # Création
PUT    /api/backup/configurations/:id/ # Modification
DELETE /api/backup/configurations/:id/ # Suppression
POST   /api/backup/create/             # Lancement sauvegarde
GET    /api/backup/history/            # Historique avec filtres
DELETE /api/backup/history/:id/        # Suppression sauvegarde
POST   /api/backup/restore/            # Restauration
```

### Structure des données

#### Configuration
```javascript
{
  id: number,
  name: string,
  backup_type: 'full' | 'metadata' | 'data',
  frequency: 'manual' | 'daily' | 'weekly' | 'monthly',
  is_active: boolean,
  include_files: boolean,
  compression_enabled: boolean,
  encryption_enabled: boolean,
  retention_days: number,
  created_at: string,
  updated_at: string
}
```

#### Historique des sauvegardes
```javascript
{
  id: number,
  backup_name: string,
  backup_type: 'full' | 'metadata' | 'data',
  status: 'pending' | 'running' | 'completed' | 'failed',
  configuration: object | null,
  file_size: number | null,
  file_path: string,
  duration_seconds: number | null,
  started_at: string | null,
  completed_at: string | null,
  tables_count: number | null,
  records_count: number | null,
  files_count: number | null,
  error_message: string,
  created_at: string
}
```

## Fonctionnalités avancées

### 1. États de chargement
- Spinners pour les opérations longues
- Désactivation des boutons pendant les actions
- Feedback visuel immédiat

### 2. Gestion des erreurs
- Try-catch pour toutes les opérations API
- Messages d'erreur contextuels
- Fallback gracieux en cas d'échec

### 3. UX optimisée
- Tooltips informatifs
- Icônes visuelles pour les options
- Badges de statut colorés
- Animations fluides

### 4. Responsive design
- Grille adaptative
- Menus dropdown pour actions secondaires
- Modales centrées et scrollables

### 5. Pagination intelligente
- Affichage des pages proches de la page actuelle
- Ellipses pour indiquer les pages cachées
- Navigation intuitive avec flèches

### 6. Filtrage avancé
- Recherche textuelle en temps réel
- Filtres combinables
- Persistance des filtres lors de la navigation
- Reset rapide de tous les filtres

## Commandes de développement

### Création de configurations par défaut
```bash
cd backend
python manage.py create_default_configs
```

Cette commande crée 4 configurations de démonstration :
- Sauvegarde complète quotidienne (active)
- Métadonnées hebdomadaire (active)
- Sauvegarde de développement (inactive)
- Archive mensuelle (active)

### Création de sauvegardes de test
```bash
cd backend
python manage.py create_sample_backups --count=30
```

Cette commande génère 30 sauvegardes d'exemple avec :
- Différents types et statuts
- Dates réparties sur 90 jours
- Tailles et durées réalistes
- Messages d'erreur variés pour les échecs
- Associations aux configurations existantes

### Structure des fichiers
```
frontend/src/pages/Admin/Backup/
├── BackupManagement.jsx           # Composant principal avec onglets
├── BackupConfigurationList.jsx    # Liste et gestion des configurations
├── BackupConfigurationForm.jsx    # Formulaire création/édition
├── BackupHistoryList.jsx          # Interface d'historique complète
├── BackupStatsWidget.jsx          # Widget de statistiques
└── README.md                      # Cette documentation

frontend/src/components/common/
└── Toast.jsx                      # Système de notifications

backend/backup_manager/
├── models.py                      # Modèles Django
├── views.py                       # API REST
├── urls.py                        # Routes
└── management/commands/
    ├── create_default_configs.py  # Commande de création configs
    └── create_sample_backups.py   # Commande de génération données test
```

## Tests et démonstration

### Section Configurations
1. **Création** : Créer une nouvelle configuration avec différents paramètres
2. **Modification** : Éditer le nom et les options d'une configuration existante  
3. **Duplication** : Dupliquer une configuration pour créer une variante
4. **Activation/Désactivation** : Tester le toggle de statut
5. **Lancement** : Déclencher une sauvegarde manuelle
6. **Suppression** : Supprimer une configuration de test

### Section Historique
1. **Consultation** : Parcourir la liste paginée des sauvegardes
2. **Filtrage** : Tester les différents filtres individuellement et combinés
3. **Recherche** : Rechercher par nom de sauvegarde
4. **Détails** : Ouvrir le modal de détails d'une sauvegarde
5. **Actions** : Tester téléchargement et restauration (simulées)
6. **Statistiques** : Vérifier la cohérence des métriques affichées

### Dashboard
1. **Statistiques** : Vérifier la cohérence des chiffres affichés
2. **Actions rapides** : Lancer des sauvegardes rapides
3. **Navigation** : Utiliser les boutons "Voir tout" pour aller vers d'autres sections

Toutes ces actions doivent afficher des notifications appropriées et mettre à jour l'interface en temps réel.

## Prochaines améliorations

- [ ] Planification automatique basée sur la fréquence
- [ ] Graphiques de tendances avec Chart.js
- [ ] Export/Import de configurations
- [ ] Templates de configurations prédéfinies
- [ ] Logs d'audit des modifications
- [ ] Notifications push pour les échecs
- [ ] Intégration stockage cloud (S3, etc.)
- [ ] Compression et déduplication avancées 

## Dépannage

### Problèmes courants et solutions

#### 1. Échec des sauvegardes

**Symptômes :** Les sauvegardes échouent avec des erreurs ou restent bloquées en statut "running".

**Solutions :**
- Vérifier les permissions du dossier de sauvegarde (`backend/backups/`)
- S'assurer que l'utilisateur a les droits administrateur
- Vérifier l'espace disque disponible
- Exécuter le script de nettoyage des opérations bloquées :
  ```bash
  cd backend
  python manage.py cleanup_stuck_operations
  ```

#### 2. Problèmes d'authentification

**Symptômes :** Messages "Session expirée" ou "Non authentifié" lors des opérations de sauvegarde.

**Solutions :**
- Se reconnecter à l'application
- Vérifier que les cookies sont activés dans le navigateur
- Effacer le cache du navigateur
- Si le problème persiste, utiliser l'API directe :
  ```bash
  curl -X POST http://localhost:8000/api/backup/quick-backup/ \
    -H "Content-Type: application/json" \
    -H "X-CSRFToken: [votre_token]" \
    --cookie "csrftoken=[votre_token]" \
    -d '{"backup_type": "full", "backup_name": "Sauvegarde_Manuelle"}'
  ```

#### 3. Fichiers de sauvegarde introuvables

**Symptômes :** Le téléchargement échoue avec "Fichier introuvable" malgré un statut "completed".

**Solutions :**
- Vérifier les chemins dans `settings.py` (BACKUP_ROOT, MEDIA_ROOT)
- Vérifier que les fichiers existent physiquement dans le dossier configuré
- Reconstruire les chemins avec le script :
  ```bash
  cd backend
  python manage.py rebuild_backup_paths
  ```

#### 4. Problèmes de restauration

**Symptômes :** La restauration échoue ou reste bloquée.

**Solutions :**
- Vérifier que la sauvegarde est complète et non corrompue
- S'assurer que l'utilisateur a les droits d'écriture sur la base de données
- Nettoyer les fichiers temporaires :
  ```bash
  cd backend
  python manage.py cleanup_temp_files
  ```
- Utiliser l'option de restauration partielle (métadonnées uniquement)

#### 5. Problèmes de performance

**Symptômes :** Les sauvegardes sont très lentes ou consomment trop de ressources.

**Solutions :**
- Désactiver temporairement la compression pour les grandes bases de données
- Planifier les sauvegardes pendant les heures creuses
- Réduire la fréquence des sauvegardes complètes
- Utiliser des sauvegardes différentielles (type "data" ou "metadata")

### Vérification de l'état du système

Pour diagnostiquer rapidement l'état du système de sauvegarde :

```bash
cd backend
python manage.py check_backup_system
```

### Logs et débogage

Les logs détaillés sont disponibles dans :
- `backend/logs/backup_operations.log`
- `backend/logs/security.log`

Pour activer les logs de débogage, modifiez `settings.py` :
```python
BACKUP_DEBUG = True
LOGGING['loggers']['backup_manager']['level'] = 'DEBUG'
```

### Support et ressources

Si les problèmes persistent :
1. Consulter la documentation complète dans `wiki/backup_system.md`
2. Vérifier les mises à jour du système de sauvegarde
3. Contacter l'équipe de support technique 

## Outils de maintenance

Des outils de maintenance ont été ajoutés pour faciliter la gestion du système de sauvegarde :

### Scripts de commande Django

Ces commandes sont exécutables depuis le répertoire `backend` :

```bash
# Nettoyer les opérations bloquées
python manage.py cleanup_stuck_operations [--hours=6] [--force] [--dry-run]

# Reconstruire les chemins de fichiers de sauvegarde
python manage.py rebuild_backup_paths [--scan-dir=PATH] [--fix-missing] [--dry-run]

# Vérifier l'état du système de sauvegarde
python manage.py check_backup_system [--json] [--fix] [--deep]
```

### Script shell de vérification rapide

Un script shell est disponible pour une vérification rapide du système :

```bash
# Depuis la racine du projet
./backend/scripts/backup_health_check.sh
```

Ce script interactif vérifie :
- L'existence des répertoires nécessaires
- Les permissions des fichiers
- L'espace disque disponible
- Les opérations bloquées
- Les fichiers temporaires
- La taille des logs
- Les dépendances système
- La configuration Django

Il propose également des corrections automatiques pour les problèmes courants. 