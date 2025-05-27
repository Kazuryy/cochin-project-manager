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

## 📦 Installation

### Prérequis
- Python 3.8+
- Node.js 16+
- npm ou yarn

### Backend (Django)

```bash
# Cloner le repository
git clone https://github.com/Kazuryy/cochin-project-manager.git
cd cochin-project-manager

# Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate

# Installer les dépendances
cd backend
pip install -r requirements.txt

# Configuration de la base de données
python manage.py makemigrations
python manage.py migrate

# Créer un superutilisateur
python manage.py createsuperuser

# Démarrer le serveur de développement
python manage.py runserver
```

### Frontend (React)

```bash
# Dans un nouveau terminal
cd frontend

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev
```

## 🚀 Utilisation

1. **Accéder à l'application** : Ouvrez `http://localhost:5173`
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

## 📁 Structure du projet

```
cochin-project-manager/
├── backend/                 # Application Django
│   ├── app/                # Configuration principale
│   ├── authentication/     # Système d'authentification
│   ├── database/          # Gestion des tables dynamiques
│   └── manage.py
├── frontend/               # Application React
│   ├── src/
│   │   ├── components/    # Composants réutilisables
│   │   ├── contexts/      # Contextes React
│   │   ├── hooks/         # Hooks personnalisés
│   │   ├── pages/         # Pages de l'application
│   │   └── services/      # Services API
│   └── public/
└── README.md
```

## ⚙️ Configuration

### Variables d'environnement

Créer un fichier `.env` dans le dossier `backend/` :

```env
SECRET_KEY=votre_clé_secrète_django
DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3
```

### Personnalisation

Le projet est conçu pour être facilement personnalisable :
- **Thèmes** : Modifiez les couleurs dans `tailwind.config.js`
- **Types de champs** : Ajoutez de nouveaux types dans `models.py`
- **Interface** : Personnalisez les composants dans `src/components/`

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

Les contributions sont les bienvenues ! Voici comment participer :

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
2. Créez une nouvelle issue avec :
   - Description du problème
   - Étapes pour reproduire
   - Environnement (OS, versions, etc.)

## 📞 Contact

**Auteur** : Kazury  
**Repository** : [https://github.com/Kazuryy/cochin-project-manager](https://github.com/Kazuryy/cochin-project-manager)

---

⭐ N'hésitez pas à star le projet si il vous est utile !