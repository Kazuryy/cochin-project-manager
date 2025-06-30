# backend/database/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DynamicTableViewSet, DynamicFieldViewSet, DynamicRecordViewSet, 
    DynamicValueViewSet, ProjectPdfFileViewSet, maintenance_view, get_logs
)

router = DefaultRouter()
router.register(r'tables', DynamicTableViewSet)
router.register(r'fields', DynamicFieldViewSet)
router.register(r'records', DynamicRecordViewSet)
router.register(r'values', DynamicValueViewSet)
router.register(r'project-pdfs', ProjectPdfFileViewSet, basename='project-pdf')

urlpatterns = [
    path('', include(router.urls)),
    path('maintenance/', maintenance_view, name='maintenance'),
    path('logs/', get_logs, name='get_logs'),
]