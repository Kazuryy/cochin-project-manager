"""
Commande Django pour nettoyer les fichiers temporaires de sauvegarde
Version améliorée avec nettoyage automatique intelligent
"""

import os
import shutil
import logging
from pathlib import Path
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('backup_manager')

class Command(BaseCommand):
    help = 'Nettoie les fichiers temporaires de sauvegarde avec intelligence'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force le nettoyage sans demander de confirmation'
        )
        parser.add_argument(
            '--auto',
            action='store_true',
            help='Mode automatique - nettoie les fichiers de plus de 24h sans confirmation'
        )
        parser.add_argument(
            '--age-hours',
            type=int,
            default=24,
            help='Âge minimum en heures pour supprimer automatiquement (défaut: 24h)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulation sans suppression réelle'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Mode verbeux avec détails'
        )

    def handle(self, *args, **options):
        self.force = options['force']
        self.auto = options['auto']
        self.age_hours = options['age_hours']
        self.dry_run = options['dry_run']
        self.verbose = options['verbose']
        
        # Obtenir le répertoire de base des sauvegardes
        if hasattr(settings, 'BACKUP_ROOT'):
            self.backup_root = Path(settings.BACKUP_ROOT)
        else:
            self.backup_root = Path(settings.BASE_DIR) / 'backups'
        
        if not self.backup_root.exists():
            self.stdout.write(self.style.WARNING(f'📁 Répertoire de sauvegarde non trouvé: {self.backup_root}'))
            return
        
        self.stdout.write(self.style.SUCCESS(f'🔍 Analyse du répertoire: {self.backup_root}'))
        
        # Analyser l'état actuel
        stats = self.analyze_directories()
        
        # Afficher l'état avant nettoyage
        self.display_current_state(stats)
        
        # Nettoyage intelligent
        if self.auto:
            self.auto_cleanup(stats)
        else:
            self.interactive_cleanup(stats)
    
    def analyze_directories(self):
        """Analyse les répertoires et retourne les statistiques"""
        stats = {}
        cutoff_time = datetime.now() - timedelta(hours=self.age_hours)
        
        directories = {
            'restore_temp': self.backup_root / 'restore_temp',
            'temp': self.backup_root / 'temp', 
            'uploads': self.backup_root / 'uploads'
        }
        
        for name, path in directories.items():
            if not path.exists():
                stats[name] = {'size': 0, 'files': 0, 'old_files': 0, 'old_size': 0, 'items': []}
                continue
                
            total_size = 0
            total_files = 0
            old_size = 0
            old_files = 0
            items = []
            
            for item in path.iterdir():
                try:
                    if item.is_file():
                        size = item.stat().st_size
                        mtime = datetime.fromtimestamp(item.stat().st_mtime)
                        total_size += size
                        total_files += 1
                        
                        if mtime < cutoff_time:
                            old_size += size
                            old_files += 1
                            
                        items.append({
                            'path': item,
                            'size': size,
                            'mtime': mtime,
                            'is_old': mtime < cutoff_time,
                            'type': 'file'
                        })
                    elif item.is_dir():
                        size = self._get_dir_size(item)
                        mtime = datetime.fromtimestamp(item.stat().st_mtime)
                        total_size += size
                        total_files += 1
                        
                        if mtime < cutoff_time:
                            old_size += size
                            old_files += 1
                            
                        items.append({
                            'path': item,
                            'size': size,
                            'mtime': mtime,
                            'is_old': mtime < cutoff_time,
                            'type': 'directory'
                        })
                except (OSError, PermissionError) as e:
                    if self.verbose:
                        self.stdout.write(self.style.WARNING(f'⚠️ Erreur lecture {item}: {e}'))
            
            stats[name] = {
                'size': total_size,
                'files': total_files,
                'old_size': old_size,
                'old_files': old_files,
                'items': items,
                'path': path
            }
        
        return stats
    
    def _get_dir_size(self, path):
        """Calcule la taille d'un répertoire récursivement"""
        total = 0
        try:
            for entry in path.rglob('*'):
                if entry.is_file():
                    total += entry.stat().st_size
        except (OSError, PermissionError):
            pass
        return total
    
    def display_current_state(self, stats):
        """Affiche l'état actuel des fichiers temporaires"""
        self.stdout.write(self.style.SUCCESS('\n📊 État des fichiers temporaires:'))
        
        total_size = sum(stat['size'] for stat in stats.values())
        total_files = sum(stat['files'] for stat in stats.values())
        total_old_size = sum(stat['old_size'] for stat in stats.values())
        total_old_files = sum(stat['old_files'] for stat in stats.values())
        
        for name, stat in stats.items():
            size_str = self.format_size(stat['size'])
            old_size_str = self.format_size(stat['old_size'])
            
            icon = {'restore_temp': '🔄', 'temp': '📁', 'uploads': '📤'}.get(name, '📁')
            
            self.stdout.write(f'   {icon} {name:12} : {size_str:10} ({stat["files"]} éléments)')
            
            if stat['old_files'] > 0:
                self.stdout.write(f'      ⏰ Anciens (>{self.age_hours}h): {old_size_str:10} ({stat["old_files"]} éléments)')
        
        self.stdout.write(f'\n📏 Total: {self.format_size(total_size)} ({total_files} éléments)')
        
        if total_old_files > 0:
            self.stdout.write(f'⏰ Nettoyables: {self.format_size(total_old_size)} ({total_old_files} éléments)')
    
    def auto_cleanup(self, stats):
        """Nettoyage automatique des fichiers anciens"""
        total_old_files = sum(stat['old_files'] for stat in stats.values())
        total_old_size = sum(stat['old_size'] for stat in stats.values())
        
        if total_old_files == 0:
            self.stdout.write(self.style.SUCCESS('✅ Aucun fichier ancien à nettoyer'))
            return
        
        self.stdout.write(self.style.WARNING(
            f'\n🤖 Nettoyage automatique: {total_old_files} éléments anciens ({self.format_size(total_old_size)})'
        ))
        
        if not self.dry_run:
            cleaned_files, cleaned_size = self._clean_old_files(stats)
            self.stdout.write(self.style.SUCCESS(
                f'✅ Nettoyé: {cleaned_files} éléments, {self.format_size(cleaned_size)} récupérés'
            ))
        else:
            self.stdout.write(self.style.WARNING('🧪 Mode simulation - aucune suppression effectuée'))
    
    def interactive_cleanup(self, stats):
        """Nettoyage interactif avec confirmation"""
        total_old_files = sum(stat['old_files'] for stat in stats.values())
        total_old_size = sum(stat['old_size'] for stat in stats.values())
        
        if total_old_files == 0:
            self.stdout.write(self.style.SUCCESS('✅ Aucun fichier ancien à nettoyer'))
            return
        
        # Afficher le détail si verbeux
        if self.verbose:
            self.display_detailed_items(stats)
        
        size_str = self.format_size(total_old_size)
        
        if not self.force:
            prompt = f'\n❓ Nettoyer {size_str} de fichiers temporaires anciens? [y/N] '
            response = input(prompt).lower().strip()
            
            if response not in ['y', 'yes', 'oui', 'o']:
                self.stdout.write(self.style.WARNING('❌ Nettoyage annulé.'))
                return
        
        if not self.dry_run:
            cleaned_files, cleaned_size = self._clean_old_files(stats)
            self.stdout.write(self.style.SUCCESS(
                f'✅ Nettoyé: {cleaned_files} éléments, {self.format_size(cleaned_size)} récupérés'
            ))
        else:
            self.stdout.write(self.style.WARNING('🧪 Mode simulation - aucune suppression effectuée'))
    
    def display_detailed_items(self, stats):
        """Affiche le détail des éléments à supprimer"""
        self.stdout.write(self.style.WARNING('\n📋 Détail des éléments anciens:'))
        
        for name, stat in stats.items():
            old_items = [item for item in stat['items'] if item['is_old']]
            if old_items:
                self.stdout.write(f'\n  {name}:')
                for item in old_items[:5]:  # Limiter l'affichage
                    age_str = self._format_age(item['mtime'])
                    size_str = self.format_size(item['size'])
                    type_icon = '📁' if item['type'] == 'directory' else '📄'
                    self.stdout.write(f'    {type_icon} {item["path"].name[:40]:40} {size_str:8} ({age_str})')
                
                if len(old_items) > 5:
                    self.stdout.write(f'    ... et {len(old_items) - 5} autres')
    
    def _clean_old_files(self, stats):
        """Supprime effectivement les fichiers anciens"""
        cleaned_files = 0
        cleaned_size = 0
        
        for name, stat in stats.items():
            for item in stat['items']:
                if item['is_old']:
                    try:
                        if item['type'] == 'directory':
                            shutil.rmtree(item['path'])
                        else:
                            item['path'].unlink()
                        
                        cleaned_files += 1
                        cleaned_size += item['size']
                        
                        if self.verbose:
                            self.stdout.write(f'  🗑️ Supprimé: {item["path"].name}')
                            
                    except (OSError, PermissionError) as e:
                        self.stdout.write(self.style.ERROR(f'❌ Erreur suppression {item["path"]}: {e}'))
        
        return cleaned_files, cleaned_size
    
    def _format_age(self, mtime):
        """Formate l'âge d'un fichier"""
        age = datetime.now() - mtime
        if age.days > 0:
            return f'{age.days}j'
        elif age.seconds > 3600:
            return f'{age.seconds // 3600}h'
        else:
            return f'{age.seconds // 60}m'
    
    def format_size(self, bytes_size):
        """Formate une taille en bytes en format lisible"""
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