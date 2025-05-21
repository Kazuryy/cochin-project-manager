# backend/database/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DynamicTableViewSet,
    DynamicFieldViewSet,
    DynamicRecordViewSet,
    DynamicValueViewSet
)

router = DefaultRouter()
router.register(r'tables', DynamicTableViewSet)
router.register(r'fields', DynamicFieldViewSet)
router.register(r'records', DynamicRecordViewSet)
router.register(r'values', DynamicValueViewSet)

urlpatterns = [
    path('', include(router.urls)),
]