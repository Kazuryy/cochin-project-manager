from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.paginator import Paginator
from django.db.models import Q
from django.utils import timezone
import logging

from .serializers import (
    UserListSerializer, UserDetailSerializer, UserCreateSerializer, 
    UserUpdateSerializer, UserActionSerializer, GroupSerializer
)

User = get_user_model()
logger = logging.getLogger(__name__)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Permission personnalisée : lecture pour tous les authentifiés, écriture pour les admins"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Lecture autorisée pour tous les utilisateurs authentifiés
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Écriture autorisée seulement pour les admins
        return request.user.is_staff


class UserManagementViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion complète des utilisateurs
    
    Endpoints disponibles:
    - GET /api/auth/users/ - Liste des utilisateurs avec pagination et recherche
    - POST /api/auth/users/ - Créer un nouvel utilisateur
    - GET /api/auth/users/{id}/ - Détails d'un utilisateur
    - PUT /api/auth/users/{id}/ - Mettre à jour un utilisateur
    - DELETE /api/auth/users/{id}/ - Supprimer un utilisateur
    - POST /api/auth/users/bulk_actions/ - Actions en lot sur les utilisateurs
    - GET /api/auth/users/stats/ - Statistiques des utilisateurs
    """
    
    queryset = User.objects.all()
    permission_classes = [IsAdminOrReadOnly]
    
    def get_serializer_class(self):
        """Retourne le serializer approprié selon l'action"""
        if self.action == 'list':
            return UserListSerializer
        elif self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        elif self.action == 'bulk_actions':
            return UserActionSerializer
        else:
            return UserDetailSerializer
    
    def get_queryset(self):
        """Retourne le queryset avec les relations optimisées"""
        return User.objects.select_related().prefetch_related('groups', 'user_permissions')
    
    def list(self, request):
        """
        Liste des utilisateurs avec pagination, recherche et filtrage
        
        Paramètres de requête:
        - page: Numéro de page (défaut: 1)
        - limit: Nombre d'éléments par page (défaut: 20, max: 100)
        - search: Recherche dans username, email, nom et prénom
        - status: Filtrer par statut (active, inactive, locked, expired)
        - is_staff: Filtrer par statut staff (true/false)
        - groups: Filtrer par groupes (IDs séparés par virgules)
        """
        try:
            # Paramètres de pagination
            page = int(request.GET.get('page', 1))
            limit = min(int(request.GET.get('limit', 20)), 100)
            
            # Paramètres de recherche et filtrage
            search = request.GET.get('search', '').strip()
            status_filter = request.GET.get('status', '')
            is_staff_filter = request.GET.get('is_staff', '')
            groups_filter = request.GET.get('groups', '')
            require_password_change = request.GET.get('require_password_change', '').lower() == 'true'
            never_logged_in = request.GET.get('never_logged_in', '').lower() == 'true'
            
            # Construire le queryset
            queryset = self.get_queryset()
            
            # Recherche textuelle
            if search:
                queryset = queryset.filter(
                    Q(username__icontains=search) |
                    Q(email__icontains=search) |
                    Q(first_name__icontains=search) |
                    Q(last_name__icontains=search)
                )
            
            # Filtrage par statut staff
            if is_staff_filter.lower() == 'true':
                queryset = queryset.filter(is_staff=True)
            elif is_staff_filter.lower() == 'false':
                queryset = queryset.filter(is_staff=False)
            
            # Filtrage par groupes
            if groups_filter:
                try:
                    group_ids = [int(gid) for gid in groups_filter.split(',')]
                    queryset = queryset.filter(groups__id__in=group_ids).distinct()
                except ValueError:
                    pass
            
            # Filtrage par changement de mot de passe requis
            if require_password_change:
                queryset = queryset.filter(require_password_change=True)
            
            # Filtrage par utilisateurs jamais connectés
            if never_logged_in:
                queryset = queryset.filter(last_login__isnull=True)
            
            # Filtrage par statut (nécessite une logique spéciale car calculé)
            if status_filter:
                now = timezone.now()
                if status_filter == 'active':
                    queryset = queryset.filter(
                        is_active=True,
                        account_locked_until__isnull=True,
                        is_password_expired=False
                    )
                elif status_filter == 'inactive':
                    queryset = queryset.filter(is_active=False)
                elif status_filter == 'locked':
                    queryset = queryset.filter(account_locked_until__gt=now)
                elif status_filter == 'expired':
                    queryset = queryset.filter(is_password_expired=True)
            
            # Pagination
            paginator = Paginator(queryset.order_by('username'), limit)
            page_obj = paginator.get_page(page)
            
            # Sérialisation
            serializer = self.get_serializer(page_obj.object_list, many=True)
            
            return Response({
                'success': True,
                'users': serializer.data,
                'pagination': {
                    'total': paginator.count,
                    'page': page,
                    'pages': paginator.num_pages,
                    'has_next': page_obj.has_next(),
                    'has_previous': page_obj.has_previous(),
                },
                'filters': {
                    'search': search,
                    'status': status_filter,
                    'is_staff': is_staff_filter,
                    'groups': groups_filter,
                    'require_password_change': require_password_change,
                    'never_logged_in': never_logged_in
                }
            })
            
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des utilisateurs: {str(e)}")
            return Response({
                'success': False,
                'error': 'Erreur lors de la récupération des utilisateurs',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def create(self, request):
        """Créer un nouvel utilisateur"""
        try:
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                user = serializer.save()
                logger.info(f"Nouvel utilisateur créé: {user.username} par {request.user.username}")
                
                # Retourner les détails de l'utilisateur créé
                detail_serializer = UserDetailSerializer(user)
                return Response({
                    'success': True,
                    'message': f'Utilisateur {user.username} créé avec succès',
                    'user': detail_serializer.data
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': False,
                    'error': 'Données invalides',
                    'details': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Erreur lors de la création de l'utilisateur: {str(e)}")
            return Response({
                'success': False,
                'error': 'Erreur lors de la création de l\'utilisateur',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def retrieve(self, request, pk=None):
        """Récupérer les détails d'un utilisateur"""
        try:
            user = self.get_object()
            serializer = self.get_serializer(user)
            return Response({
                'success': True,
                'user': serializer.data
            })
        except User.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Utilisateur introuvable'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Erreur lors de la récupération de l'utilisateur: {str(e)}")
            return Response({
                'success': False,
                'error': 'Erreur lors de la récupération de l\'utilisateur',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def update(self, request, pk=None):
        """Mettre à jour un utilisateur"""
        try:
            user = self.get_object()
            
            # Empêcher la modification de son propre statut admin
            if user == request.user and 'is_staff' in request.data:
                return Response({
                    'success': False,
                    'error': 'Vous ne pouvez pas modifier votre propre statut administrateur'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = self.get_serializer(user, data=request.data, partial=True)
            if serializer.is_valid():
                updated_user = serializer.save()
                logger.info(f"Utilisateur {updated_user.username} mis à jour par {request.user.username}")
                
                # Retourner les détails mis à jour
                detail_serializer = UserDetailSerializer(updated_user)
                return Response({
                    'success': True,
                    'message': f'Utilisateur {updated_user.username} mis à jour avec succès',
                    'user': detail_serializer.data
                })
            else:
                return Response({
                    'success': False,
                    'error': 'Données invalides',
                    'details': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except User.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Utilisateur introuvable'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Erreur lors de la mise à jour de l'utilisateur: {str(e)}")
            return Response({
                'success': False,
                'error': 'Erreur lors de la mise à jour de l\'utilisateur',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def destroy(self, request, pk=None):
        """Supprimer un utilisateur"""
        try:
            user = self.get_object()
            
            # Empêcher la suppression de son propre compte
            if user == request.user:
                return Response({
                    'success': False,
                    'error': 'Vous ne pouvez pas supprimer votre propre compte'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            username = user.username
            user.delete()
            logger.warning(f"Utilisateur {username} supprimé par {request.user.username}")
            
            return Response({
                'success': True,
                'message': f'Utilisateur {username} supprimé avec succès'
            })
            
        except User.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Utilisateur introuvable'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Erreur lors de la suppression de l'utilisateur: {str(e)}")
            return Response({
                'success': False,
                'error': 'Erreur lors de la suppression de l\'utilisateur',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def bulk_actions(self, request):
        """
        Actions en lot sur les utilisateurs
        
        Actions disponibles:
        - unlock: Déverrouiller les comptes
        - lock: Verrouiller les comptes (avec duration_minutes optionnel)
        - reset_attempts: Réinitialiser les tentatives de connexion
        - force_password_change: Forcer le changement de mot de passe
        - activate: Activer les comptes
        - deactivate: Désactiver les comptes
        - make_staff: Donner les droits admin
        - remove_staff: Retirer les droits admin
        """
        try:
            serializer = UserActionSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'success': False,
                    'error': 'Données invalides',
                    'details': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            action = serializer.validated_data['action']
            user_ids = serializer.validated_data['user_ids']
            duration_minutes = serializer.validated_data.get('duration_minutes', 15)
            
            # Récupérer les utilisateurs (exclure l'utilisateur courant pour certaines actions)
            users = User.objects.filter(id__in=user_ids)
            if action in ['lock', 'deactivate', 'remove_staff']:
                users = users.exclude(id=request.user.id)
            
            if not users.exists():
                return Response({
                    'success': False,
                    'error': 'Aucun utilisateur trouvé pour cette action'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Exécuter l'action
            affected_count = 0
            for user in users:
                try:
                    if action == 'unlock':
                        user.account_locked_until = None
                        user.failed_login_attempts = 0
                        user.save(update_fields=['account_locked_until', 'failed_login_attempts'])
                        affected_count += 1
                    
                    elif action == 'lock':
                        user.lock_account(duration_minutes=duration_minutes)
                        affected_count += 1
                    
                    elif action == 'reset_attempts':
                        user.reset_failed_login()
                        affected_count += 1
                    
                    elif action == 'force_password_change':
                        user.require_password_change = True
                        user.is_password_expired = True
                        user.save(update_fields=['require_password_change', 'is_password_expired'])
                        affected_count += 1
                    
                    elif action == 'activate':
                        user.is_active = True
                        user.save(update_fields=['is_active'])
                        affected_count += 1
                    
                    elif action == 'deactivate':
                        user.is_active = False
                        user.save(update_fields=['is_active'])
                        affected_count += 1
                    
                    elif action == 'make_staff':
                        user.is_staff = True
                        user.save(update_fields=['is_staff'])
                        affected_count += 1
                    
                    elif action == 'remove_staff':
                        user.is_staff = False
                        user.save(update_fields=['is_staff'])
                        affected_count += 1
                
                except Exception as user_error:
                    logger.error(f"Erreur lors de l'action {action} sur l'utilisateur {user.username}: {str(user_error)}")
            
            logger.info(f"Action {action} appliquée à {affected_count} utilisateur(s) par {request.user.username}")
            
            return Response({
                'success': True,
                'message': f'Action {action} appliquée à {affected_count} utilisateur(s)',
                'affected_count': affected_count
            })
            
        except Exception as e:
            logger.error(f"Erreur lors de l'action en lot: {str(e)}")
            return Response({
                'success': False,
                'error': 'Erreur lors de l\'exécution de l\'action',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Statistiques des utilisateurs"""
        try:
            now = timezone.now()
            
            stats = {
                'total_users': User.objects.count(),
                'active_users': User.objects.filter(is_active=True).count(),
                'inactive_users': User.objects.filter(is_active=False).count(),
                'staff_users': User.objects.filter(is_staff=True).count(),
                'locked_users': User.objects.filter(account_locked_until__gt=now).count(),
                'expired_passwords': User.objects.filter(is_password_expired=True).count(),
                'require_password_change': User.objects.filter(require_password_change=True).count(),
                'never_logged_in': User.objects.filter(last_login__isnull=True).count(),
            }
            
            return Response({
                'success': True,
                'stats': stats
            })
            
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des statistiques: {str(e)}")
            return Response({
                'success': False,
                'error': 'Erreur lors de la récupération des statistiques',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GroupManagementViewSet(viewsets.ModelViewSet):
    """ViewSet pour la gestion des groupes d'utilisateurs"""
    
    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    permission_classes = [IsAdminOrReadOnly]
    
    def list(self, request):
        """Liste tous les groupes disponibles"""
        try:
            groups = self.get_queryset()
            serializer = self.get_serializer(groups, many=True)
            return Response({
                'success': True,
                'groups': serializer.data
            })
        except Exception as e:
            logger.error(f"Erreur lors de la récupération des groupes: {str(e)}")
            return Response({
                'success': False,
                'error': 'Erreur lors de la récupération des groupes',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 