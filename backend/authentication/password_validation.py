from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _
from django.conf import settings
from .models import PasswordHistory

class MinimumLengthValidator:
    """
    Valide que le mot de passe a une longueur minimale.
    Recommandation ANSSI : 12 caractères minimum.
    """
    def __init__(self, min_length=12):
        self.min_length = min_length

    def validate(self, password):
        if len(password) < self.min_length:
            raise ValidationError(
                _("Ce mot de passe est trop court. Il doit contenir au moins %(min_length)d caractères."),
                code='password_too_short',
                params={'min_length': self.min_length},
            )

    def get_help_text(self):
        return _(
            "Votre mot de passe doit contenir au moins %(min_length)d caractères."
            % {'min_length': self.min_length}
        )

class ComplexityValidator:
    """
    Valide que le mot de passe contient différents types de caractères.
    Recommandation ANSSI : au moins 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial.
    """
    def validate(self, password):
        if not any(char.isupper() for char in password):
            raise ValidationError(
                _("Le mot de passe doit contenir au moins une lettre majuscule."),
                code='password_no_upper',
            )
        if not any(char.islower() for char in password):
            raise ValidationError(
                _("Le mot de passe doit contenir au moins une lettre minuscule."),
                code='password_no_lower',
            )
        if not any(char.isdigit() for char in password):
            raise ValidationError(
                _("Le mot de passe doit contenir au moins un chiffre."),
                code='password_no_digit',
            )
        if not any(not char.isalnum() for char in password):
            raise ValidationError(
                _("Le mot de passe doit contenir au moins un caractère spécial."),
                code='password_no_special',
            )

    def get_help_text(self):
        return _(
            "Votre mot de passe doit contenir au moins une lettre majuscule, "
            "une lettre minuscule, un chiffre et un caractère spécial."
        )

class UserAttributeSimilarityValidator:
    """
    Valide que le mot de passe n'est pas trop similaire aux attributs de l'utilisateur.
    """
    def __init__(self, user_attributes=('username', 'first_name', 'last_name', 'email'), max_similarity=0.7):
        self.user_attributes = user_attributes
        self.max_similarity = max_similarity

    def validate(self, password, user=None):
        if not user:
            return

        for attribute_name in self.user_attributes:
            value = getattr(user, attribute_name, None)
            if not value or not isinstance(value, str):
                continue
            value_lower = value.lower()
            password_lower = password.lower()
            if value_lower in password_lower or password_lower in value_lower:
                raise ValidationError(
                    _("Le mot de passe est trop similaire à vos informations personnelles."),
                    code='password_too_similar',
                )

    def get_help_text(self):
        return _("Votre mot de passe ne peut pas être trop similaire à vos autres informations personnelles.")

class HistoryValidator:
    """
    Valide que le mot de passe n'a pas déjà été utilisé récemment.
    """
    def __init__(self, history_limit=5):
        self.history_limit = history_limit

    def validate(self, password, user=None):
        if not user or not user.pk:
            return
        
        # Récupérer l'historique des mots de passe
        history = PasswordHistory.objects.filter(user=user).order_by('-created_at')[:self.history_limit]
        
        # Vérifier si le mot de passe est dans l'historique
        for history_entry in history:
            if history_entry.check_password(password):
                raise ValidationError(
                    _("Ce mot de passe a déjà été utilisé récemment. Veuillez en choisir un nouveau."),
                    code='password_already_used',
                )

    def get_help_text(self):
        return _("Votre mot de passe ne peut pas avoir été utilisé récemment.")