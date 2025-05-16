from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password, ValidationError
import json
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

@login_required
@require_POST
def change_password(request):
    """
    Vue pour le changement de mot de passe par l'utilisateur connecté
    """
    try:
        data = json.loads(request.body)
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        
        # Vérifier si l'utilisateur a fourni le bon mot de passe actuel
        if not request.user.check_password(current_password):
            return JsonResponse({
                'success': False,
                'message': 'Le mot de passe actuel est incorrect'
            }, status=400)
        
        # Vérifier si le nouveau mot de passe est différent de l'ancien
        if current_password == new_password:
            return JsonResponse({
                'success': False,
                'message': 'Le nouveau mot de passe doit être différent de l\'ancien'
            }, status=400)
        
        # Vérifier la complexité du mot de passe et autres validations
        try:
            validate_password(new_password, request.user)
            
            # Changer le mot de passe
            request.user.set_password(new_password)
            
            # Mettre à jour les champs liés au changement de mot de passe
            request.user.last_password_change = timezone.now()
            request.user.is_password_expired = False
            request.user.require_password_change = False
            request.user.save()
            
            # Journaliser le changement de mot de passe
            logger.info(f"Mot de passe changé pour l'utilisateur {request.user.username}")
            
            return JsonResponse({
                'success': True,
                'message': 'Mot de passe modifié avec succès'
            })
        except ValidationError as e:
            error_messages = [str(msg) for msg in e.messages]
            return JsonResponse({
                'success': False,
                'message': ' '.join(error_messages)
            }, status=400)
            
    except Exception as e:
        logger.error(f"Erreur lors du changement de mot de passe: {str(e)}")
        return JsonResponse({
            'success': False,
            'message': 'Une erreur s\'est produite lors du changement de mot de passe'
        }, status=500)