"""
Commande pour diagnostiquer et corriger les métadonnées des sauvegardes
"""

import os
import hashlib
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from backup_manager.models import BackupHistory


class Command(BaseCommand):
    help = 'Diagnostique et corrige les métadonnées manquantes des sauvegardes'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche ce qui serait fait sans appliquer les changements'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force la correction même si les fichiers sont volumineux'
        )
        parser.add_argument(
            '--backup-id',
            type=int,
            help='Répare une sauvegarde spécifique par son ID'
        )

    def handle(self, *args, **options):
        self.dry_run = options['dry_run']
        self.force = options['force']
        backup_id = options.get('backup_id')
        
        self.stdout.write(self.style.SUCCESS('🔧 Diagnostic des métadonnées de sauvegarde'))
        
        if backup_id:
            self._fix_specific_backup(backup_id)
        else:
            self._scan_and_fix_all_backups()
    
    def _fix_specific_backup(self, backup_id):
        """Répare une sauvegarde spécifique"""
        try:
            backup = BackupHistory.objects.get(id=backup_id)
            self.stdout.write(f"🔍 Analyse de la sauvegarde ID {backup_id}: {backup.backup_name}")
            
            if self._needs_fixing(backup):
                if self._try_fix_backup(backup):
                    self.stdout.write(self.style.SUCCESS(f"✅ Sauvegarde ID {backup_id} corrigée"))
                else:
                    self.stdout.write(self.style.ERROR(f"❌ Impossible de corriger la sauvegarde ID {backup_id}"))
            else:
                self.stdout.write(f"✅ Sauvegarde ID {backup_id} déjà correcte")
        
        except BackupHistory.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"❌ Sauvegarde ID {backup_id} introuvable"))
    
    def _scan_and_fix_all_backups(self):
        """Scanne et répare toutes les sauvegardes problématiques"""
        problematic_backups = BackupHistory.objects.filter(
            status__in=['completed', 'file_missing']
        ).filter(
            file_path__isnull=True
        ) | BackupHistory.objects.filter(
            status__in=['completed', 'file_missing']
        ).filter(
            file_path=""
        ) | BackupHistory.objects.filter(
            status__in=['completed', 'file_missing']
        ).filter(
            file_size__isnull=True
        )
        
        self.stdout.write(f"🔍 {problematic_backups.count()} sauvegarde(s) problématique(s) trouvée(s)")
        
        fixed_count = 0
        failed_count = 0
        
        for backup in problematic_backups:
            self.stdout.write(f"\n📋 Analyse: ID {backup.id} - {backup.backup_name}")
            
            if self._try_fix_backup(backup):
                fixed_count += 1
                self.stdout.write(self.style.SUCCESS(f"   ✅ Corrigée"))
            else:
                failed_count += 1
                self.stdout.write(self.style.WARNING(f"   ⚠️ Non corrigée"))
        
        self.stdout.write(self.style.SUCCESS(f"\n📊 Résumé: {fixed_count} corrigées, {failed_count} non corrigées"))
    
    def _needs_fixing(self, backup):
        """Vérifie si une sauvegarde a besoin d'être corrigée"""
        return (
            backup.status in ['completed', 'file_missing'] and (
                not backup.file_path or
                backup.file_size is None or
                not backup.checksum
            )
        )
    
    def _try_fix_backup(self, backup):
        """Tente de corriger une sauvegarde en recherchant son fichier"""
        if self.dry_run:
            self.stdout.write(f"   🧪 [DRY-RUN] Tenterait de corriger {backup.backup_name}")
            return True
        
        # Recherche du fichier potentiel
        potential_file = self._find_backup_file(backup)
        
        if not potential_file:
            self.stdout.write(f"   ❌ Fichier introuvable pour {backup.backup_name}")
            return False
        
        # Vérification de la taille (sécurité)
        file_size = potential_file.stat().st_size
        if file_size > 100 * 1024 * 1024 and not self.force:  # 100 MB
            self.stdout.write(f"   ⚠️ Fichier volumineux ({self._format_size(file_size)}), utilisez --force")
            return False
        
        # Calcul des métadonnées
        try:
            checksum = self._calculate_checksum(potential_file)
            relative_path = self._get_relative_path(potential_file)
            
            # Mise à jour de la sauvegarde
            backup.file_path = relative_path
            backup.file_size = file_size
            backup.checksum = checksum
            backup.status = 'completed'  # Remettre le statut à completed
            
            if not backup.completed_at:
                backup.completed_at = backup.created_at
            if not backup.duration_seconds:
                backup.duration_seconds = 0
            
            backup.save()
            
            self.stdout.write(f"   📏 Taille: {self._format_size(file_size)}")
            self.stdout.write(f"   🔐 Checksum: {checksum[:16]}...")
            self.stdout.write(f"   📁 Chemin: {relative_path}")
            
            return True
            
        except Exception as e:
            self.stdout.write(f"   ❌ Erreur: {str(e)}")
            return False
    
    def _find_backup_file(self, backup):
        """Recherche le fichier de sauvegarde correspondant"""
        backup_root = Path(getattr(settings, 'BACKUP_ROOT', 'backups'))
        
        # Motifs de recherche basés sur le nom
        search_patterns = [
            f"*{backup.backup_name}*",
            f"*{backup.backup_name.replace('_', '*')}*",
            # Recherche par date si le nom contient une date
        ]
        
        for pattern in search_patterns:
            for file_path in backup_root.rglob(pattern):
                if file_path.is_file() and file_path.suffix in ['.encrypted', '.zip']:
                    return file_path
        
        return None
    
    def _calculate_checksum(self, file_path):
        """Calcule le checksum SHA-256 d'un fichier"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    
    def _get_relative_path(self, file_path):
        """Obtient le chemin relatif depuis BACKUP_ROOT"""
        backup_root = Path(getattr(settings, 'BACKUP_ROOT', 'backups'))
        try:
            return str(file_path.relative_to(backup_root))
        except ValueError:
            # Si le fichier n'est pas dans BACKUP_ROOT, retourner le chemin absolu
            return str(file_path.absolute())
    
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