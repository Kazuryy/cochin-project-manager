# 🛠️ Documentation Développement

Cette section contient la documentation pour configurer l'environnement de développement et contribuer au projet.

## 📋 **Guides de développement**

### 🎨 **Frontend**
- **[Configuration Frontend](./frontend-setup.md)** - Installation et configuration du frontend React
- **[Rebuild Frontend](./frontend-force-build.md)** - Reconstruction forcée du frontend

### 🔧 **Backend**  
- **[Rebuild Backend](./README_FORCE_BUILD.md)** - Reconstruction forcée du backend Django

---

## 🚀 **Démarrage rapide développement**

```bash
# 1. Clone du projet
git clone https://github.com/Kazuryy/cochin-project-manager.git
cd cochin-project-manager

# 2. Démarrage en mode développement
docker-compose -f docker-compose.local.yml up --build

# 3. Accès à l'application
# Frontend: http://localhost:1337
# Backend API: http://localhost:8000
```

## 🗂️ **Structure du projet**

```
cochin-project-manager/
├── backend/          # API Django + Django REST Framework
├── frontend/         # Interface React + Vite + TailwindCSS + DaisyUI
├── data/            # Données persistantes (DB, médias, logs)
├── docs/            # Documentation technique
├── wiki/            # Documentation fonctionnelle
└── docker-compose.*.yml # Configurations Docker
```

## 🔄 **Workflow de développement**

1. **Créer une branche** pour votre fonctionnalité
2. **Développer** avec hot-reload activé
3. **Tester** localement avec `docker-compose.local.yml`
4. **Commit** et **push** sur votre branche
5. **Créer une Pull Request**

## 🛠️ **Outils de développement**

| Outil | Usage | Configuration |
|-------|-------|---------------|
| **ESLint** | Linting JS/React | `frontend/eslint.config.js` |
| **Tailwind** | CSS utility-first | `frontend/tailwind.config.js` |
| **Vite** | Build tool React | `frontend/vite.config.js` |
| **Django Debug** | Backend debugging | `DEBUG=True` en local |

## 📦 **Gestion des dépendances**

### Frontend
```bash
cd frontend
npm install          # Installer les dépendances
npm run dev         # Démarrage développement
npm run build       # Build production
```

### Backend
```bash
cd backend
pip install -r requirements.txt  # Installer les dépendances
python manage.py migrate         # Migrations DB
python manage.py runserver       # Démarrage développement
```

---

[← Retour à la documentation principale](../README.md) 