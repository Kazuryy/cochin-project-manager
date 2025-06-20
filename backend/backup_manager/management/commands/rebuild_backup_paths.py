"""
Commande Django pour resynchroniser la base de données avec les fichiers de sauvegarde existants
"""

import os
import hashlib
import logging
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from backup_manager.models import BackupHistory, BackupConfiguration
from django.contrib.auth import get_user_model

User = get_user_model()
logger = logging.getLogger('backup_manager')

class Command(BaseCommand):
    help = 'Resynchronise la base de données avec les fichiers de sauvegarde existants'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche les opérations sans les exécuter'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force la resynchronisation sans confirmation'
        )
        parser.add_argument(
            '--scan-only',
            action='store_true',
            help='Scan seulement les fichiers sans créer d\'enregistrements'
        )
        parser.add_argument(
            '--user-id',
            type=int,
            help='ID de l\'utilisateur à associer aux sauvegardes orphelines'
        )

    def handle(self, *args, **options):
        self.dry_run = options['dry_run']
        self.force = options['force']
        self.scan_only = options['scan_only']
        self.user_id = options.get('user_id')
        
        # Obtenir le répertoire de base des sauvegardes
        if hasattr(settings, 'BACKUP_ROOT'):
            self.backup_root = Path(settings.BACKUP_ROOT)
        else:
            self.backup_root = Path(settings.BASE_DIR) / 'backups'
        
        self.storage_path = self.backup_root / 'storage'
        
        if not self.storage_path.exists():
            self.stdout.write(self.style.ERROR(f'❌ Répertoire de stockage non trouvé: {self.storage_path}'))
            return
        
        self.stdout.write(self.style.SUCCESS(f'🔍 Analyse du répertoire: {self.storage_path}'))
        
        # Obtenir l'utilisateur par défaut
        self.default_user = self._get_default_user()
        
        # Scanner les fichiers
        orphaned_files, missing_files = self._scan_backup_files()
        
        # Afficher le résumé
        self._display_summary(orphaned_files, missing_files)
        
        # Traitement selon les options
        if self.scan_only:
            return
        
        if orphaned_files:
            self._process_orphaned_files(orphaned_files)
        
        if missing_files:
            self._process_missing_files(missing_files)
    
    def _get_default_user(self):
        """Obtient l'utilisateur par défaut pour les sauvegardes orphelines"""
        if self.user_id:
            try:
                return User.objects.get(id=self.user_id)
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'❌ Utilisateur avec ID {self.user_id} non trouvé'))
                return None
        
        # Essayer de trouver un superutilisateur
        admin_user = User.objects.filter(is_superuser=True).first()
        if admin_user:
            return admin_user
        
        # Sinon, prendre le premier utilisateur
        first_user = User.objects.first()
        if first_user:
            return first_user
        
        self.stdout.write(self.style.ERROR('❌ Aucun utilisateur trouvé dans la base'))
        return None
    
    def _scan_backup_files(self):
        """Scanne les fichiers de sauvegarde et identifie les orphelins et manquants"""
        self.stdout.write('📋 Analyse des fichiers de sauvegarde...')
        
        # Obtenir tous les fichiers physiques
        physical_files = set()
        for item in self.storage_path.rglob('*'):
            if item.is_file() and item.suffix in ['.zip', '.enc', '.backup']:
                relative_path = item.relative_to(self.backup_root)
                physical_files.add(str(relative_path))
        
        # Obtenir tous les enregistrements en base
        db_records = BackupHistory.objects.all()
        db_files = set()
        missing_files = []
        
        for record in db_records:
            if record.file_path:
                # Normaliser le chemin
                file_path = record.file_path
                if os.path.isabs(file_path):
                    try:
                        relative_path = Path(file_path).relative_to(self.backup_root)
                        normalized_path = str(relative_path)
                    except ValueError:
                        # Fichier en dehors du répertoire de backup
                        normalized_path = file_path
                else:
                    normalized_path = file_path
                
                db_files.add(normalized_path)
                
                # Vérifier si le fichier existe physiquement
                full_path = self.backup_root / normalized_path
                if not full_path.exists():
                    missing_files.append({
                        'record': record,
                        'path': normalized_path,
                        'full_path': full_path
                    })
        
        # Identifier les fichiers orphelins
        orphaned_paths = physical_files - db_files
        orphaned_files = []
        
        for path in orphaned_paths:
            full_path = self.backup_root / path
            try:
                stat = full_path.stat()
                orphaned_files.append({
                    'path': path,
                    'full_path': full_path,
                    'size': stat.st_size,
                    'mtime': stat.st_mtime
                })
            except OSError:
                continue
        
        return orphaned_files, missing_files
    
    def _display_summary(self, orphaned_files, missing_files):
        """Affiche un résumé de l'analyse"""
        self.stdout.write(self.style.SUCCESS('\n📊 Résumé de l\'analyse:'))
        
        total_orphaned_size = sum(f['size'] for f in orphaned_files)
        self.stdout.write(f'   📄 Fichiers orphelins: {len(orphaned_files)} ({self._format_size(total_orphaned_size)})')
        
        if orphaned_files and len(orphaned_files) <= 10:
            for file_info in orphaned_files:
                size_str = self._format_size(file_info['size'])
                self.stdout.write(f'      • {file_info["path"]} ({size_str})')
        elif len(orphaned_files) > 10:
            for file_info in orphaned_files[:5]:
                size_str = self._format_size(file_info['size'])
                self.stdout.write(f'      • {file_info["path"]} ({size_str})')
            self.stdout.write(f'      ... et {len(orphaned_files) - 5} autres')
        
        self.stdout.write(f'   ❌ Enregistrements sans fichier: {len(missing_files)}')
        
        if missing_files and len(missing_files) <= 10:
            for file_info in missing_files:
                self.stdout.write(f'      • ID {file_info["record"].id}: {file_info["path"]}')
        elif len(missing_files) > 10:
            for file_info in missing_files[:5]:
                self.stdout.write(f'      • ID {file_info["record"].id}: {file_info["path"]}')
            self.stdout.write(f'      ... et {len(missing_files) - 5} autres')
    
    def _process_orphaned_files(self, orphaned_files):
        """Traite les fichiers orphelins en créant des enregistrements"""
        if not self.default_user:
            self.stdout.write(self.style.ERROR('❌ Impossible de traiter les fichiers orphelins sans utilisateur par défaut'))
            return
        
        self.stdout.write(f'\n🔧 Traitement de {len(orphaned_files)} fichier(s) orphelin(s)')
        
        if not self.force and not self.dry_run:
            confirm = input(f'❓ Créer les enregistrements pour {len(orphaned_files)} fichier(s) orphelin(s)? [y/N] ')
            if confirm.lower() not in ['y', 'yes', 'oui', 'o']:
                self.stdout.write(self.style.WARNING('❌ Traitement annulé'))
                return
        
        created_count = 0
        
        for file_info in orphaned_files:
            try:
                if self.dry_run:
                    self.stdout.write(f'   🧪 [DRY-RUN] Créerait: {file_info["path"]}')
                    created_count += 1
                else:
                    # Créer l'enregistrement BackupHistory
                    backup_name = self._generate_backup_name(file_info['full_path'])
                    
                    backup_history = BackupHistory.objects.create(
                        backup_name=backup_name,
                        backup_type='full',  # Par défaut
                        status='completed',
                        file_path=str(file_info['path']),
                        file_size=file_info['size'],
                        checksum=self._calculate_checksum(file_info['full_path']),
                        started_at=timezone.now(),
                        completed_at=timezone.now(),
                        created_by=self.default_user
                    )
                    
                    self.stdout.write(f'   ✅ Créé: ID {backup_history.id} - {backup_name}')
                    created_count += 1
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'   ❌ Erreur pour {file_info["path"]}: {e}'))
        
        action = 'seraient créés' if self.dry_run else 'créés'
        self.stdout.write(self.style.SUCCESS(f'✅ {created_count} enregistrement(s) {action}'))
    
    def _process_missing_files(self, missing_files):
        """Traite les enregistrements sans fichier physique"""
        self.stdout.write(f'\n🔧 Traitement de {len(missing_files)} enregistrement(s) sans fichier')
        
        if not self.force and not self.dry_run:
            confirm = input(f'❓ Marquer {len(missing_files)} enregistrement(s) comme "fichier manquant"? [y/N] ')
            if confirm.lower() not in ['y', 'yes', 'oui', 'o']:
                self.stdout.write(self.style.WARNING('❌ Traitement annulé'))
                return
        
        updated_count = 0
        
        for file_info in missing_files:
            try:
                if self.dry_run:
                    self.stdout.write(f'   🧪 [DRY-RUN] Marquerait: ID {file_info["record"].id}')
                    updated_count += 1
                else:
                    record = file_info['record']
                    record.status = 'file_missing'
                    record.error_message = f'Fichier physique non trouvé: {file_info["path"]}'
                    record.save(update_fields=['status', 'error_message'])
                    
                    self.stdout.write(f'   ✅ Marqué: ID {record.id} - {record.backup_name}')
                    updated_count += 1
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'   ❌ Erreur pour ID {file_info["record"].id}: {e}'))
        
        action = 'seraient marqués' if self.dry_run else 'marqués'
        self.stdout.write(self.style.SUCCESS(f'✅ {updated_count} enregistrement(s) {action}'))
    
    def _generate_backup_name(self, file_path):
        """Génère un nom de sauvegarde basé sur le nom du fichier"""
        base_name = file_path.stem
        
        # Extraire des informations du nom de fichier si possible
        if 'backup' in base_name.lower():
            return f'Sauvegarde_Récupérée_{base_name}'
        else:
            return f'Sauvegarde_Orpheline_{base_name}'
    
    def _calculate_checksum(self, file_path):
        """Calcule le checksum SHA-256 d'un fichier"""
        try:
            hash_sha256 = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_sha256.update(chunk)
            return hash_sha256.hexdigest()
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️ Impossible de calculer le checksum pour {file_path}: {e}'))
            return ''
    
    def _format_size(self, bytes_size):
        """Formate une taille en bytes"""
        if bytes_size == 0:
            return "0 B"
        
        units = ['B', 'KB', 'MB', 'GB', 'TB']
        unit_index = 0
        size = float(bytes_size)
        
        while size >= 1024 and unit_index < len(units) - 1:
            size /= 1024
            unit_index += 1
        
        if unit_index == 0:
            return f"{int(size)} {units[unit_index]}"
        else:
            return f"{size:.1f} {units[unit_index]}" 