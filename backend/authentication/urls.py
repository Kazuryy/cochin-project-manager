from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import views_password
from .api_views import UserManagementViewSet, GroupManagementViewSet

app_name = 'authentication'

# Router pour les ViewSets
router = DefaultRouter()
router.register(r'users', UserManagementViewSet, basename='user')
router.register(r'groups', GroupManagementViewSet, basename='group')

urlpatterns = [
    # Authentification de base
    path('csrf/', views.get_csrf_token, name='csrf_token'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('check/', views.check_auth_view, name='check_auth'),
    path('change-password/', views_password.change_password, name='change_password'),
    
    # API de gestion des utilisateurs
    path('', include(router.urls)),
]