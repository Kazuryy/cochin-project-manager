"""
Commande Django pour nettoyer et archiver les anciens logs
"""

import os
import gzip
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone


class Command(BaseCommand):
    help = 'Nettoie et archive les anciens fichiers de logs'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Âge en jours pour supprimer les logs (défaut: 30)'
        )
        parser.add_argument(
            '--compress-days',
            type=int,
            default=7,
            help='Âge en jours pour compresser les logs (défaut: 7)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulation sans suppression/compression réelle'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force le nettoyage sans confirmation'
        )

    def handle(self, *args, **options):
        self.verbosity = options['verbosity']
        self.dry_run = options['dry_run']
        self.force = options['force']
        self.days = options['days']
        self.compress_days = options['compress_days']
        
        self.logs_dir = Path(settings.BASE_DIR) / 'logs'
        
        if not self.logs_dir.exists():
            self.stdout.write(
                self.style.WARNING(f"Répertoire de logs non trouvé: {self.logs_dir}")
            )
            return
        
        self.stdout.write(
            self.style.SUCCESS(f"🧹 Nettoyage des logs dans: {self.logs_dir}")
        )
        
        # Statistiques
        stats = {
            'compressed': 0,
            'deleted': 0,
            'space_freed': 0,
            'space_saved': 0
        }
        
        # 1. Compresser les logs anciens
        stats.update(self._compress_old_logs())
        
        # 2. Supprimer les très anciens logs
        stats.update(self._delete_old_logs())
        
        # 3. Rapport final
        self._print_summary(stats)

    def _compress_old_logs(self):
        """Compresse les logs plus anciens que compress_days"""
        stats = {'compressed': 0, 'space_saved': 0}
        cutoff_date = datetime.now() - timedelta(days=self.compress_days)
        
        self.stdout.write(f"📦 Compression des logs > {self.compress_days} jours...")
        
        for log_file in self.logs_dir.glob('*.log'):
            # Skip les fichiers déjà compressés
            if log_file.suffix == '.gz':
                continue
                
            # Vérifier l'âge du fichier
            file_mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
            
            if file_mtime < cutoff_date:
                original_size = log_file.stat().st_size
                compressed_path = log_file.with_suffix(log_file.suffix + '.gz')
                
                if compressed_path.exists():
                    continue  # Déjà compressé
                
                if self.verbosity >= 2:
                    self.stdout.write(f"  Compression: {log_file.name}")
                
                if not self.dry_run:
                    try:
                        with open(log_file, 'rb') as f_in:
                            with gzip.open(compressed_path, 'wb') as f_out:
                                shutil.copyfileobj(f_in, f_out)
                        
                        # Supprimer l'original après compression réussie
                        log_file.unlink()
                        
                        compressed_size = compressed_path.stat().st_size
                        stats['compressed'] += 1
                        stats['space_saved'] += original_size - compressed_size
                        
                        if self.verbosity >= 1:
                            ratio = (1 - compressed_size / original_size) * 100
                            self.stdout.write(
                                f"  ✅ {log_file.name} compressé (gain: {ratio:.1f}%)"
                            )
                    
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(f"  ❌ Erreur compression {log_file.name}: {e}")
                        )
        
        return stats

    def _delete_old_logs(self):
        """Supprime les logs (compressés ou non) plus anciens que days"""
        stats = {'deleted': 0, 'space_freed': 0}
        cutoff_date = datetime.now() - timedelta(days=self.days)
        
        self.stdout.write(f"🗑️  Suppression des logs > {self.days} jours...")
        
        # Chercher tous les fichiers de logs (y compris .gz)
        patterns = ['*.log', '*.log.gz', '*.log.*']
        files_to_delete = []
        
        for pattern in patterns:
            files_to_delete.extend(self.logs_dir.glob(pattern))
        
        for log_file in files_to_delete:
            # Vérifier l'âge du fichier
            file_mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
            
            if file_mtime < cutoff_date:
                file_size = log_file.stat().st_size
                
                if self.verbosity >= 2:
                    self.stdout.write(f"  Suppression: {log_file.name}")
                
                if not self.dry_run:
                    try:
                        log_file.unlink()
                        stats['deleted'] += 1
                        stats['space_freed'] += file_size
                        
                        if self.verbosity >= 1:
                            self.stdout.write(f"  🗑️  {log_file.name} supprimé")
                    
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(f"  ❌ Erreur suppression {log_file.name}: {e}")
                        )
        
        return stats

    def _print_summary(self, stats):
        """Affiche le résumé des opérations"""
        self.stdout.write("\n" + "="*50)
        self.stdout.write(self.style.SUCCESS("📊 RÉSUMÉ DU NETTOYAGE"))
        self.stdout.write("="*50)
        
        if self.dry_run:
            self.stdout.write(self.style.WARNING("🔍 MODE SIMULATION - Aucune modification réelle"))
        
        self.stdout.write(f"📦 Fichiers compressés: {stats['compressed']}")
        self.stdout.write(f"🗑️  Fichiers supprimés: {stats['deleted']}")
        self.stdout.write(f"💾 Espace libéré: {self._format_size(stats['space_freed'])}")
        self.stdout.write(f"🗜️  Espace économisé (compression): {self._format_size(stats['space_saved'])}")
        
        total_space = stats['space_freed'] + stats['space_saved']
        self.stdout.write(
            self.style.SUCCESS(f"🎉 Total espace récupéré: {self._format_size(total_space)}")
        )

    def _format_size(self, size_bytes):
        """Formate la taille en bytes vers une unité lisible"""
        if size_bytes == 0:
            return "0B"
        
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f}{unit}"
            size_bytes /= 1024.0
        
        return f"{size_bytes:.1f}TB" 