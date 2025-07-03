# Cochin Project Manager

Un outil de gestion de projet moderne permettant d'indexer et d'archiver vos différents projets avec un tableau de bord intuitif pour visualiser leurs caractéristiques et l'avancement des devis.

## 🚀 Fonctionnalités

### ✨ Principales
- **Gestion de projets** : Interface complète pour créer, modifier et suivre vos projets
- **Tableau de bord dynamique** : Visualisation en temps réel de l'avancement des projets et devis
- **Tables dynamiques** : Système flexible permettant de créer des structures de données personnalisées
- **Authentification sécurisée** : Conforme aux recommandations ANSSI
- **Interface responsive** : Design moderne avec DaisyUI et Tailwind CSS

### 🔧 Système de tables dynamiques
- Création de tables personnalisées avec différents types de champs
- Support de multiples types de données (texte, nombre, date, booléen, choix, clés étrangères, etc.)
- Gestion des relations entre tables
- Filtrage et recherche avancés
- Export des données en CSV

### 🔐 Sécurité
- Authentification robuste avec gestion des tentatives de connexion
- Expiration automatique des mots de passe (90 jours)
- Verrouillage de compte après échecs de connexion
- Historique des mots de passe pour éviter la réutilisation
- Validation forte des mots de passe (12+ caractères, complexité)

## 🛠 Technologies utilisées

### Frontend
- **React 18** avec Vite pour le développement rapide
- **Tailwind CSS** + **DaisyUI** pour un design moderne et cohérent
- **React Router** pour la navigation
- **React Icons** pour les icônes

### Backend
- **Django 5.2** avec Django REST Framework
- **SQLite** (facilement configurable pour PostgreSQL/MySQL)
- **Python 3.x**
- Architecture sécurisée avec middleware CORS

## 📚 Documentation

Ce projet dispose d'une documentation complète organisée par catégories :

### 📖 **[Documentation Technique](./docs/)**
- **[🚀 Démarrage rapide](./docs/deployment/README_DEPLOYMENT_SIMPLE.md)** - Guide pour débuter
- **[📦 Déploiement](./docs/deployment/)** - Configuration et mise en production
- **[🛠️ Développement](./docs/development/)** - Guides pour contribuer au projet
- **[🔒 Sécurité](./docs/security/)** - Politique et audits de sécurité
- **[🔧 Maintenance](./docs/maintenance/)** - Administration système

### 📖 **[Wiki Fonctionnel](./wiki/)**
- **[Création de Types](./wiki/FONCTIONNALITE_CREATION_TYPES.md)** - Guide utilisateur
- **[Gestion des Tables](./wiki/table_list.md)** - Liste et usage des tables
- **[Gestion Utilisateurs](./wiki/user_management.md)** - Administration des comptes

## 📦 Installation rapide

### 🐳 **Docker (Recommandé)**

```bash
# Cloner et démarrer
git clone https://github.com/Kazuryy/cochin-project-manager.git
cd cochin-project-manager

# Méthode 1: Script helper (recommandé)
./docker-helper.sh dev

# Méthode 2: Docker Compose classique
docker-compose -f docker/compose/docker-compose.local.yml up --build
# Ou simplement (raccourci)
docker-compose up --build

# Accès : http://localhost:1337
```

### 🔧 **Installation manuelle**

```bash
# Backend (Django)
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# Frontend (React) - nouveau terminal
cd frontend
npm install
npm run dev
```

## 📁 Structure du projet

```
cochin-project-manager/
├── 📁 backend/              # 🔧 API Django + DRF
│   ├── app/                 # Configuration principale
│   ├── authentication/     # Système d'authentification sécurisé
│   ├── database/           # Tables dynamiques et gestion des données
│   ├── backup_manager/     # Système de sauvegarde automatisé
│   └── conditional_fields/ # Champs conditionnels
├── 📁 frontend/             # 🎨 Interface React + Vite
│   ├── src/
│   │   ├── components/     # Composants réutilisables (UI, forms, etc.)
│   │   ├── contexts/       # Contextes React globaux
│   │   ├── hooks/          # Hooks personnalisés
│   │   ├── pages/          # Pages de l'application
│   │   └── services/       # Services API et utilitaires
│   └── public/             # Assets statiques
├── 📁 data/                 # 💾 Données persistantes
│   ├── db/                 # Base de données SQLite
│   ├── media/              # Fichiers uploadés (PDFs, images)
│   ├── logs/               # Logs système
│   └── backups/            # Sauvegardes automatiques
├── 📁 docs/                 # 📚 Documentation technique organisée
│   ├── deployment/         # Guides de déploiement
│   ├── development/        # Configuration développement
│   ├── security/           # Politique de sécurité
│   └── maintenance/        # Administration système
├── 📁 wiki/                 # 📖 Documentation fonctionnelle
├── 🐳 docker/               # 🔧 Configuration Docker organisée
│   ├── compose/             # Fichiers docker-compose par environnement
│   ├── dockerfiles/         # Images Docker (backend/frontend)
│   ├── config/              # Configuration (nginx, entrypoint)
│   └── scripts/             # Scripts de déploiement et maintenance
├── 🐳 docker-compose.yml    # Raccourci vers la config de développement
└── 📋 README.md             # Ce fichier
```

## 🚀 Utilisation

### Script Helper Docker

Le script `./docker-helper.sh` simplifie la gestion des différents environnements :

```bash
# Développement local
./docker-helper.sh dev

# Production 
./docker-helper.sh prod

# Arrêter tous les conteneurs
./docker-helper.sh stop

# Voir les logs en temps réel
./docker-helper.sh logs -f

# Statut des conteneurs
./docker-helper.sh status

# Aide complète
./docker-helper.sh --help
```

### Navigation de l'application

1. **Accéder à l'application** : Ouvrez `http://localhost:1337`
2. **Se connecter** : Utilisez les identifiants du superutilisateur créé
3. **Tableau de bord** : Vue d'ensemble de vos projets et données
4. **Administration** : Gérer les tables dynamiques et la structure des données

### Premiers pas

1. **Créer une table dynamique** :
   - Aller dans Administration → Base de données → Tables
   - Cliquer sur "Créer une table"
   - Définir les champs selon vos besoins

2. **Ajouter des données** :
   - Sélectionner votre table
   - Cliquer sur "Enregistrements"
   - Ajouter vos données via le formulaire généré automatiquement

3. **Personnaliser l'affichage** :
   - Utiliser les filtres et la recherche
   - Exporter vos données en CSV

## ⚙️ Configuration

### Variables d'environnement

Créer un fichier `.env` dans le dossier `backend/` :

```env
SECRET_KEY=votre_clé_secrète_django
DEBUG=True
DATABASE_PATH=/app/data/db/db.sqlite3
```

Pour plus de détails, consultez la [documentation de déploiement](./docs/deployment/).

## 🧪 Tests

```bash
# Backend
cd backend
python manage.py test

# Frontend
cd frontend
npm run test
```

## 📈 Roadmap

- [ ] Système de notifications en temps réel
- [ ] Import/Export Excel avancé
- [ ] API GraphQL
- [ ] Mode hors ligne avec synchronisation
- [ ] Rapports automatisés
- [ ] Intégration avec des services tiers

## 🤝 Contribution

Les contributions sont les bienvenues ! Consultez le [guide de développement](./docs/development/) pour commencer.

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🐛 Support

Si vous rencontrez des problèmes :

1. Vérifiez les [Issues existantes](https://github.com/Kazuryy/cochin-project-manager/issues)
2. Consultez la [documentation](./docs/)
3. Créez une nouvelle issue avec :
   - Description du problème
   - Étapes pour reproduire
   - Environnement (OS, versions, etc.)

## 📞 Contact

**Auteur** : Kazury  
**Repository** : [https://github.com/Kazuryy/cochin-project-manager](https://github.com/Kazuryy/cochin-project-manager)

---

⭐ N'hésitez pas à star le projet si il vous est utile !