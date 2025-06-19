"""
URLs pour l'API de sauvegarde/restauration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Configuration du router REST
router = DefaultRouter()
# Configurations de sauvegarde - CRUD complet via /api/backup/configurations/
# - GET /api/backup/configurations/ - Liste toutes les configurations
# - POST /api/backup/configurations/ - Crée une nouvelle configuration
# - GET /api/backup/configurations/{id}/ - Détails d'une configuration
# - PUT /api/backup/configurations/{id}/ - Met à jour une configuration
# - DELETE /api/backup/configurations/{id}/ - Supprime une configuration
router.register(r'configurations', views.BackupConfigurationViewSet, basename='backupconfig')

# Historique des sauvegardes - Lecture seule via /api/backup/history/
# - GET /api/backup/history/ - Liste l'historique des sauvegardes
# - GET /api/backup/history/{id}/ - Détails d'une sauvegarde
# - DELETE /api/backup/history/{id}/ - Supprime une sauvegarde (ajouté par destroy)
router.register(r'history', views.BackupHistoryViewSet, basename='backuphistory')

# Historique des restaurations - Lecture seule via /api/backup/restore-history/
# - GET /api/backup/restore-history/ - Liste l'historique des restaurations
# - GET /api/backup/restore-history/{id}/ - Détails d'une restauration
router.register(r'restore-history', views.RestoreHistoryViewSet, basename='restorehistory')

# 🆕 SYSTÈME EXTERNE - Uploads isolés via /api/backup/external-uploads/
# - GET /api/backup/external-uploads/ - Liste des uploads externes
# - POST /api/backup/external-uploads/ - Nouvel upload externe
# - GET /api/backup/external-uploads/{id}/ - Détails d'un upload
# - DELETE /api/backup/external-uploads/{id}/ - Supprimer un upload
# - POST /api/backup/external-uploads/{id}/validate_upload/ - Revalider
router.register(r'external-uploads', views.ExternalUploadViewSet, basename='externalupload')

# 🆕 SYSTÈME EXTERNE - Restaurations isolées via /api/backup/external-restorations/
# - GET /api/backup/external-restorations/ - Liste des restaurations externes
# - POST /api/backup/external-restorations/ - Nouvelle restauration externe
# - GET /api/backup/external-restorations/{id}/ - Détails d'une restauration
# - GET /api/backup/external-restorations/{id}/progress/ - Progression temps réel
# - POST /api/backup/external-restorations/{id}/cancel/ - Annuler restauration
router.register(r'external-restorations', views.ExternalRestorationViewSet, basename='externalrestoration')

app_name = 'backup_manager'

urlpatterns = [
    # API REST avec ViewSets - URLs gérées par le router ci-dessus
    path('', include(router.urls)),
    
    # Endpoints personnalisés pour les actions
    # POST /api/backup/create/ - Crée une sauvegarde à partir d'une configuration
    path('create/', views.create_backup_view, name='create_backup'),
    
    # POST /api/backup/quick-backup/ - Crée une sauvegarde rapide sans configuration
    path('quick-backup/', views.quick_backup_view, name='quick_backup'),
    
    # POST /api/backup/restore/ - Restaure une sauvegarde existante
    path('restore/', views.restore_backup_view, name='restore_backup'),
    
    # POST /api/backup/upload-restore/ - Upload et restaure une sauvegarde
    path('upload-restore/', views.upload_and_restore_view, name='upload_restore'),
    
    # Endpoints utilitaires
    # GET /api/backup/storage-stats/ - Statistiques de stockage
    path('storage-stats/', views.storage_stats_view, name='storage_stats'),
    
    # POST /api/backup/cleanup/ - Nettoie les anciennes sauvegardes
    path('cleanup/', views.cleanup_old_backups_view, name='cleanup'),
    
    # GET /api/backup/health/ - Vérifie l'état du système de sauvegarde
    path('health/', views.health_check_view, name='health_check'),
    
    # 🆕 SYSTÈME EXTERNE - Endpoints utilitaires
    # GET /api/backup/external-system-status/ - Statut du système externe
    path('external-system-status/', views.external_system_status, name='external_system_status'),
    
    # POST /api/backup/cleanup-external-uploads/ - Nettoie les uploads externes
    path('cleanup-external-uploads/', views.cleanup_external_uploads, name='cleanup_external_uploads'),
] 