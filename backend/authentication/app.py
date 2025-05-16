from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _

class AuthenticationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'authentication'
    verbose_name = _('Authentication')
    
    def ready(self):
        """
        Importer les signaux au démarrage de l'application
        """
        import authentication.signals