from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('database.urls')),
    path('', include('conditional_fields.urls')),  # URLs pour les champs conditionnels
    path('api/backup/', include('backup_manager.urls')),  # URLs pour les sauvegardes
] 