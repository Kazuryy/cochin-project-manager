# backend/database/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'tables', views.DynamicTableViewSet)
router.register(r'fields', views.DynamicFieldViewSet)
router.register(r'records', views.DynamicRecordViewSet)
router.register(r'values', views.DynamicValueViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('maintenance/', views.maintenance_view, name='maintenance'),
    path('logs/', views.get_logs, name='get_logs'),
]