# backend/dyndb/apps.py
from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _

class DynamicDatabaseConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'database'
    verbose_name = _('Tables dynamiques')
    
    def ready(self):
        # Importer les signaux au démarrage de l'application
        import database.signals