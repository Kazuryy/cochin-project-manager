from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """
    Interface d'administration personnalisée pour notre modèle User
    """
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 
                   'failed_login_attempts', 'is_password_expired', 'account_locked_until')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'is_password_expired', 'require_password_change')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    
    # Ajouter des sections pour les champs personnalisés
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        (_('Informations personnelles'), {'fields': ('first_name', 'last_name', 'email')}),
        (_('Permissions'), {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        (_('Dates importantes'), {'fields': ('last_login', 'date_joined', 'last_password_change')}),
        (_('Sécurité du compte'), {
            'fields': ('failed_login_attempts', 'account_locked_until', 
                       'is_password_expired', 'require_password_change'),
        }),
    )
    
    readonly_fields = ('last_login', 'date_joined', 'last_password_change')
    
    # Ajouter nos champs personnalisés lors de la création d'un utilisateur
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2'),
        }),
        (_('Paramètres de sécurité'), {
            'classes': ('wide',),
            'fields': ('is_password_expired', 'require_password_change'),
        }),
    )
    
    actions = ['unlock_accounts', 'reset_failed_attempts', 'force_password_change']
    
    def unlock_accounts(self, request, queryset):
        """
        Action d'administration pour déverrouiller les comptes sélectionnés
        """
        queryset.update(account_locked_until=None, failed_login_attempts=0)
        self.message_user(request, _("Les comptes sélectionnés ont été déverrouillés."))
    unlock_accounts.short_description = _("Déverrouiller les comptes sélectionnés")
    
    def reset_failed_attempts(self, request, queryset):
        """
        Action d'administration pour réinitialiser les tentatives de connexion échouées
        """
        queryset.update(failed_login_attempts=0)
        self.message_user(request, _("Les tentatives de connexion ont été réinitialisées."))
    reset_failed_attempts.short_description = _("Réinitialiser les tentatives de connexion")
    
    def force_password_change(self, request, queryset):
        """
        Action d'administration pour forcer le changement de mot de passe
        """
        queryset.update(require_password_change=True, is_password_expired=True)
        self.message_user(request, _("Les utilisateurs sélectionnés devront changer leur mot de passe."))
    force_password_change.short_description = _("Forcer le changement de mot de passe")