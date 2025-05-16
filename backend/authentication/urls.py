from django.urls import path
from . import views
from . import views_password

app_name = 'authentication'

urlpatterns = [
    path('csrf/', views.get_csrf_token, name='csrf_token'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('check/', views.check_auth_view, name='check_auth'),
    path('change-password/', views_password.change_password, name='change_password'),
]