from django.contrib import admin
from django.utils.html import format_html
from django.urls import path, reverse
from django.http import HttpResponseRedirect
from django.contrib import messages
from django.utils import timezone
from .models import BackupConfiguration, BackupHistory, RestoreHistory
from .services import BackupService

# Constantes pour éviter la duplication
FIELDSET_METADATA = 'Métadonnées'


@admin.register(BackupConfiguration)
class BackupConfigurationAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'backup_type', 'frequency', 'is_active', 
        'compression_enabled', 'retention_days',
        'created_at', 'created_by'
    ]
    list_filter = [
        'backup_type', 'frequency', 'is_active', 
        'compression_enabled'
    ]
    search_fields = ['name', 'created_by__username']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Configuration générale', {
            'fields': ('name', 'backup_type', 'frequency', 'is_active')
        }),
        ('Options de sauvegarde', {
            'fields': ('include_files', 'compression_enabled'),
            'description': '🔒 Toutes les sauvegardes sont automatiquement chiffrées avec AES-256'
        }),
        ('Rétention', {
            'fields': ('retention_days',)
        }),
        (FIELDSET_METADATA, {
            'fields': ('created_at', 'updated_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change:  # Création
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('<int:config_id>/run-backup/', self.run_backup_view, name='run_backup'),
        ]
        return custom_urls + urls
    
    def run_backup_view(self, request, config_id):
        """Vue pour lancer une sauvegarde manuellement"""
        try:
            config = BackupConfiguration.objects.get(id=config_id)
            backup_service = BackupService()
            
            # Lancement de la sauvegarde en arrière-plan
            backup_history = backup_service.create_backup(config, request.user)
            
            messages.success(request, f"Sauvegarde '{backup_history.backup_name}' lancée avec succès!")
            
        except BackupConfiguration.DoesNotExist:
            messages.error(request, "Configuration de sauvegarde introuvable")
        except Exception as e:
            messages.error(request, f"Erreur lors du lancement de la sauvegarde: {str(e)}")
        
        return HttpResponseRedirect(reverse('admin:backup_manager_backupconfiguration_changelist'))


@admin.register(BackupHistory)
class BackupHistoryAdmin(admin.ModelAdmin):
    list_display = [
        'backup_name', 'backup_type', 'status_colored', 'file_size_formatted',
        'duration_formatted', 'started_at', 'created_by'
    ]
    list_filter = [
        'status', 'backup_type', 'started_at', 'configuration'
    ]
    search_fields = ['backup_name', 'created_by__username']
    readonly_fields = [
        'backup_name', 'status', 'backup_type', 'file_path', 'file_size',
        'checksum', 'tables_count', 'records_count', 'files_count',
        'started_at', 'completed_at', 'duration_seconds', 'log_data',
        'error_message', 'created_at', 'created_by'
    ]
    
    fieldsets = (
        ('Informations générales', {
            'fields': ('backup_name', 'configuration', 'backup_type', 'status')
        }),
        ('Fichier de sauvegarde', {
            'fields': ('file_path', 'file_size', 'checksum')
        }),
        ('Statistiques', {
            'fields': ('tables_count', 'records_count', 'files_count')
        }),
        ('Timing', {
            'fields': ('started_at', 'completed_at', 'duration_seconds')
        }),
        ('Logs et erreurs', {
            'fields': ('log_data', 'error_message'),
            'classes': ('collapse',)
        }),
        (FIELDSET_METADATA, {
            'fields': ('created_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        return False  # Pas de création manuelle d'historique
    
    def has_change_permission(self, request, obj=None):
        return False  # Lecture seule
    
    def status_colored(self, obj):
        colors = {
            'pending': '#ffc107',
            'running': '#007bff',
            'completed': '#28a745',
            'failed': '#dc3545',
            'cancelled': '#6c757d'
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_colored.short_description = 'Statut'
    
    def file_size_formatted(self, obj):
        if obj.file_size:
            return obj.__class__.format_size(obj.file_size)
        return "—"
    file_size_formatted.short_description = 'Taille'
    
    def duration_formatted(self, obj):
        return obj.duration_formatted
    duration_formatted.short_description = 'Durée'


@admin.register(RestoreHistory)
class RestoreHistoryAdmin(admin.ModelAdmin):
    list_display = [
        'restore_name', 'restore_type', 'status_colored', 
        'backup_source', 'duration_formatted', 'started_at', 'created_by'
    ]
    list_filter = [
        'status', 'restore_type', 'started_at'
    ]
    search_fields = ['restore_name', 'created_by__username']
    readonly_fields = [
        'backup_source', 'restore_name', 'restore_type', 'status',
        'restore_options', 'tables_restored', 'records_restored', 'files_restored',
        'started_at', 'completed_at', 'duration_seconds', 'log_data',
        'error_message', 'created_at', 'created_by'
    ]
    
    fieldsets = (
        ('Informations générales', {
            'fields': ('restore_name', 'backup_source', 'restore_type', 'status')
        }),
        ('Options de restauration', {
            'fields': ('restore_options',)
        }),
        ('Statistiques', {
            'fields': ('tables_restored', 'records_restored', 'files_restored')
        }),
        ('Timing', {
            'fields': ('started_at', 'completed_at', 'duration_seconds')
        }),
        ('Logs et erreurs', {
            'fields': ('log_data', 'error_message'),
            'classes': ('collapse',)
        }),
        (FIELDSET_METADATA, {
            'fields': ('created_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        return False  # Pas de création manuelle d'historique
    
    def has_change_permission(self, request, obj=None):
        return False  # Lecture seule
    
    def status_colored(self, obj):
        colors = {
            'pending': '#ffc107',
            'running': '#007bff',
            'completed': '#28a745',
            'failed': '#dc3545',
            'cancelled': '#6c757d'
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_colored.short_description = 'Statut'
    
    def duration_formatted(self, obj):
        return obj.duration_formatted if hasattr(obj, 'duration_formatted') else "—"
    duration_formatted.short_description = 'Durée'


# Configuration du site admin
admin.site.site_header = "Gestionnaire de Sauvegardes"
admin.site.site_title = "Backup Manager"
admin.site.index_title = "Administration des Sauvegardes"
