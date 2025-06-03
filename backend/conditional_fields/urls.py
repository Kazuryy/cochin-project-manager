from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConditionalFieldRuleViewSet, ConditionalFieldOptionViewSet, add_option_simple

router = DefaultRouter()
router.register(r'rules', ConditionalFieldRuleViewSet)
router.register(r'options', ConditionalFieldOptionViewSet)

urlpatterns = [
    # Notre endpoint spécial AVANT le router pour éviter les conflits
    path('add-option/', add_option_simple, name='add_option_simple'),
    path('', include(router.urls)),
] 