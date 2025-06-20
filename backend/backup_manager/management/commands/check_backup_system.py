import os
import sys
import json
import logging
import shutil
import platform
import subprocess
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import connection
from django.utils import timezone
from datetime import timedelta
from backup_manager.models import BackupConfiguration, BackupHistory, RestoreHistory
from backup_manager.services.storage_service import StorageService
from backup_manager.services.encryption_service import EncryptionService

logger = logging.getLogger('backup_manager')

class Command(BaseCommand):
    help = 'Vérifie l\'état du système de sauvegarde et identifie les problèmes potentiels'

    def add_arguments(self, parser):
        parser.add_argument(
            '--json',
            action='store_true',
            help='Sortie au format JSON'
        )
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Tente de corriger les problèmes mineurs automatiquement'
        )
        parser.add_argument(
            '--deep',
            action='store_true',
            help='Effectue des vérifications approfondies (plus lent)'
        )

    def handle(self, *args, **options):
        output_json = options['json']
        fix_issues = options['fix']
        deep_check = options['deep']
        
        # Structure pour stocker les résultats
        results = {
            'timestamp': timezone.now().isoformat(),
            'system_info': self._get_system_info(),
            'checks': [],
            'summary': {
                'critical': 0,
                'warning': 0,
                'ok': 0,
                'fixed': 0
            }
        }
        
        # Exécuter toutes les vérifications
        self._check_directories(results, fix_issues)
        self._check_database(results)
        self._check_configurations(results)
        self._check_backup_history(results, deep_check)
        self._check_restore_history(results)
        self._check_dependencies(results)
        self._check_permissions(results, fix_issues)
        
        # Afficher les résultats
        if output_json:
            self.stdout.write(json.dumps(results, indent=2))
        else:
            self._print_results(results)
            
        # Retourner un code d'erreur si des problèmes critiques sont détectés
        if results['summary']['critical'] > 0:
            sys.exit(1)
    
    def _add_check_result(self, results, category, name, status, message, details=None, fix_applied=None):
        """Ajoute un résultat de vérification à la structure results"""
        check_result = {
            'category': category,
            'name': name,
            'status': status,  # 'ok', 'warning', 'critical'
            'message': message
        }
        
        if details:
            check_result['details'] = details
            
        if fix_applied:
            check_result['fix_applied'] = fix_applied
            results['summary']['fixed'] += 1
            
        results['checks'].append(check_result)
        results['summary'][status] += 1
    
    def _get_system_info(self):
        """Récupère les informations système"""
        return {
            'platform': platform.platform(),
            'python_version': platform.python_version(),
            'django_version': settings.DJANGO_VERSION if hasattr(settings, 'DJANGO_VERSION') else 'Unknown',
            'database_engine': settings.DATABASES['default']['ENGINE'],
            'backup_root': str(getattr(settings, 'BACKUP_ROOT', settings.MEDIA_ROOT + '/backups')),
            'media_root': str(settings.MEDIA_ROOT),
            'debug_mode': settings.DEBUG
        }
    
    def _check_directories(self, results, fix_issues):
        """Vérifie les répertoires nécessaires"""
        # Déterminer le répertoire de sauvegarde
        if hasattr(settings, 'BACKUP_ROOT'):
            backup_root = Path(settings.BACKUP_ROOT)
        else:
            backup_root = Path(settings.MEDIA_ROOT) / 'backups'
        
        # Vérifier si le répertoire principal existe
        if not backup_root.exists():
            if fix_issues:
                try:
                    backup_root.mkdir(parents=True, exist_ok=True)
                    self._add_check_result(
                        results, 'filesystem', 'backup_root_exists',
                        'ok', f'Répertoire de sauvegarde créé: {backup_root}',
                        fix_applied='Répertoire créé'
                    )
                except Exception as e:
                    self._add_check_result(
                        results, 'filesystem', 'backup_root_exists',
                        'critical', f'Impossible de créer le répertoire de sauvegarde: {e}',
                        details=str(e)
                    )
            else:
                self._add_check_result(
                    results, 'filesystem', 'backup_root_exists',
                    'critical', f'Répertoire de sauvegarde inexistant: {backup_root}'
                )
        else:
            # Vérifier les permissions
            if os.access(backup_root, os.W_OK):
                self._add_check_result(
                    results, 'filesystem', 'backup_root_exists',
                    'ok', f'Répertoire de sauvegarde accessible: {backup_root}'
                )
            else:
                self._add_check_result(
                    results, 'filesystem', 'backup_root_permissions',
                    'critical', f'Permissions insuffisantes sur le répertoire de sauvegarde: {backup_root}'
                )
        
        # Vérifier l'espace disque
        try:
            total, used, free = shutil.disk_usage(str(backup_root))
            free_gb = free / (1024 * 1024 * 1024)
            
            if free_gb < 1:
                self._add_check_result(
                    results, 'filesystem', 'disk_space',
                    'critical', f'Espace disque critique: {free_gb:.2f} GB disponible'
                )
            elif free_gb < 5:
                self._add_check_result(
                    results, 'filesystem', 'disk_space',
                    'warning', f'Espace disque faible: {free_gb:.2f} GB disponible'
                )
            else:
                self._add_check_result(
                    results, 'filesystem', 'disk_space',
                    'ok', f'Espace disque suffisant: {free_gb:.2f} GB disponible'
                )
        except Exception as e:
            self._add_check_result(
                results, 'filesystem', 'disk_space',
                'warning', f'Impossible de vérifier l\'espace disque: {e}',
                details=str(e)
            )
        
        # Vérifier le répertoire temporaire
        temp_dir = backup_root / 'temp'
        if not temp_dir.exists():
            if fix_issues:
                try:
                    temp_dir.mkdir(parents=True, exist_ok=True)
                    self._add_check_result(
                        results, 'filesystem', 'temp_dir_exists',
                        'ok', f'Répertoire temporaire créé: {temp_dir}',
                        fix_applied='Répertoire créé'
                    )
                except Exception as e:
                    self._add_check_result(
                        results, 'filesystem', 'temp_dir_exists',
                        'warning', f'Impossible de créer le répertoire temporaire: {e}',
                        details=str(e)
                    )
            else:
                self._add_check_result(
                    results, 'filesystem', 'temp_dir_exists',
                    'warning', f'Répertoire temporaire inexistant: {temp_dir}'
                )
    
    def _check_database(self, results):
        """Vérifie la connexion à la base de données et les tables nécessaires"""
        try:
            with connection.cursor() as cursor:
                # Vérifier si les tables existent
                tables_to_check = [
                    'backup_manager_backupconfiguration',
                    'backup_manager_backuphistory',
                    'backup_manager_restorehistory'
                ]
                
                for table in tables_to_check:
                    try:
                        cursor.execute(f"SELECT COUNT(*) FROM {table}")
                        count = cursor.fetchone()[0]
                        self._add_check_result(
                            results, 'database', f'table_{table}',
                            'ok', f'Table {table} accessible ({count} enregistrements)'
                        )
                    except Exception as e:
                        self._add_check_result(
                            results, 'database', f'table_{table}',
                            'critical', f'Table {table} inaccessible: {e}',
                            details=str(e)
                        )
        except Exception as e:
            self._add_check_result(
                results, 'database', 'connection',
                'critical', f'Erreur de connexion à la base de données: {e}',
                details=str(e)
            )
    
    def _check_configurations(self, results):
        """Vérifie les configurations de sauvegarde"""
        try:
            configs_count = BackupConfiguration.objects.count()
            active_configs = BackupConfiguration.objects.filter(is_active=True).count()
            
            if configs_count == 0:
                self._add_check_result(
                    results, 'configuration', 'configs_exist',
                    'warning', 'Aucune configuration de sauvegarde définie'
                )
            elif active_configs == 0:
                self._add_check_result(
                    results, 'configuration', 'active_configs',
                    'warning', f'{configs_count} configuration(s) définie(s), mais aucune active'
                )
            else:
                self._add_check_result(
                    results, 'configuration', 'active_configs',
                    'ok', f'{active_configs} configuration(s) active(s) sur {configs_count}'
                )
        except Exception as e:
            self._add_check_result(
                results, 'configuration', 'configs_check',
                'warning', f'Impossible de vérifier les configurations: {e}',
                details=str(e)
            )
    
    def _check_backup_history(self, results, deep_check):
        """Vérifie l'historique des sauvegardes"""
        try:
            # Vérifier les sauvegardes récentes
            one_week_ago = timezone.now() - timedelta(days=7)
            recent_backups = BackupHistory.objects.filter(created_at__gte=one_week_ago).count()
            
            if recent_backups == 0:
                self._add_check_result(
                    results, 'backup_history', 'recent_backups',
                    'warning', 'Aucune sauvegarde effectuée durant les 7 derniers jours'
                )
            else:
                self._add_check_result(
                    results, 'backup_history', 'recent_backups',
                    'ok', f'{recent_backups} sauvegarde(s) effectuée(s) durant les 7 derniers jours'
                )
            
            # Vérifier les sauvegardes en échec
            failed_backups = BackupHistory.objects.filter(status='failed').count()
            if failed_backups > 0:
                self._add_check_result(
                    results, 'backup_history', 'failed_backups',
                    'warning', f'{failed_backups} sauvegarde(s) en échec dans l\'historique'
                )
            
            # Vérifier les sauvegardes bloquées
            six_hours_ago = timezone.now() - timedelta(hours=6)
            stuck_backups = BackupHistory.objects.filter(
                status__in=['running', 'pending'],
                started_at__lt=six_hours_ago
            ).count()
            
            if stuck_backups > 0:
                self._add_check_result(
                    results, 'backup_history', 'stuck_backups',
                    'critical', f'{stuck_backups} sauvegarde(s) bloquée(s) depuis plus de 6 heures',
                    details='Utilisez la commande cleanup_stuck_operations pour les nettoyer'
                )
            
            # Vérification approfondie des fichiers
            if deep_check:
                completed_backups = BackupHistory.objects.filter(status='completed')
                missing_files = 0
                
                for backup in completed_backups:
                    if not backup.file_path or not os.path.exists(backup.file_path):
                        missing_files += 1
                
                if missing_files > 0:
                    self._add_check_result(
                        results, 'backup_history', 'missing_files',
                        'warning', f'{missing_files} fichier(s) de sauvegarde manquant(s)',
                        details='Utilisez la commande rebuild_backup_paths pour corriger les chemins'
                    )
                else:
                    self._add_check_result(
                        results, 'backup_history', 'backup_files',
                        'ok', 'Tous les fichiers de sauvegarde sont accessibles'
                    )
        except Exception as e:
            self._add_check_result(
                results, 'backup_history', 'history_check',
                'warning', f'Impossible de vérifier l\'historique des sauvegardes: {e}',
                details=str(e)
            )
    
    def _check_restore_history(self, results):
        """Vérifie l'historique des restaurations"""
        try:
            # Vérifier les restaurations bloquées
            six_hours_ago = timezone.now() - timedelta(hours=6)
            stuck_restores = RestoreHistory.objects.filter(
                status__in=['running', 'pending'],
                started_at__lt=six_hours_ago
            ).count()
            
            if stuck_restores > 0:
                self._add_check_result(
                    results, 'restore_history', 'stuck_restores',
                    'critical', f'{stuck_restores} restauration(s) bloquée(s) depuis plus de 6 heures',
                    details='Utilisez la commande cleanup_stuck_operations pour les nettoyer'
                )
            
            # Vérifier les restaurations récentes en échec
            one_week_ago = timezone.now() - timedelta(days=7)
            failed_restores = RestoreHistory.objects.filter(
                status='failed',
                created_at__gte=one_week_ago
            ).count()
            
            if failed_restores > 0:
                self._add_check_result(
                    results, 'restore_history', 'failed_restores',
                    'warning', f'{failed_restores} restauration(s) en échec durant les 7 derniers jours'
                )
        except Exception as e:
            self._add_check_result(
                results, 'restore_history', 'history_check',
                'warning', f'Impossible de vérifier l\'historique des restaurations: {e}',
                details=str(e)
            )
    
    def _check_dependencies(self, results):
        """Vérifie les dépendances externes"""
        # Vérifier les outils de base de données
        db_engine = settings.DATABASES['default']['ENGINE']
        
        if 'sqlite3' in db_engine:
            self._check_command(results, 'sqlite3', '--version', 'database_tools')
        elif 'postgresql' in db_engine:
            self._check_command(results, 'pg_dump', '--version', 'database_tools')
        elif 'mysql' in db_engine:
            self._check_command(results, 'mysqldump', '--version', 'database_tools')
        
        # Vérifier les outils de compression/chiffrement
        self._check_command(results, 'zip', '--version', 'compression_tools')
        self._check_command(results, 'openssl', 'version', 'encryption_tools')
        
        # Vérifier que le service de chiffrement fonctionne
        try:
            encryption_service = EncryptionService()
            test_data = b"Test encryption service"
            encrypted = encryption_service.encrypt(test_data)
            decrypted = encryption_service.decrypt(encrypted)
            
            if decrypted == test_data:
                self._add_check_result(
                    results, 'services', 'encryption_service',
                    'ok', 'Service de chiffrement fonctionnel'
                )
            else:
                self._add_check_result(
                    results, 'services', 'encryption_service',
                    'critical', 'Service de chiffrement défectueux: les données déchiffrées ne correspondent pas'
                )
        except Exception as e:
            self._add_check_result(
                results, 'services', 'encryption_service',
                'critical', f'Service de chiffrement défectueux: {e}',
                details=str(e)
            )
    
    def _check_command(self, results, command, args, category):
        """Vérifie si une commande est disponible"""
        try:
            args_list = args.split() if args else []
            process = subprocess.run(
                [command] + args_list,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=5
            )
            
            if process.returncode == 0:
                version = process.stdout.strip()
                self._add_check_result(
                    results, category, f'{command}_available',
                    'ok', f'Commande {command} disponible: {version[:50]}'
                )
            else:
                self._add_check_result(
                    results, category, f'{command}_available',
                    'warning', f'Commande {command} disponible mais retourne une erreur: {process.stderr[:50]}'
                )
        except FileNotFoundError:
            self._add_check_result(
                results, category, f'{command}_available',
                'critical', f'Commande {command} non trouvée dans le PATH'
            )
        except Exception as e:
            self._add_check_result(
                results, category, f'{command}_available',
                'warning', f'Erreur lors de la vérification de la commande {command}: {e}',
                details=str(e)
            )
    
    def _check_permissions(self, results, fix_issues):
        """Vérifie les permissions sur les répertoires critiques"""
        # Déterminer le répertoire de sauvegarde
        if hasattr(settings, 'BACKUP_ROOT'):
            backup_root = Path(settings.BACKUP_ROOT)
        else:
            backup_root = Path(settings.MEDIA_ROOT) / 'backups'
        
        # Liste des répertoires à vérifier
        directories = [
            backup_root,
            backup_root / 'temp',
            Path(settings.MEDIA_ROOT)
        ]
        
        for directory in directories:
            if not directory.exists():
                continue
            
            dir_str = str(directory)
            
            # Vérifier les permissions de lecture
            if not os.access(dir_str, os.R_OK):
                if fix_issues:
                    try:
                        os.chmod(dir_str, 0o755)  # rwxr-xr-x
                        if os.access(dir_str, os.R_OK):
                            self._add_check_result(
                                results, 'permissions', f'{directory.name}_read',
                                'ok', f'Permissions de lecture corrigées sur {dir_str}',
                                fix_applied='Permissions modifiées à 755'
                            )
                        else:
                            self._add_check_result(
                                results, 'permissions', f'{directory.name}_read',
                                'critical', f'Impossible de corriger les permissions de lecture sur {dir_str}'
                            )
                    except Exception as e:
                        self._add_check_result(
                            results, 'permissions', f'{directory.name}_read',
                            'critical', f'Erreur lors de la correction des permissions sur {dir_str}: {e}',
                            details=str(e)
                        )
                else:
                    self._add_check_result(
                        results, 'permissions', f'{directory.name}_read',
                        'critical', f'Permissions de lecture insuffisantes sur {dir_str}'
                    )
            
            # Vérifier les permissions d'écriture
            if not os.access(dir_str, os.W_OK):
                if fix_issues:
                    try:
                        os.chmod(dir_str, 0o755)  # rwxr-xr-x
                        if os.access(dir_str, os.W_OK):
                            self._add_check_result(
                                results, 'permissions', f'{directory.name}_write',
                                'ok', f'Permissions d\'écriture corrigées sur {dir_str}',
                                fix_applied='Permissions modifiées à 755'
                            )
                        else:
                            self._add_check_result(
                                results, 'permissions', f'{directory.name}_write',
                                'critical', f'Impossible de corriger les permissions d\'écriture sur {dir_str}'
                            )
                    except Exception as e:
                        self._add_check_result(
                            results, 'permissions', f'{directory.name}_write',
                            'critical', f'Erreur lors de la correction des permissions sur {dir_str}: {e}',
                            details=str(e)
                        )
                else:
                    self._add_check_result(
                        results, 'permissions', f'{directory.name}_write',
                        'critical', f'Permissions d\'écriture insuffisantes sur {dir_str}'
                    )
    
    def _print_results(self, results):
        """Affiche les résultats dans un format lisible"""
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write(f"VÉRIFICATION DU SYSTÈME DE SAUVEGARDE - {results['timestamp']}")
        self.stdout.write("=" * 80)
        
        # Informations système
        self.stdout.write("\n📊 INFORMATIONS SYSTÈME")
        self.stdout.write("-" * 80)
        for key, value in results['system_info'].items():
            self.stdout.write(f"{key}: {value}")
        
        # Résultats des vérifications par catégorie
        categories = set(check['category'] for check in results['checks'])
        
        for category in sorted(categories):
            self.stdout.write("\n" + "-" * 80)
            self.stdout.write(f"📋 CATÉGORIE: {category.upper()}")
            self.stdout.write("-" * 80)
            
            category_checks = [c for c in results['checks'] if c['category'] == category]
            for check in category_checks:
                if check['status'] == 'ok':
                    status_icon = "✅"
                    style = self.style.SUCCESS
                elif check['status'] == 'warning':
                    status_icon = "⚠️"
                    style = self.style.WARNING
                else:  # critical
                    status_icon = "❌"
                    style = self.style.ERROR
                
                self.stdout.write(style(f"{status_icon} {check['name']}: {check['message']}"))
                
                if 'fix_applied' in check:
                    self.stdout.write(self.style.SUCCESS(f"   ↳ Correction appliquée: {check['fix_applied']}"))
                
                if 'details' in check and check['details']:
                    self.stdout.write(f"   ↳ Détails: {check['details']}")
        
        # Résumé
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write("📈 RÉSUMÉ")
        self.stdout.write("-" * 80)
        
        summary = results['summary']
        self.stdout.write(f"✅ OK: {summary['ok']}")
        self.stdout.write(self.style.WARNING(f"⚠️ Avertissements: {summary['warning']}"))
        self.stdout.write(self.style.ERROR(f"❌ Problèmes critiques: {summary['critical']}"))
        
        if summary['fixed'] > 0:
            self.stdout.write(self.style.SUCCESS(f"🔧 Problèmes corrigés: {summary['fixed']}"))
        
        self.stdout.write("=" * 80)
        
        # Conclusion
        if summary['critical'] > 0:
            self.stdout.write(self.style.ERROR("\n⚠️ Des problèmes critiques nécessitent votre attention!"))
        elif summary['warning'] > 0:
            self.stdout.write(self.style.WARNING("\n⚠️ Des avertissements ont été détectés, vérifiez les détails ci-dessus."))
        else:
            self.stdout.write(self.style.SUCCESS("\n✅ Système de sauvegarde en bon état!")) 