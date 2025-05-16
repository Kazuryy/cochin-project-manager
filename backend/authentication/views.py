from django.contrib.auth import get_user_model, authenticate, login, logout
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST, require_GET
from django.middleware.csrf import get_token
import json
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

@ensure_csrf_cookie
@require_GET
def get_csrf_token(request):
    """
    Endpoint pour obtenir un jeton CSRF.
    Doit être appelé avant tout appel authentifié.
    """
    token = get_token(request)
    return JsonResponse({'csrfToken': token})

@require_POST
def login_view(request):
    """
    Vue pour la connexion des utilisateurs
    """
    try:
        data = json.loads(request.body)
        username = data.get('username', '')
        password = data.get('password', '')
        
        # Tentative de récupération de l'utilisateur
        try:
            user = User.objects.get(username=username)
            
            # Vérifier si le compte est verrouillé
            if user.is_account_locked():
                return JsonResponse({
                    'success': False,
                    'message': 'Compte temporairement verrouillé. Veuillez réessayer plus tard.'
                }, status=403)
                
        except User.DoesNotExist:
            # Simuler une authentification pour éviter l'énumération des utilisateurs
            # (même temps de réponse que pour un utilisateur existant)
            authenticate(request, username=username, password=password)
            return JsonResponse({
                'success': False,
                'message': 'Identifiants incorrects.'
            }, status=401)
            
        # Tentative d'authentification
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            # Réinitialiser les tentatives de connexion échouées
            user.reset_failed_login()
            
            # Vérifier si le mot de passe a expiré
            user.check_password_expiry()
            
            # Connexion de l'utilisateur
            login(request, user)
            
            # Journalisation de la connexion réussie
            logger.info(f"Connexion réussie pour l'utilisateur {username} depuis {request.META.get('REMOTE_ADDR')}")
            
            return JsonResponse({
                'success': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'is_staff': user.is_staff,
                    'require_password_change': user.require_password_change,
                }
            })
        else:
            # Incrémentation des tentatives de connexion échouées
            try:
                user = User.objects.get(username=username)
                user.increment_failed_login()
                
                # Journalisation de la tentative échouée
                logger.warning(f"Tentative de connexion échouée pour {username} depuis {request.META.get('REMOTE_ADDR')}")
                
            except User.DoesNotExist:
                # Ne rien faire si l'utilisateur n'existe pas
                pass
                
            return JsonResponse({
                'success': False,
                'message': 'Identifiants incorrects.'
            }, status=401)
            
    except Exception as e:
        logger.error(f"Erreur lors de la connexion: {str(e)}")
        return JsonResponse({
            'success': False,
            'message': 'Une erreur s\'est produite lors de la connexion.'
        }, status=500)

@require_POST
def logout_view(request):
    """
    Vue pour la déconnexion des utilisateurs
    """
    if request.user.is_authenticated:
        username = request.user.username
        logout(request)
        logger.info(f"Déconnexion réussie pour l'utilisateur {username}")
        
    return JsonResponse({'success': True})

@require_GET
def check_auth_view(request):
    """
    Vue pour vérifier l'état d'authentification de l'utilisateur
    """
    if request.user.is_authenticated:
        # Vérifier si le mot de passe a expiré
        request.user.check_password_expiry()
        
        return JsonResponse({
            'isAuthenticated': True,
            'user': {
                'id': request.user.id,
                'username': request.user.username,
                'is_staff': request.user.is_staff,
                'require_password_change': request.user.require_password_change,
            }
        })
    else:
        return JsonResponse({'isAuthenticated': False}, status=401)