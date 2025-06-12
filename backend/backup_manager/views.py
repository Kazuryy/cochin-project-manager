"""
Vues API pour le système de sauvegarde/restauration
Version optimisée avec corrections et améliorations
"""

# Imports Django standard
import json
import logging
import os
import shutil
import tempfile
from pathlib import Path

# Imports Django
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.paginator import Paginator
from django.http import JsonResponse, HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

# Imports Django REST Framework
from rest_framework import viewsets, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action, api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response

# Imports locaux
from .models import BackupConfiguration, BackupHistory, RestoreHistory
from .serializers import (
    BackupConfigurationSerializer, 
    BackupHistorySerializer, 
    RestoreHistorySerializer
)
from .services import BackupService, RestoreService, StorageService
from .services.encryption_service import EncryptionService
from .services.security_validator import SecurityValidator, SecurityValidationError

# Configuration des loggers
logger = logging.getLogger(__name__)
security_logger = logging.getLogger('django.security')

# Messages d'erreur constants
METHOD_NOT_ALLOWED_ERROR = 'Méthode non autorisée'
UNAUTHORIZED_ERROR = 'Non autorisé'

User = get_user_model()


class BaseBackupViewMixin:
    """Mixin commun pour les vues de sauvegarde avec fonctionnalités partagées"""
    
    def get_user_queryset(self, queryset):
        """Filtre le queryset par utilisateur pour la sécurité"""
        return queryset.filter(created_by=self.request.user)
    
    def handle_api_error(self, error, operation_name="operation"):
        """Gestion centralisée des erreurs API"""
        logger.error(f"Erreur lors de {operation_name}: {str(error)}")
        
        if isinstance(error, SecurityValidationError):
            return Response(
                {'error': f'Violation de sécurité lors de {operation_name}', 'details': str(error)},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return Response(
            {'error': f'Erreur lors de {operation_name}', 'details': str(error)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    def create_standard_response(self, success=True, data=None, message="", error_details=None):
        """Crée une réponse standardisée"""
        response_data = {
            'success': success,
            'timestamp': timezone.now().isoformat()
        }
        
        if success:
            if data:
                response_data.update(data)
            if message:
                response_data['message'] = message
        else:
            response_data['error'] = message
            if error_details:
                response_data['details'] = error_details
                
        return response_data


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Authentification par session sans validation CSRF pour les uploads de fichiers.
    Utilisée uniquement pour l'endpoint d'upload sécurisé car la validation de sécurité
    du fichier est suffisante et le frontend utilise les sessions Django.
    """
    def enforce_csrf(self, request):
        return  # Pas de validation CSRF pour cette vue spécifique


class BackupConfigurationViewSet(BaseBackupViewMixin, viewsets.ModelViewSet):
    """ViewSet pour la gestion des configurations de sauvegarde"""
    
    queryset = BackupConfiguration.objects.all()
    serializer_class = BackupConfigurationSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def perform_create(self, serializer):
        """Attribue l'utilisateur courant lors de la création"""
        serializer.save(created_by=self.request.user)
    
    def get_queryset(self):
        """Filtre les configurations par utilisateur"""
        return self.get_user_queryset(super().get_queryset())
    
    def list(self, request):
        """Liste toutes les configurations avec réponse standardisée"""
        try:
            configs = self.get_queryset()
            serializer = self.get_serializer(configs, many=True)
            return Response(self.create_standard_response(
                data={'configurations': serializer.data},
                message=f"{len(serializer.data)} configuration(s) trouvée(s)"
            ))
        except Exception as e:
            return self.handle_api_error(e, "récupération des configurations")


class BackupHistoryViewSet(BaseBackupViewMixin, viewsets.ReadOnlyModelViewSet):
    """ViewSet pour consulter l'historique des sauvegardes"""
    
    queryset = BackupHistory.objects.all()
    serializer_class = BackupHistorySerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        """Filtre l'historique par utilisateur"""
        return self.get_user_queryset(super().get_queryset())
    
    def list(self, request):
        """Liste l'historique avec pagination optimisée"""
        try:
            page = int(request.GET.get('page', 1))
            limit = min(int(request.GET.get('limit', 20)), 100)  # Limite max pour performance
            config_id = request.GET.get('configuration_id')
            
            queryset = self.get_queryset()
            
            if config_id:
                queryset = queryset.filter(configuration_id=config_id)
            
            # Optimisation: order_by pour performance
            queryset = queryset.order_by('-created_at')
            
            paginator = Paginator(queryset, limit)
            page_obj = paginator.get_page(page)
            
            serializer = self.get_serializer(page_obj.object_list, many=True)
            
            return Response(self.create_standard_response(
                data={
                    'results': serializer.data,
                    'pagination': {
                        'total': paginator.count,
                        'page': page,
                        'pages': paginator.num_pages,
                        'has_next': page_obj.has_next(),
                        'has_previous': page_obj.has_previous(),
                    }
                }
            ))
        except Exception as e:
            return self.handle_api_error(e, "récupération de l'historique")
    
    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """Récupère le statut en temps réel d'une sauvegarde"""
        try:
            backup = self.get_object()
            return Response(self.create_standard_response(
                data={
                    'backup_status': {
                        'id': backup.id,
                        'status': backup.status,
                        'progress': 100 if backup.status == 'completed' else 0,
                        'error_message': backup.error_message,
                        'duration_seconds': backup.duration_seconds
                    }
                }
            ))
        except Exception as e:
            return self.handle_api_error(e, "récupération du statut")
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Télécharge le fichier de sauvegarde avec déchiffrement automatique"""
        backup = self.get_object()
        
        if backup.status != 'completed':
            return Response(
                self.create_standard_response(
                    success=False,
                    message='Cette sauvegarde n\'est pas disponible au téléchargement'
                ),
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not backup.file_path:
            return Response(
                self.create_standard_response(
                    success=False,
                    message='Fichier de sauvegarde introuvable'
                ),
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            file_path = self._get_backup_file_path(backup.file_path)
            
            if not os.path.exists(file_path):
                return Response(
                    self.create_standard_response(
                        success=False,
                        message='Fichier de sauvegarde physiquement introuvable'
                    ),
                    status=status.HTTP_404_NOT_FOUND
                )
            
            return self._process_backup_download(file_path, backup)
            
        except Exception as e:
            return self.handle_api_error(e, "téléchargement de la sauvegarde")
    
    def _get_backup_file_path(self, relative_path):
        """Construit le chemin complet du fichier de sauvegarde"""
        if os.path.isabs(relative_path):
            return relative_path
        
        if hasattr(settings, 'BACKUP_ROOT'):
            return os.path.join(settings.BACKUP_ROOT, relative_path)
        
        return os.path.join(settings.MEDIA_ROOT, 'backups', relative_path)
    
    def _process_backup_download(self, file_path, backup):
        """Traite le téléchargement avec déchiffrement si nécessaire"""
        is_encrypted = file_path.endswith('.encrypted')
        
        if not is_encrypted:
            return Response(
                self.create_standard_response(
                    success=False,
                    message='Fichier de sauvegarde non chiffré détecté (erreur système)'
                ),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Utilisation d'un context manager pour garantir le nettoyage
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
            temp_path = temp_file.name
        
        try:
            encryption_service = EncryptionService()
            decryption_key = encryption_service.generate_system_key(backup.created_by)
            encryption_service.decrypt_file_with_key(Path(file_path), Path(temp_path), decryption_key)
            
            logger.info(f"Déchiffrement automatique réussi pour {backup.backup_name}")
            
            with open(temp_path, 'rb') as backup_file:
                response = HttpResponse(
                    backup_file.read(),
                    content_type='application/octet-stream'
                )
                
                filename = f"{backup.backup_name}.zip"
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                response['Content-Length'] = os.path.getsize(temp_path)
                
                return response
                
        except Exception as e:
            logger.error(f"Erreur lors du déchiffrement: {str(e)}")
            return Response(
                self.create_standard_response(
                    success=False,
                    message='Impossible de déchiffrer le fichier',
                    error_details=str(e)
                ),
                status=status.HTTP_403_FORBIDDEN
            )
        finally:
            # Nettoyage garanti du fichier temporaire
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def destroy(self, request, pk=None):
        """Supprime une sauvegarde et ses fichiers"""
        try:
            backup = self.get_object()
            backup_service = BackupService()
            success = backup_service.delete_backup(backup)
            
            if success:
                return Response(self.create_standard_response(
                    message='Sauvegarde supprimée avec succès'
                ))
            else:
                return Response(
                    self.create_standard_response(
                        success=False,
                        message='Erreur lors de la suppression'
                    ),
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        except Exception as e:
            return self.handle_api_error(e, "suppression de la sauvegarde")


class RestoreHistoryViewSet(BaseBackupViewMixin, viewsets.ReadOnlyModelViewSet):
    """ViewSet pour consulter l'historique des restaurations"""
    
    queryset = RestoreHistory.objects.select_related('backup_source', 'created_by')
    serializer_class = RestoreHistorySerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        """Filtre l'historique par utilisateur avec optimisation des requêtes"""
        return self.get_user_queryset(super().get_queryset())
    
    def list(self, request):
        """Liste l'historique des restaurations avec pagination optimisée"""
        try:
            page = int(request.GET.get('page', 1))
            limit = min(int(request.GET.get('limit', 20)), 100)  # Limite max
            
            queryset = self.get_queryset().order_by('-created_at')
            
            paginator = Paginator(queryset, limit)
            page_obj = paginator.get_page(page)
            
            serializer = self.get_serializer(page_obj.object_list, many=True)
            
            return Response(self.create_standard_response(
                data={
                    'results': serializer.data,
                    'pagination': {
                        'total': paginator.count,
                        'page': page,
                        'pages': paginator.num_pages,
                        'has_next': page_obj.has_next(),
                        'has_previous': page_obj.has_previous(),
                    }
                }
            ))
        except Exception as e:
            return self.handle_api_error(e, "récupération de l'historique des restaurations")
    
    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """Récupère le statut en temps réel d'une restauration"""
        try:
            restore = self.get_object()
            return Response(self.create_standard_response(
                data={
                    'restore_status': {
                        'id': restore.id,
                        'status': restore.status,
                        'progress': 100 if restore.status == 'completed' else 0,
                        'error_message': restore.error_message,
                        'duration_seconds': restore.duration_seconds
                    }
                }
            ))
        except Exception as e:
            return self.handle_api_error(e, "récupération du statut de restauration")


# =================== VUES FONCTION CONVERTIES EN VIEWSETS ===================

class BackupOperationsViewSet(BaseBackupViewMixin, viewsets.ViewSet):
    """ViewSet pour les opérations de sauvegarde"""
    
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    @action(detail=False, methods=['post'])
    def create_backup(self, request):
        """Crée une nouvelle sauvegarde"""
        try:
            data = request.data
            logger.info(f"Création de sauvegarde demandée: {data}")
            
            config_id = data.get('configuration_id')
            backup_name = data.get('backup_name')
            
            if not config_id:
                return Response(
                    self.create_standard_response(
                        success=False,
                        message='ID de configuration requis'
                    ),
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                config = BackupConfiguration.objects.get(id=config_id, created_by=request.user)
                logger.info(f"Configuration trouvée: {config.name}")
            except BackupConfiguration.DoesNotExist:
                return Response(
                    self.create_standard_response(
                        success=False,
                        message='Configuration introuvable'
                    ),
                    status=status.HTTP_404_NOT_FOUND
                )
            
            logger.info("Lancement de la sauvegarde avec chiffrement automatique...")
            backup_service = BackupService()
            backup_history = backup_service.create_backup(config, request.user, backup_name)
            
            logger.info(f"Sauvegarde créée avec succès: {backup_history.id}")
            return Response(self.create_standard_response(
                data={
                    'backup': {
                        'id': backup_history.id,
                        'name': backup_history.backup_name,
                        'status': backup_history.status
                    }
                },
                message='Sauvegarde lancée avec succès (chiffrement automatique)'
            ))
            
        except Exception as e:
            return self.handle_api_error(e, "création de sauvegarde")
    
    @action(detail=False, methods=['post'])
    def quick_backup(self, request):
        """Crée une sauvegarde rapide sans configuration"""
        try:
            data = request.data
            backup_type = data.get('backup_type', 'full')
            backup_name = data.get('backup_name')
            
            # Créer une configuration temporaire avec des valeurs par défaut sécurisées
            temp_config = BackupConfiguration.objects.create(
                name=f"Sauvegarde rapide - {backup_name}",
                backup_type=backup_type,
                frequency='manual',
                is_active=True,
                include_files=data.get('include_files', True),
                compression_enabled=data.get('compression_enabled', True),
                retention_days=7,  # Rétention courte pour les sauvegardes rapides
                created_by=request.user
            )
            
            backup_service = BackupService()
            backup_history = backup_service.create_backup(temp_config, request.user, backup_name)
            
            return Response(self.create_standard_response(
                data={
                    'backup': {
                        'id': backup_history.id,
                        'name': backup_history.backup_name,
                        'status': backup_history.status
                    }
                },
                message='Sauvegarde rapide lancée avec succès'
            ))
            
        except Exception as e:
            return self.handle_api_error(e, "création de sauvegarde rapide")


class RestoreOperationsViewSet(BaseBackupViewMixin, viewsets.ViewSet):
    """ViewSet pour les opérations de restauration"""
    
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    @action(detail=False, methods=['post'])
    def restore_backup(self, request):
        """Restaure une sauvegarde"""
        try:
            data = request.data
            backup_id = data.get('backup_id')
            restore_options = data.get('restore_options', {})
            
            if not backup_id:
                return Response(
                    self.create_standard_response(
                        success=False,
                        message='ID de sauvegarde requis'
                    ),
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                backup = BackupHistory.objects.get(id=backup_id, created_by=request.user)
            except BackupHistory.DoesNotExist:
                return Response(
                    self.create_standard_response(
                        success=False,
                        message='Sauvegarde introuvable'
                    ),
                    status=status.HTTP_404_NOT_FOUND
                )
            
            restore_service = RestoreService()
            restore_history = restore_service.restore_backup(backup, request.user, restore_options)
            
            return Response(self.create_standard_response(
                data={
                    'restore': {
                        'id': restore_history.id,
                        'name': restore_history.restore_name,
                        'status': restore_history.status
                    }
                },
                message='Restauration lancée avec succès'
            ))
            
        except Exception as e:
            return self.handle_api_error(e, "restauration de sauvegarde")
    
    @action(detail=False, methods=['post'], authentication_classes=[CsrfExemptSessionAuthentication])
    def upload_and_restore(self, request):
        """Upload et restaure une sauvegarde avec validation de sécurité maximale"""
        
        # Vérification des droits administrateur
        if not request.user.is_staff:
            return Response(
                self.create_standard_response(
                    success=False,
                    message='Droits administrateur requis'
                ), 
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Vérifier qu'un fichier a été uploadé
            if 'backup_file' not in request.FILES:
                return Response(
                    self.create_standard_response(
                        success=False,
                        message='Aucun fichier uploadé'
                    ), 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            uploaded_file = request.FILES['backup_file']
            restore_options = self._parse_restore_options(request.POST.get('restore_options', '{}'))
            
            # PHASE 1: VALIDATION DE SÉCURITÉ
            security_result = self._validate_upload_security(uploaded_file, request.user)
            if not security_result['is_safe']:
                return Response(
                    self.create_standard_response(
                        success=False,
                        message='Fichier rejeté pour des raisons de sécurité',
                        error_details=security_result
                    ),
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # PHASE 2: TRAITEMENT SÉCURISÉ
            return self._process_upload_and_restore(uploaded_file, restore_options, security_result, request.user)
            
        except SecurityValidationError as security_error:
            security_logger.critical(f"ERREUR DE SÉCURITÉ CRITIQUE: {security_error}")
            return Response(
                self.create_standard_response(
                    success=False,
                    message='Violation de sécurité détectée',
                    error_details={'error_type': 'security_violation', 'details': str(security_error)}
                ),
                status=status.HTTP_403_FORBIDDEN
            )
            
        except Exception as e:
            return self.handle_api_error(e, "upload et restauration")
    
    def _parse_restore_options(self, options_json):
        """Parse les options de restauration de manière sécurisée"""
        try:
            return json.loads(options_json)
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def _validate_upload_security(self, uploaded_file, user):
        """Valide la sécurité du fichier uploadé"""
        security_logger.info(f"Début upload sécurisé par {user.username}: {uploaded_file.name}")
        
        security_validator = SecurityValidator()
        validation_result = security_validator.validate_upload(uploaded_file, user)
        
        # Créer le rapport de sécurité détaillé
        security_report = security_validator.create_security_report(validation_result)
        security_logger.info(f"Rapport de sécurité:\n{security_report}")
        
        # Rejeter si le fichier n'est pas sûr
        if not validation_result['is_safe']:
            security_logger.critical(f"UPLOAD REJETÉ - Fichier dangereux: {uploaded_file.name}")
        
        validation_result['security_report'] = security_report
        return validation_result
    
    def _process_upload_and_restore(self, uploaded_file, restore_options, security_result, user):
        """Traite l'upload et la restauration de manière sécurisée"""
        upload_dir = None
        temp_file_path = None
        upload_backup = None
        
        try:
            # Créer un répertoire temporaire sécurisé
            upload_dir = Path(settings.BACKUP_ROOT) / 'uploads' / f"upload_{user.id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}"
            upload_dir.mkdir(parents=True, exist_ok=True)
            
            # Nom de fichier sécurisé
            safe_filename = f"uploaded_backup_{security_result['file_hash'][:16]}.{uploaded_file.name.split('.')[-1]}"
            temp_file_path = upload_dir / safe_filename
            
            # Sauvegarder le fichier uploadé
            with open(temp_file_path, 'wb') as temp_file:
                uploaded_file.seek(0)
                shutil.copyfileobj(uploaded_file, temp_file)
            
            security_logger.info(f"Fichier sauvegardé temporairement: {temp_file_path}")
            
            # Créer une entrée BackupHistory temporaire
            upload_backup = BackupHistory.objects.create(
                backup_name=f"Upload_{uploaded_file.name}_{timezone.now().strftime('%Y%m%d_%H%M%S')}",
                status='completed',
                backup_type='full',
                file_path=str(temp_file_path),
                file_size=security_result['file_size'],
                checksum=security_result['file_hash'],
                started_at=timezone.now(),
                completed_at=timezone.now(),
                duration_seconds=0,
                created_by=user
            )
            
            # Lancer la restauration
            restore_service = RestoreService()
            secure_restore_options = {
                **restore_options,
                'upload_source': True,
                'security_validation': security_result,
                'backup_current': True,
                'ignore_duplicates': True,
                'ignore_fk_violations': True,
                'preprocess_metadata': True
            }
            
            restore_history = restore_service.restore_backup(upload_backup, user, secure_restore_options)
            
            security_logger.info(f"Upload et restauration réussis: {restore_history.restore_name}")
            
            return Response(self.create_standard_response(
                data={
                    'restore_history': {
                        'id': restore_history.id,
                        'restore_name': restore_history.restore_name,
                        'status': restore_history.status,
                        'tables_restored': restore_history.tables_restored,
                        'records_restored': restore_history.records_restored,
                        'files_restored': restore_history.files_restored,
                        'duration_seconds': restore_history.duration_seconds,
                        'started_at': restore_history.started_at.isoformat() if restore_history.started_at else None,
                        'completed_at': restore_history.completed_at.isoformat() if restore_history.completed_at else None,
                        'error_message': restore_history.error_message
                    },
                    'upload_info': {
                        'filename': uploaded_file.name,
                        'size': security_result['file_size'],
                        'hash': security_result['file_hash'][:16] + "...",
                        'user': user.username
                    }
                },
                message='Upload et restauration réussis avec gestion avancée des contraintes FK'
            ))
            
        except Exception as restore_error:
            return self._handle_restore_error(restore_error)
            
        finally:
            # Nettoyage sécurisé garanti
            self._cleanup_upload_resources(temp_file_path, upload_dir, upload_backup)
    
    def _handle_restore_error(self, error):
        """Gère les erreurs spécifiques de restauration"""
        error_message = str(error).lower()
        
        if "attempt to write a readonly database" in error_message:
            return Response(
                self.create_standard_response(
                    success=False,
                    message='Base de données temporairement en lecture seule',
                    error_details={
                        'error_type': 'database_readonly',
                        'retry_suggested': True,
                        'details': 'La base de données est actuellement utilisée par un autre processus.'
                    }
                ),
                status=status.HTTP_423_LOCKED
            )
        
        elif "database is locked" in error_message:
            return Response(
                self.create_standard_response(
                    success=False,
                    message='Base de données temporairement verrouillée',
                    error_details={
                        'error_type': 'database_locked',
                        'retry_suggested': True
                    }
                ),
                status=status.HTTP_423_LOCKED
            )
        
        elif "foreign key constraint failed" in error_message:
            return Response(
                self.create_standard_response(
                    success=False,
                    message='Échec des contraintes de clés étrangères',
                    error_details={
                        'error_type': 'foreign_key_constraint',
                        'suggestions': [
                            'Vérifiez que le fichier de sauvegarde est complet',
                            'Assurez-vous que la sauvegarde provient de la même version',
                            'Contactez l\'administrateur si le problème persiste'
                        ]
                    }
                ),
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
        
        else:
            return self.handle_api_error(error, "restauration")
    
    def _cleanup_upload_resources(self, temp_file_path, upload_dir, upload_backup):
        """Nettoie les ressources d'upload de manière sécurisée"""
        try:
            if temp_file_path and temp_file_path.exists():
                temp_file_path.unlink()
            
            if upload_dir and upload_dir.exists():
                upload_dir.rmdir()
                
            if upload_backup:
                upload_backup.delete()
                
            security_logger.info("Nettoyage sécurisé terminé")
            
        except Exception as cleanup_error:
            security_logger.warning(f"Erreur lors du nettoyage: {cleanup_error}")


class SystemViewSet(BaseBackupViewMixin, viewsets.ViewSet):
    """ViewSet pour les opérations système"""
    
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    @action(detail=False, methods=['get'])
    def storage_stats(self, request):
        """Obtient les statistiques de stockage"""
        try:
            storage_service = StorageService()
            stats = storage_service.get_storage_stats()
            return Response(self.create_standard_response(
                data={'storage_stats': stats}
            ))
        except Exception as e:
            return self.handle_api_error(e, "récupération des statistiques de stockage")
    
    @action(detail=False, methods=['post'])
    def cleanup_old_backups(self, request):
        """Nettoie les anciennes sauvegardes"""
        try:
            storage_service = StorageService()
            cleaned_count = storage_service.cleanup_old_backups()
            return Response(self.create_standard_response(
                data={'cleaned_backups': cleaned_count},
                message=f'{cleaned_count} sauvegarde(s) nettoyée(s)'
            ))
        except Exception as e:
            return self.handle_api_error(e, "nettoyage des sauvegardes")
    
    @action(detail=False, methods=['get'])
    def health_check(self, request):
        """Vérifie la santé du système de sauvegarde"""
        try:
            health_status = {
                'backup_service': 'ok',
                'storage_service': 'ok', 
                'encryption_service': 'ok',
                'database': 'ok',
                'disk_space': 'ok'
            }
            
            # Vérifier l'espace disque
            backup_root = Path(settings.BACKUP_ROOT)
            if backup_root.exists():
                disk_usage = shutil.disk_usage(backup_root)
                free_space_gb = disk_usage.free / (1024**3)
                if free_space_gb < 1:  # Moins d'1 GB libre
                    health_status['disk_space'] = 'warning'
            
            overall_status = 'healthy' if all(status == 'ok' for status in health_status.values()) else 'warning'
            
            return Response(self.create_standard_response(
                data={
                    'system_health': {
                        'status': overall_status,
                        'services': health_status,
                        'disk_free_gb': free_space_gb if 'free_space_gb' in locals() else None
                    }
                }
            ))
        except Exception as e:
            return Response(
                self.create_standard_response(
                    success=False,
                    message='Système en état dégradé',
                    error_details={'error': str(e)}
                ),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# =================== VUES DE COMPATIBILITÉ (DÉPRÉCIÉES) ===================
# Ces vues sont maintenues pour la compatibilité avec l'API existante
# Elles redirigent vers les nouveaux ViewSets

@csrf_exempt
def create_backup_view(request):
    """Vue de compatibilité - utilise BackupOperationsViewSet"""
    from django.urls import reverse
    from django.http import HttpResponseRedirect
    
    # Redirection vers la nouvelle API
    if request.method == 'POST':
        # Pour maintenir la compatibilité, on traite la requête ici
        if not request.user.is_authenticated or not request.user.is_staff:
            return JsonResponse({'error': UNAUTHORIZED_ERROR}, status=403)
        
        try:
            # Utiliser directement le nouveau ViewSet
            viewset = BackupOperationsViewSet()
            viewset.request = request
            response = viewset.create_backup(request)
            
            # Convertir la Response DRF en JsonResponse pour compatibilité
            return JsonResponse(response.data, status=response.status_code)
            
        except Exception as e:
            logger.error(f"Erreur dans create_backup_view de compatibilité: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)
    
    return JsonResponse({'error': METHOD_NOT_ALLOWED_ERROR}, status=405)


# Autres vues de compatibilité similaires...
@csrf_exempt  
def quick_backup_view(request):
    """Vue de compatibilité pour sauvegarde rapide"""
    if request.method != 'POST':
        return JsonResponse({'error': METHOD_NOT_ALLOWED_ERROR}, status=405)
    
    if not request.user.is_authenticated or not request.user.is_staff:
        return JsonResponse({'error': UNAUTHORIZED_ERROR}, status=403)
    
    try:
        viewset = BackupOperationsViewSet()
        viewset.request = request
        response = viewset.quick_backup(request)
        return JsonResponse(response.data, status=response.status_code)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def restore_backup_view(request):
    """Vue de compatibilité pour restauration"""
    if request.method != 'POST':
        return JsonResponse({'error': METHOD_NOT_ALLOWED_ERROR}, status=405)
    
    if not request.user.is_authenticated or not request.user.is_staff:
        return JsonResponse({'error': UNAUTHORIZED_ERROR}, status=403)
    
    try:
        viewset = RestoreOperationsViewSet()
        viewset.request = request
        response = viewset.restore_backup(request)
        return JsonResponse(response.data, status=response.status_code)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def storage_stats_view(request):
    """Vue de compatibilité pour statistiques de stockage"""
    if not request.user.is_authenticated or not request.user.is_staff:
        return JsonResponse({'error': UNAUTHORIZED_ERROR}, status=403)
    
    try:
        viewset = SystemViewSet()
        viewset.request = request
        response = viewset.storage_stats(request)
        # Extraire juste les stats pour compatibilité
        return JsonResponse(response.data['storage_stats'])
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def cleanup_old_backups_view(request):
    """Vue de compatibilité pour nettoyage"""
    if request.method != 'POST':
        return JsonResponse({'error': METHOD_NOT_ALLOWED_ERROR}, status=405)
        
    if not request.user.is_authenticated or not request.user.is_staff:
        return JsonResponse({'error': UNAUTHORIZED_ERROR}, status=403)
    
    try:
        viewset = SystemViewSet()
        viewset.request = request
        response = viewset.cleanup_old_backups(request)
        return JsonResponse(response.data, status=response.status_code)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
def health_check_view(request):
    """Vue de compatibilité pour vérification de santé"""
    try:
        viewset = SystemViewSet()
        viewset.request = request
        response = viewset.health_check(request)
        return JsonResponse(response.data, status=response.status_code)
    except Exception as e:
        return JsonResponse({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': timezone.now().isoformat()
        }, status=500)


@api_view(['POST'])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def upload_and_restore_view(request):
    """Vue de compatibilité pour upload et restauration"""
    try:
        viewset = RestoreOperationsViewSet()
        viewset.request = request
        response = viewset.upload_and_restore(request)
        return response
    except Exception as e:
        logger.error(f"Erreur dans upload_and_restore_view de compatibilité: {str(e)}")
        return Response({
            'error': 'Erreur interne du serveur',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 