"""
Service de nettoyage automatique des fichiers temporaires
"""

import os
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Union, Set, Iterator
from django.conf import settings
from .base_service import BaseService


class CleanupService(BaseService):
    """Service pour nettoyer automatiquement les fichiers temporaires"""
    
    # Configuration des répertoires et leurs paramètres de nettoyage
    CLEANUP_CONFIGS = {
        'restore_temp': {'max_age_hours': 24, 'recursive': True},
        'temp': {'max_age_hours': 24, 'recursive': True},
        'uploads': {'max_age_hours': 2, 'recursive': True},
        'storage': {'max_age_hours': 1, 'recursive': False, 'orphan_check': True}
    }
    
    # Cache TTL en secondes (5 minutes)
    CACHE_TTL = 300
    
    def __init__(self):
        super().__init__('CleanupService')
        self.backup_root = self._validate_backup_root()
        # Cache optimisé pour les fichiers référencés
        self._referenced_files_cache: Optional[Set[Path]] = None
        self._cache_timestamp: Optional[datetime] = None
    
    def _validate_backup_root(self) -> Path:
        """Valide et retourne le répertoire racine des backups"""
        if not hasattr(settings, 'BACKUP_ROOT'):
            raise ValueError("BACKUP_ROOT n'est pas configuré dans les settings Django")
        
        backup_root = Path(settings.BACKUP_ROOT)
        backup_root.mkdir(parents=True, exist_ok=True)
        return backup_root
    
    def _calculate_cutoff_time(self, max_age_hours: int) -> datetime:
        """Calcule le temps de coupure pour un âge maximum donné"""
        return datetime.now() - timedelta(hours=max_age_hours)
    
    def _get_file_stats_safe(self, file_path: Path) -> Tuple[datetime, int, bool]:
        """Récupère l'âge, la taille et l'existence d'un fichier de manière sécurisée"""
        try:
            stat_info = file_path.stat()
            return (
                datetime.fromtimestamp(stat_info.st_mtime),
                stat_info.st_size,
                True
            )
        except OSError:
            return datetime.now(), 0, False
    
    def _is_file_old_enough(self, file_path: Path, cutoff_time: datetime) -> bool:
        """Vérifie si un fichier est assez ancien pour être supprimé"""
        file_time, _, exists = self._get_file_stats_safe(file_path)
        return exists and file_time < cutoff_time
    
    def _get_directory_stats_optimized(self, directory: Path, max_depth: Optional[int] = None) -> Tuple[int, int]:
        """
        Calcule la taille ET le nombre de fichiers d'un répertoire de manière optimisée
        
        Args:
            directory: Répertoire à analyser
            max_depth: Profondeur maximale (None = illimitée)
        
        Returns:
            Tuple (taille_totale, nombre_fichiers)
        """
        if not directory.exists():
            return 0, 0
        
        total_size = 0
        file_count = 0
        
        try:
            # Utiliser un générateur avec limitation de profondeur si spécifiée
            if max_depth is not None:
                file_iterator = self._limited_rglob(directory, max_depth)
            else:
                file_iterator = directory.rglob("*")
            
            for file_path in file_iterator:
                if file_path.is_file():
                    try:
                        total_size += file_path.stat().st_size
                        file_count += 1
                    except OSError:
                        # Compter le fichier même si on ne peut pas avoir sa taille
                        file_count += 1
        except OSError as e:
            self.log_warning(f"⚠️ Erreur lors du parcours de {directory}: {e}")
        
        return total_size, file_count
    
    def _limited_rglob(self, directory: Path, max_depth: int) -> Iterator[Path]:
        """Générateur pour parcourir un répertoire avec une profondeur limitée"""
        def _walk_limited(path: Path, current_depth: int):
            if current_depth > max_depth:
                return
            
            try:
                for item in path.iterdir():
                    yield item
                    if item.is_dir():
                        yield from _walk_limited(item, current_depth + 1)
            except OSError:
                pass
        
        return _walk_limited(directory, 0)
    
    def _get_referenced_files_cached(self) -> Set[Path]:
        """Récupère tous les fichiers référencés en base avec cache optimisé"""
        now = datetime.now()
        
        # Vérifier la validité du cache
        if (self._referenced_files_cache is not None and 
            self._cache_timestamp is not None and 
            (now - self._cache_timestamp).total_seconds() < self.CACHE_TTL):
            return self._referenced_files_cache
        
        # Recharger le cache
        self.log_info("🔄 Rechargement du cache des fichiers référencés")
        
        try:
            from ..models import BackupHistory
            
            referenced_files = set()
            # Optimiser la requête avec select_related si nécessaire
            for backup in BackupHistory.objects.filter(file_path__isnull=False).only('file_path'):
                if backup.file_path:
                    # Normaliser le chemin
                    if os.path.isabs(backup.file_path):
                        referenced_files.add(Path(backup.file_path))
                    else:
                        referenced_files.add(self.backup_root / backup.file_path)
            
            # Mettre à jour le cache
            self._referenced_files_cache = referenced_files
            self._cache_timestamp = now
            
            self.log_info(f"✅ Cache rechargé: {len(referenced_files)} fichiers référencés")
            return referenced_files
            
        except Exception as e:
            self.log_error(f"❌ Erreur lors du rechargement du cache: {e}")
            return self._referenced_files_cache or set()
    
    def _should_delete_file(self, file_path: Path, cutoff_time: datetime, 
                           context: str = "general") -> bool:
        """
        Détermine si un fichier doit être supprimé selon le contexte
        
        Args:
            file_path: Chemin du fichier
            cutoff_time: Temps de coupure
            context: Contexte ('orphan', 'decrypted', 'general')
        """
        if not file_path.is_file():
            return False
        
        # Vérifications communes
        if not self._is_file_old_enough(file_path, cutoff_time):
            return False
        
        # Vérifications spécifiques au contexte
        if context == "orphan":
            referenced_files = self._get_referenced_files_cached()
            return file_path not in referenced_files
        
        elif context == "decrypted":
            filename_lower = file_path.name.lower()
            return 'decrypted' in filename_lower or 'temp' in filename_lower
        
        return True  # Contexte général
    
    def _cleanup_directory_generic(self, directory: Path, cutoff_time: datetime,
                                  context: str = "general") -> Dict[str, int]:
        """
        Méthode générique pour nettoyer un répertoire
        
        Args:
            directory: Répertoire à nettoyer
            cutoff_time: Temps de coupure
            context: Contexte pour les règles de suppression
        """
        if not directory.exists():
            return {'files_deleted': 0, 'size_freed': 0, 'directories_removed': 0}
        
        stats = {'files_deleted': 0, 'size_freed': 0, 'directories_removed': 0}
        
        try:
            for item in directory.iterdir():
                if not self._is_file_old_enough(item, cutoff_time):
                    continue
                
                if item.is_file():
                    if self._should_delete_file(item, cutoff_time, context):
                        self._delete_file_safe(item, stats)
                elif item.is_dir():
                    self._delete_directory_safe(item, stats)
                    
        except OSError as e:
            self.log_warning(f"⚠️ Erreur lors du parcours de {directory}: {e}")
        
        return stats
    
    def _delete_file_safe(self, file_path: Path, stats: Dict[str, int]):
        """Supprime un fichier de manière sécurisée et met à jour les stats"""
        try:
            _, file_size, exists = self._get_file_stats_safe(file_path)
            if not exists:
                return
            
            self.log_info(f"  🗑️ Suppression: {file_path.name} ({self.format_size(file_size)})")
            file_path.unlink()
            
            stats['files_deleted'] += 1
            stats['size_freed'] += file_size
            
        except OSError as e:
            self.log_warning(f"⚠️ Impossible de supprimer {file_path}: {e}")
    
    def _delete_directory_safe(self, dir_path: Path, stats: Dict[str, int]):
        """Supprime un répertoire de manière sécurisée et met à jour les stats"""
        try:
            # Calculer les stats avant suppression
            dir_size, file_count = self._get_directory_stats_optimized(dir_path)
            
            self.log_info(f"  🗑️ Suppression: {dir_path.name}/ ({self.format_size(dir_size)}, {file_count} fichiers)")
            shutil.rmtree(dir_path)
            
            stats['files_deleted'] += file_count
            stats['size_freed'] += dir_size
            stats['directories_removed'] += 1
            
        except OSError as e:
            self.log_warning(f"⚠️ Impossible de supprimer {dir_path}: {e}")
    
    def cleanup_all_temporary_files(self, max_age_hours: int = 24) -> Dict[str, Union[Dict[str, int], int, float]]:
        """
        Nettoie tous les fichiers temporaires de manière optimisée
        
        Args:
            max_age_hours: Âge maximum en heures avant suppression
            
        Returns:
            Dictionnaire avec les statistiques de nettoyage
        """
        self.start_operation("Nettoyage automatique des fichiers temporaires")
        
        # Exécuter les nettoyages en parallèle logique
        results = {}
        
        # Nettoyage des répertoires standards
        for dir_name, config in self.CLEANUP_CONFIGS.items():
            if dir_name == 'storage':
                continue  # Traité séparément pour les orphelins
            
            age_hours = config.get('max_age_hours', max_age_hours)
            results[dir_name] = self._cleanup_standard_directory(dir_name, age_hours)
        
        # Nettoyage spécialisé
        results['orphaned_files'] = self.cleanup_orphaned_files()
        results['decrypted_files'] = self.cleanup_decrypted_files_optimized(max_age_hours=1)
        
        # Calculer les totaux
        total_files = sum(r.get('files_deleted', 0) for r in results.values())
        total_size = sum(r.get('size_freed', 0) for r in results.values())
        
        duration = self.end_operation("Nettoyage automatique des fichiers temporaires")
        
        self.log_info(f"✅ Nettoyage terminé en {duration}s: {total_files} fichiers supprimés, {self.format_size(total_size)} libérés")
        
        return {
            **results,
            'totals': {
                'files_deleted': total_files,
                'size_freed': total_size,
                'duration_seconds': duration
            }
        }
    
    def _cleanup_standard_directory(self, dir_name: str, max_age_hours: int) -> Dict[str, int]:
        """Nettoie un répertoire standard selon sa configuration"""
        directory = self.backup_root / dir_name
        cutoff_time = self._calculate_cutoff_time(max_age_hours)
        
        self.log_info(f"📁 Nettoyage {dir_name} (fichiers > {max_age_hours}h)")
        stats = self._cleanup_directory_generic(directory, cutoff_time)
        
        self.log_info(f"✅ {dir_name}: {stats['files_deleted']} fichiers supprimés, "
                     f"{self.format_size(stats['size_freed'])} libérés")
        return stats
    
    def cleanup_decrypted_files_optimized(self, max_age_hours: int = 1) -> Dict[str, int]:
        """
        Version optimisée du nettoyage des fichiers déchiffrés
        Évite le rglob sur tout l'arbre de fichiers
        """
        cutoff_time = self._calculate_cutoff_time(max_age_hours)
        self.log_info(f"🔓 Nettoyage fichiers déchiffrés temporaires (> {max_age_hours}h)")
        
        stats = {'files_deleted': 0, 'size_freed': 0}
        
        # Chercher seulement dans les répertoires susceptibles de contenir ces fichiers
        search_dirs = ['temp', 'restore_temp', 'uploads']
        
        for dir_name in search_dirs:
            search_dir = self.backup_root / dir_name
            if not search_dir.exists():
                continue
                
            try:
                # Limiter la profondeur pour éviter les parcours trop longs
                for file_path in self._limited_rglob(search_dir, max_depth=3):
                    if self._should_delete_file(file_path, cutoff_time, "decrypted"):
                        self._delete_file_safe(file_path, stats)
                        
            except OSError as e:
                self.log_warning(f"⚠️ Erreur lors du parcours de {search_dir}: {e}")
        
        self.log_info(f"✅ déchiffrés: {stats['files_deleted']} fichiers supprimés, {self.format_size(stats['size_freed'])} libérés")
        return stats
    
    def cleanup_orphaned_files(self) -> Dict[str, int]:
        """Supprime les fichiers orphelins (non référencés en base) de manière optimisée"""
        cutoff_time = self._calculate_cutoff_time(1)
        self.log_info("🔍 Recherche de fichiers orphelins")
        
        storage_dir = self.backup_root / "storage"
        if not storage_dir.exists():
            return {'files_deleted': 0, 'size_freed': 0}
        
        stats = {'files_deleted': 0, 'size_freed': 0}
        
        try:
            # Utiliser un parcours limité pour de meilleures performances
            for file_path in self._limited_rglob(storage_dir, max_depth=5):
                if self._should_delete_file(file_path, cutoff_time, "orphan"):
                    self._delete_file_safe(file_path, stats)
                    
        except OSError as e:
            self.log_warning(f"⚠️ Erreur lors du parcours du storage: {e}")
        
        self.log_info(f"✅ orphelins: {stats['files_deleted']} fichiers supprimés, {self.format_size(stats['size_freed'])} libérés")
        return stats
    
    def dry_run_cleanup(self, max_age_hours: int = 24) -> Dict[str, Union[Dict[str, int], str]]:
        """
        Simule le nettoyage sans supprimer les fichiers de manière optimisée
        """
        self.log_info("🧪 Simulation de nettoyage (dry run)")
        
        results = {}
        
        # Simulation pour les répertoires standards
        for dir_name, config in self.CLEANUP_CONFIGS.items():
            if dir_name == 'storage':
                continue
            
            age_hours = config.get('max_age_hours', max_age_hours)
            cutoff_time = self._calculate_cutoff_time(age_hours)
            results[dir_name] = self._dry_run_directory_optimized(
                self.backup_root / dir_name, cutoff_time
            )
        
        # Simulations spécialisées
        results['orphaned_files'] = self._dry_run_orphaned_files_optimized()
        results['decrypted_files'] = self._dry_run_decrypted_files_optimized(max_age_hours=1)
        
        # Calculer les totaux
        total_files = sum(r.get('files_to_delete', 0) for r in results.values())
        total_size = sum(r.get('size_to_free', 0) for r in results.values())
        
        return {
            **results,
            'totals': {
                'files_to_delete': total_files,
                'size_to_free': total_size,
                'size_to_free_formatted': self.format_size(total_size)
            }
        }
    
    def _dry_run_directory_optimized(self, directory: Path, cutoff_time: datetime) -> Dict[str, int]:
        """Version optimisée de la simulation de nettoyage d'un répertoire"""
        if not directory.exists():
            return {'files_to_delete': 0, 'size_to_free': 0, 'directories_to_remove': 0}
        
        files_to_delete = 0
        size_to_free = 0
        directories_to_remove = 0
        
        try:
            for item in directory.iterdir():
                if not self._is_file_old_enough(item, cutoff_time):
                    continue
                
                if item.is_file():
                    _, file_size, exists = self._get_file_stats_safe(item)
                    if exists:
                        files_to_delete += 1
                        size_to_free += file_size
                elif item.is_dir():
                    dir_size, file_count = self._get_directory_stats_optimized(item)
                    files_to_delete += file_count
                    size_to_free += dir_size
                    directories_to_remove += 1
                    
        except OSError as e:
            self.log_warning(f"⚠️ Erreur lors de la simulation pour {directory}: {e}")
        
        return {
            'files_to_delete': files_to_delete,
            'size_to_free': size_to_free,
            'directories_to_remove': directories_to_remove
        }
    
    def _dry_run_orphaned_files_optimized(self) -> Dict[str, int]:
        """Version optimisée de la simulation pour les fichiers orphelins"""
        cutoff_time = self._calculate_cutoff_time(1)
        storage_dir = self.backup_root / "storage"
        
        if not storage_dir.exists():
            return {'files_to_delete': 0, 'size_to_free': 0}
        
        files_to_delete = 0
        size_to_free = 0
        
        try:
            for file_path in self._limited_rglob(storage_dir, max_depth=5):
                if self._should_delete_file(file_path, cutoff_time, "orphan"):
                    files_to_delete += 1
                    _, file_size, _ = self._get_file_stats_safe(file_path)
                    size_to_free += file_size
                    
        except OSError as e:
            self.log_warning(f"⚠️ Erreur lors de la simulation des orphelins: {e}")
        
        return {'files_to_delete': files_to_delete, 'size_to_free': size_to_free}
    
    def _dry_run_decrypted_files_optimized(self, max_age_hours: int = 1) -> Dict[str, int]:
        """Version optimisée de la simulation pour les fichiers déchiffrés"""
        cutoff_time = self._calculate_cutoff_time(max_age_hours)
        files_to_delete = 0
        size_to_free = 0
        
        search_dirs = ['temp', 'restore_temp', 'uploads']
        
        for dir_name in search_dirs:
            search_dir = self.backup_root / dir_name
            if not search_dir.exists():
                continue
                
            try:
                for file_path in self._limited_rglob(search_dir, max_depth=3):
                    if self._should_delete_file(file_path, cutoff_time, "decrypted"):
                        files_to_delete += 1
                        _, file_size, _ = self._get_file_stats_safe(file_path)
                        size_to_free += file_size
                        
            except OSError as e:
                self.log_warning(f"⚠️ Erreur simulation déchiffrés dans {search_dir}: {e}")
        
        return {'files_to_delete': files_to_delete, 'size_to_free': size_to_free}
    
    def cleanup_restore_temp(self, max_age_hours: int = 24) -> Dict[str, int]:
        """Nettoie les fichiers temporaires de restauration (wrapper de compatibilité)"""
        return self._cleanup_standard_directory('restore_temp', max_age_hours)
    
    def cleanup_temp_files(self, max_age_hours: int = 24) -> Dict[str, int]:
        """Nettoie les fichiers temporaires généraux (wrapper de compatibilité)"""
        return self._cleanup_standard_directory('temp', max_age_hours)
    
    def cleanup_upload_files(self, max_age_hours: int = 2) -> Dict[str, int]:
        """Nettoie les fichiers d'upload (wrapper de compatibilité)"""
        return self._cleanup_standard_directory('uploads', max_age_hours)
    
    def cleanup_decrypted_files(self, max_age_hours: int = 1) -> Dict[str, int]:
        """Nettoie les fichiers déchiffrés temporaires (wrapper de compatibilité)"""
        return self.cleanup_decrypted_files_optimized(max_age_hours)
    
    def get_directory_size(self, directory: Path) -> int:
        """Calcule la taille d'un répertoire de manière optimisée"""
        size, _ = self._get_directory_stats_optimized(directory)
        return size
    
    def count_files_in_directory(self, directory: Path) -> int:
        """Compte les fichiers dans un répertoire de manière optimisée"""
        _, count = self._get_directory_stats_optimized(directory)
        return count
    
    def format_size(self, size_bytes: int) -> str:
        """Formate une taille en bytes en format lisible"""
        if size_bytes == 0:
            return "0 B"
        
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        
        return f"{size_bytes:.1f} PB"
    
    def get_cleanup_stats(self) -> Dict[str, Dict[str, Union[int, str]]]:
        """Obtient les statistiques de l'espace disque et des fichiers temporaires"""
        stats = {}
        
        for subdir in ['restore_temp', 'temp', 'uploads', 'storage']:
            dir_path = self.backup_root / subdir
            if dir_path.exists():
                # Utiliser la méthode optimisée
                size, file_count = self._get_directory_stats_optimized(dir_path)
                stats[subdir] = {
                    'size': size,
                    'size_formatted': self.format_size(size),
                    'file_count': file_count
                }
            else:
                stats[subdir] = {
                    'size': 0,
                    'size_formatted': '0 B',
                    'file_count': 0
                }
        
        return stats
    
    def clear_cache(self):
        """Efface le cache des fichiers référencés"""
        self._referenced_files_cache = None
        self._cache_timestamp = None
        self.log_info("🔄 Cache des fichiers référencés effacé") 