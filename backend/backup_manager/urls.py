"""
URLs pour l'API de sauvegarde/restauration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Configuration du router REST
router = DefaultRouter()
router.register(r'configurations', views.BackupConfigurationViewSet, basename='backupconfig')
router.register(r'history', views.BackupHistoryViewSet, basename='backuphistory')
router.register(r'restore-history', views.RestoreHistoryViewSet, basename='restorehistory')

app_name = 'backup_manager'

urlpatterns = [
    # API REST avec ViewSets
    path('', include(router.urls)),
    
    # Endpoints personnalisés pour les actions
    path('create/', views.create_backup_view, name='create_backup'),
    path('quick-backup/', views.quick_backup_view, name='quick_backup'),
    path('restore/', views.restore_backup_view, name='restore_backup'),
    path('upload-restore/', views.upload_and_restore_view, name='upload_restore'),
    
    # Endpoints utilitaires
    path('storage-stats/', views.storage_stats_view, name='storage_stats'),
    path('cleanup/', views.cleanup_old_backups_view, name='cleanup'),
    path('health/', views.health_check_view, name='health_check'),
] 