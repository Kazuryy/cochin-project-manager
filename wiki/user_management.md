# Documentation du système d'authentification - Cochin Project Manager

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Backend (Django)](#backend-django)
   - [Modèle utilisateur](#modèle-utilisateur)
   - [Validation des mots de passe](#validation-des-mots-de-passe)
   - [Historique des mots de passe](#historique-des-mots-de-passe)
   - [Gestion de la sécurité](#gestion-de-la-sécurité)
   - [API d'authentification](#api-dauthentification)
4. [Frontend (React)](#frontend-react)
   - [Contexte d'authentification](#contexte-dauthentification)
   - [Hook useAuth](#hook-useauth)
   - [Composants d'authentification](#composants-dauthentification)
   - [Protection des routes](#protection-des-routes)
5. [Flux d'authentification](#flux-dauthentification)
   - [Connexion](#connexion)
   - [Vérification d'authentification](#vérification-dauthentification)
   - [Déconnexion](#déconnexion)
   - [Changement de mot de passe obligatoire](#changement-de-mot-de-passe-obligatoire)
6. [Mesures de sécurité](#mesures-de-sécurité)
   - [Protection contre le brute force](#protection-contre-le-brute-force)
   - [Expiration des mots de passe](#expiration-des-mots-de-passe)
   - [Stratégie CSRF](#stratégie-csrf)
7. [Maintenance et débogage](#maintenance-et-débogage)
   - [Journalisation](#journalisation)
   - [Admin Django](#admin-django)
   - [Problèmes courants](#problèmes-courants)

## Vue d'ensemble

Le système d'authentification du projet Cochin Project Manager est conforme aux recommandations de l'ANSSI (Agence Nationale de la Sécurité des Systèmes d'Information). Il comprend les fonctionnalités suivantes :

- Authentification sécurisée basée sur nom d'utilisateur/mot de passe
- Hashage robuste des mots de passe avec l'algorithme PBKDF2-SHA256
- Politique de mots de passe robustes (longueur, complexité)
- Historique des mots de passe pour éviter leur réutilisation
- Verrouillage de compte après plusieurs tentatives échouées
- Expiration automatique des mots de passe après 90 jours
- Changement obligatoire de mot de passe sous certaines conditions
- Protection CSRF sur toutes les requêtes d'authentification

## Architecture

L'architecture du système d'authentification repose sur deux parties distinctes :

1. **Backend (Django)** :
   - Modèle utilisateur personnalisé (`User`)
   - Modèle d'historique des mots de passe (`PasswordHistory`)
   - API REST pour l'authentification 
   - Validation des mots de passe et gestion de la sécurité

2. **Frontend (React)** :
   - Contexte d'authentification global (`AuthContext`)
   - Composants pour la connexion et le changement de mot de passe
   - Protection des routes nécessitant une authentification
   - Gestion des tokens CSRF

## Backend (Django)

### Modèle utilisateur

Le système utilise un modèle utilisateur personnalisé qui étend `AbstractUser` de Django, défini dans `authentication/models.py`.

**Champs spécifiques à la sécurité** :

```python
class User(AbstractUser):
    last_password_change = models.DateTimeField(
        _('date of last password change'),
        default=timezone.now
    )
    failed_login_attempts = models.PositiveIntegerField(
        _('failed login attempts'),
        default=0
    )
    account_locked_until = models.DateTimeField(
        _('account locked until'),
        null=True,
        blank=True
    )
    is_password_expired = models.BooleanField(
        _('password expired'),
        default=False
    )
    require_password_change = models.BooleanField(
        _('password change required'),
        default=True
    )
```

**Sécurité des mots de passe** :

Django utilise un système robuste de hashage (et non de chiffrement) pour sécuriser les mots de passe. Il est important de comprendre la différence :
- Le **chiffrement** est réversible avec une clé de déchiffrement
- Le **hashage** est un processus à sens unique, irréversible

Par défaut, Django utilise l'algorithme PBKDF2 avec un SHA256 hash, incluant un sel aléatoire et plusieurs itérations (par défaut 390000 dans Django 5.2), ce qui le rend résistant aux attaques par table arc-en-ciel et par force brute. Django augmente automatiquement le nombre d'itérations dans les nouvelles versions pour maintenir un niveau de sécurité élevé.

Le champ `password` hérité de `AbstractUser` stocke les mots de passe sous forme hashée dans ce format :
```
algorithm$iterations$salt$hash
```

Exemple : 
```
pbkdf2_sha256$390000$SAlt123456wXyZ$HashedPasswordValue123456789
```

Django gère automatiquement tout ce processus via les méthodes :
- `set_password(raw_password)` : Applique le hashage avant stockage
- `check_password(raw_password)` : Compare le mot de passe en clair avec le hash stocké
```

**Méthodes principales** :

- `lock_account(duration_minutes=15)` : Verrouille le compte pendant la durée spécifiée
- `is_account_locked()` : Vérifie si le compte est verrouillé
- `increment_failed_login()` : Incrémente le compteur d'échecs de connexion et verrouille le compte si nécessaire
- `reset_failed_login()` : Réinitialise le compteur d'échecs après une connexion réussie
- `check_password_expiry()` : Vérifie si le mot de passe a expiré (90 jours)
- `set_password(raw_password)` : Remplace la méthode standard pour gérer les changements de mot de passe

### Validation des mots de passe

Les validateurs de mots de passe sont définis dans `authentication/password_validation.py`, conformément aux recommandations de l'ANSSI :

1. **MinimumLengthValidator** : Exige une longueur minimale de 12 caractères.
2. **ComplexityValidator** : Exige au moins une majuscule, une minuscule, un chiffre et un caractère spécial.
3. **UserAttributeSimilarityValidator** : Empêche l'utilisation d'informations personnelles dans le mot de passe.
4. **HistoryValidator** : Interdit la réutilisation des derniers mots de passe.

Ces validateurs sont configurés dans `settings.py` :

```python
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 12,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]
```

### Historique des mots de passe

Le modèle `PasswordHistory` stocke les précédents mots de passe des utilisateurs :

```python
class PasswordHistory(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_history',
        verbose_name=_('user')
    )
    password = models.CharField(
        _('password'),
        max_length=128
    )
    created_at = models.DateTimeField(
        _('creation date'),
        auto_now_add=True
    )
```

Le champ `password` stocke les mots de passe sous leur forme hashée, avec le même niveau de sécurité que le mot de passe actif. La méthode `check_password` de cette classe permet de comparer un mot de passe en clair avec les hashs stockés dans l'historique.

Un signal post-save dans `authentication/signals.py` maintient automatiquement l'historique :

```python
@receiver(post_save, sender=User)
def save_password_history(sender, instance, **kwargs):
    # Vérifier si le mot de passe a été modifié et n'est pas vide
    if instance.password and instance._password:
        # Sauvegarder le mot de passe hashé dans l'historique
        PasswordHistory.objects.create(
            user=instance,
            password=instance.password
        )
        
        # Limiter l'historique aux 5 derniers mots de passe
        history_limit = getattr(settings, 'PASSWORD_HISTORY_LIMIT', 5)
        old_passwords = PasswordHistory.objects.filter(user=instance).order_by('-created_at')[history_limit:]
        
        if old_passwords.exists():
            old_passwords.delete()
```

### Gestion de la sécurité

La configuration de sécurité principale est définie dans `settings.py` :

```python
PASSWORD_RESET_TIMEOUT = 3600  # Délai d'expiration des liens de réinitialisation (1h)
ACCOUNT_LOCKOUT_DURATION = 15  # Durée de verrouillage en minutes
MAX_LOGIN_ATTEMPTS = 5         # Nombre max de tentatives de connexion échouées
PASSWORD_EXPIRY_DAYS = 90      # Expiration des mots de passe en jours
```

### API d'authentification

Les points d'entrée API sont définis dans `authentication/urls.py` :

```python
urlpatterns = [
    path('csrf/', views.get_csrf_token, name='csrf_token'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('check/', views.check_auth_view, name='check_auth'),
    path('change-password/', views_password.change_password, name='change_password'),
]
```

Fonctions principales :

1. **get_csrf_token** : Génère un jeton CSRF à utiliser pour les requêtes authentifiées
2. **login_view** : Gère la connexion avec vérification de verrouillage et incrémentation des tentatives
3. **logout_view** : Gère la déconnexion
4. **check_auth_view** : Vérifie si l'utilisateur est authentifié et retourne ses informations
5. **change_password** : Gère le changement de mot de passe avec validation complète

## Frontend (React)

### Contexte d'authentification

Le contexte d'authentification (`AuthContext`) est défini dans `hooks/authContext.js` et fournit un état global d'authentification à toute l'application.

```javascript
export const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  authError: null,
  login: () => Promise.reject(new Error('AuthProvider non trouvé')),
  logout: () => Promise.reject(new Error('AuthProvider non trouvé')),
  getCsrfToken: () => Promise.reject(new Error('AuthProvider non trouvé')),
});
```

L'implémentation du provider est dans `hooks/AuthProvider.jsx`, avec les fonctions et états suivants :

- **États** :
  - `user` : Informations sur l'utilisateur connecté
  - `isAuthenticated` : Booléen indiquant si l'utilisateur est authentifié
  - `isLoading` : Booléen indiquant si la vérification d'authentification est en cours
  - `authError` : Message d'erreur d'authentification éventuel

- **Fonctions** :
  - `login(credentials)` : Connexion de l'utilisateur
  - `logout()` : Déconnexion
  - `getCsrfToken()` : Récupération d'un jeton CSRF

L'`AuthProvider` est installé à la racine de l'application dans `App.jsx` :

```jsx
function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
```

### Hook useAuth

Le hook `useAuth` permet d'accéder facilement au contexte d'authentification depuis n'importe quel composant :

```javascript
import { useContext } from 'react';
import { AuthContext } from './authContext';

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  
  return context;
}
```

Exemple d'utilisation :

```jsx
function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  
  // Utilisation des données d'authentification...
}
```

### Composants d'authentification

Plusieurs composants gèrent l'authentification côté frontend :

1. **Login.jsx** : Formulaire de connexion avec gestion des erreurs et tentatives maximales
2. **PasswordChangeForm.jsx** : Formulaire de changement de mot de passe avec validation côté client
3. **PasswordChangeCheck.jsx** : Vérifie si l'utilisateur doit changer son mot de passe et affiche le formulaire si nécessaire

Exemple de validation côté client dans `PasswordChangeForm.jsx` :

```javascript
const validateForm = (values) => {
  const errors = {};
  
  if (!values.currentPassword) {
    errors.currentPassword = 'Le mot de passe actuel est requis';
  }
  
  if (!values.newPassword) {
    errors.newPassword = 'Le nouveau mot de passe est requis';
  } else if (values.newPassword.length < 12) {
    errors.newPassword = 'Le mot de passe doit contenir au moins 12 caractères';
  } else if (!/[A-Z]/.test(values.newPassword)) {
    errors.newPassword = 'Le mot de passe doit contenir au moins une majuscule';
  } else if (!/[a-z]/.test(values.newPassword)) {
    errors.newPassword = 'Le mot de passe doit contenir au moins une minuscule';
  } else if (!/\d/.test(values.newPassword)) {
    errors.newPassword = 'Le mot de passe doit contenir au moins un chiffre';
  } else if (!/[^A-Za-z0-9]/.test(values.newPassword)) {
    errors.newPassword = 'Le mot de passe doit contenir au moins un caractère spécial';
  }
  
  if (!values.confirmPassword) {
    errors.confirmPassword = 'La confirmation du mot de passe est requise';
  } else if (values.newPassword !== values.confirmPassword) {
    errors.confirmPassword = 'Les mots de passe ne correspondent pas';
  }
  
  return errors;
};
```

### Protection des routes

Le composant `ProtectedRoute` dans `components/routes/ProtectedRoute.jsx` protège les routes nécessitant une authentification :

```jsx
function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const [isReady, setIsReady] = useState(false);
  
  // Utiliser useEffect pour confirmer la fin de la vérification d'authentification
  useEffect(() => {
    if (!isLoading) {
      setIsReady(true);
    }
  }, [isLoading]);
  
  // Afficher un spinner pendant le chargement
  if (isLoading || !isReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }
  
  // Rediriger vers la page de connexion si non authentifié
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  
  // Vérifier les droits d'administrateur si nécessaire
  if (requireAdmin && user && !user.is_staff) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}
```

Son utilisation dans `App.jsx` :

```jsx
<Route 
  path="/dashboard" 
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } 
/>
```

## Flux d'authentification

### Connexion

1. L'utilisateur accède à `/login` et remplit le formulaire de connexion
2. Le frontend obtient d'abord un jeton CSRF avec `getCsrfToken()`
3. Le frontend envoie une requête POST à `/api/auth/login/` avec le jeton CSRF
4. Le backend vérifie si le compte est verrouillé via `is_account_locked()`
5. Si le compte n'est pas verrouillé, le backend tente d'authentifier l'utilisateur
6. En cas d'échec, le backend incrémente `failed_login_attempts` et verrouille le compte après 5 tentatives
7. En cas de succès, le backend réinitialise `failed_login_attempts` et met à jour `last_login`
8. Le backend vérifie si le mot de passe a expiré via `check_password_expiry()`
9. Le backend retourne les informations utilisateur, y compris `require_password_change`
10. Le frontend met à jour le contexte d'authentification avec `isAuthenticated = true` et les données utilisateur

### Vérification d'authentification

1. L'`AuthProvider` vérifie l'état d'authentification au chargement via une requête à `/api/auth/check/`
2. Le backend vérifie si l'utilisateur est authentifié via `request.user.is_authenticated`
3. Si authentifié, le backend vérifie l'expiration du mot de passe via `check_password_expiry()`
4. Le backend retourne les informations utilisateur et `require_password_change`
5. Le frontend met à jour le contexte d'authentification en conséquence

### Déconnexion

1. L'utilisateur clique sur "Déconnexion"
2. Le frontend obtient un jeton CSRF avec `getCsrfToken()`
3. Le frontend envoie une requête POST à `/api/auth/logout/` avec le jeton CSRF
4. Le backend appelle `logout(request)` pour terminer la session
5. Le frontend met à jour le contexte d'authentification avec `isAuthenticated = false` et `user = null`

### Changement de mot de passe obligatoire

1. Après la connexion, si `user.require_password_change` est `true`, le composant `PasswordChangeCheck` intercepte l'affichage normal
2. L'utilisateur est contraint de changer son mot de passe avant d'accéder à l'application
3. Le formulaire `PasswordChangeForm` s'affiche avec validation côté client
4. Une fois le formulaire rempli, le frontend envoie une requête POST à `/api/auth/change-password/`
5. Le backend valide le nouveau mot de passe (longueur, complexité, non-présence dans l'historique)
6. Le backend met à jour `require_password_change = false`, `is_password_expired = false` et `last_password_change = now()`
7. L'interface utilisateur normale est ensuite affichée

## Mesures de sécurité

### Protection contre le brute force

Le système implémente plusieurs mesures contre les attaques par force brute :

1. **Verrouillage de compte** : Après 5 tentatives de connexion échouées (`MAX_LOGIN_ATTEMPTS`), le compte est verrouillé pendant 15 minutes (`ACCOUNT_LOCKOUT_DURATION`)
2. **Journalisation** : Toutes les tentatives de connexion échouées sont enregistrées avec l'adresse IP
3. **Temps de réponse constant** : Le temps de réponse pour les utilisateurs inexistants est similaire à celui des utilisateurs existants pour éviter l'énumération

### Hashage robuste des mots de passe

Le système s'appuie sur les mécanismes de sécurité de Django pour protéger les mots de passe :

1. **Algorithme PBKDF2 avec SHA256** : Algorithme recommandé pour sa résistance aux attaques
2. **Sel (salt) aléatoire unique** : Chaque mot de passe a son propre sel pour éviter les attaques par table de correspondance
3. **Itérations multiples** : Par défaut, Django 5.2 utilise 390 000 itérations, ce qui augmente considérablement le coût computationnel d'une attaque
4. **Mise à niveau automatique** : Django peut automatiquement rehacher les mots de passe avec des paramètres plus sécurisés lors de la connexion

Ce mécanisme de hashage s'applique également aux mots de passe stockés dans l'historique.

### Expiration des mots de passe

Pour respecter les recommandations ANSSI :

1. Les mots de passe expirent après 90 jours (`PASSWORD_EXPIRY_DAYS`)
2. Un signal `check_password_expiry` vérifie automatiquement l'expiration à chaque sauvegarde utilisateur
3. Le frontend force le changement de mot de passe via `PasswordChangeCheck` si nécessaire

### Stratégie CSRF

La protection CSRF est assurée par :

1. Django côté backend avec le middleware `CsrfViewMiddleware`
2. L'endpoint `/api/auth/csrf/` pour obtenir un jeton CSRF
3. La fonction `getCsrfToken()` côté frontend qui récupère et stocke le jeton
4. L'ajout de l'en-tête `X-CSRFToken` à toutes les requêtes d'authentification

## Maintenance et débogage

### Journalisation

Le système utilise la configuration de journalisation Django dans `settings.py` :

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'app.log',
            'formatter': 'verbose',
        },
        'security': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'security.log',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django.security': {
            'handlers': ['security'],
            'level': 'INFO',
            'propagate': False,
        },
        'authentication': {
            'handlers': ['file', 'security'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
```

Les événements d'authentification importants sont journalisés :
- Connexions réussies et échouées
- Verrouillages de compte
- Changements de mot de passe
- Expirations de mot de passe

### Admin Django

L'interface d'administration personnalisée dans `authentication/admin.py` facilite la gestion des utilisateurs :

**Actions d'administration** :
- `unlock_accounts` : Déverrouille les comptes sélectionnés
- `reset_failed_attempts` : Réinitialise les tentatives de connexion échouées
- `force_password_change` : Force le changement de mot de passe

**Champs affichés** :
- Tentatives de connexion échouées
- Verrouillage de compte
- Expiration du mot de passe
- Date du dernier changement de mot de passe

### Problèmes courants

1. **Compte verrouillé** : Utiliser l'action `unlock_accounts` dans l'admin Django ou attendre la fin de la période de verrouillage (15 minutes par défaut)

2. **L'utilisateur ne peut pas se connecter malgré des identifiants corrects** :
   - Vérifier `account_locked_until` dans l'admin
   - Vérifier `is_active` (désactivé?)
   - Examiner les logs de sécurité

3. **Erreurs CSRF** :
   - Vérifier que l'en-tête `X-CSRFToken` est correctement envoyé
   - Vérifier que les cookies CSRF sont correctement stockés
   - Vérifier si `CSRF_TRUSTED_ORIGINS` inclut l'origine frontend

4. **Problèmes de changement de mot de passe** :
   - Vérifier les logs pour les erreurs de validation
   - Vérifier si le nouveau mot de passe respecte toutes les contraintes (longueur, complexité)
   - Vérifier si le mot de passe n'est pas dans l'historique récent