"""
Service de stockage pour les sauvegardes
"""

import shutil
import os
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from .base_service import BaseService


class StorageService(BaseService):
    """Service pour gérer le stockage des sauvegardes"""
    
    def __init__(self):
        super().__init__('StorageService')
        self.local_storage_path = self._get_local_storage_path()
    
    def store_backup(self, backup_file: Path, config) -> Path:
        """
        Stocke une sauvegarde selon la configuration
        
        Args:
            backup_file: Fichier de sauvegarde à stocker
            config: Configuration de sauvegarde
            
        Returns:
            Chemin final de stockage
        """
        # Pour l'instant, stockage local uniquement
        # TODO: Ajouter le support cloud (AWS S3, Google Cloud, etc.)
        return self._store_locally(backup_file, config)
    
    def _store_locally(self, backup_file: Path, config) -> Path:
        """Stocke la sauvegarde localement"""
        self.log_info(f"💾 Stockage local de {backup_file.name}")
        
        # Création du répertoire de destination
        dest_dir = self.local_storage_path / config.name
        dest_dir.mkdir(parents=True, exist_ok=True)
        
        # Chemin de destination final
        dest_path = dest_dir / backup_file.name
        
        # Copie du fichier
        shutil.move(str(backup_file), str(dest_path))
        
        self.log_info(f"✅ Sauvegarde stockée: {dest_path}")
        
        return dest_path
    
    def _get_local_storage_path(self) -> Path:
        """Obtient le chemin de stockage local"""
        storage_path = Path(getattr(settings, 'BACKUP_STORAGE_PATH', 'backups/storage'))
        storage_path.mkdir(parents=True, exist_ok=True)
        return storage_path
    
    def get_backup_file(self, backup_path: str) -> Optional[Path]:
        """Récupère un fichier de sauvegarde"""
        file_path = Path(backup_path)
        if file_path.exists():
            return file_path
        return None
    
    def calculate_storage_usage(self) -> Dict[str, Any]:
        """Calcule l'utilisation de l'espace de stockage"""
        if not self.local_storage_path.exists():
            return {
                'total_size': 0,
                'file_count': 0,
                'formatted_size': '0 B'
            }
        
        total_size = 0
        file_count = 0
        
        for file_path in self.local_storage_path.rglob('*'):
            if file_path.is_file():
                total_size += file_path.stat().st_size
                file_count += 1
        
        return {
            'total_size': total_size,
            'file_count': file_count,
            'formatted_size': self.format_size(total_size)
        }
    
    def get_storage_stats(self) -> Dict[str, Any]:
        """
        Récupère les statistiques complètes de stockage
        
        Returns:
            Dictionnaire avec les statistiques de stockage
        """
        self.start_operation("Calcul des statistiques de stockage")
        
        try:
            # Statistiques d'utilisation
            usage_stats = self.calculate_storage_usage()
            
            # Statistiques d'espace disque disponible
            disk_stats = self._get_disk_usage()
            
            # Statistiques par configuration/dossier
            config_stats = self._get_storage_by_config()
            
            # Âge des sauvegardes
            age_stats = self._get_backup_age_stats()
            
            # Statistiques des fichiers temporaires
            temp_stats = self._get_temp_files_stats()
            
            stats = {
                'storage_usage': usage_stats,
                'disk_space': disk_stats,
                'by_configuration': config_stats,
                'backup_ages': age_stats,
                'temp_files': temp_stats,
                'storage_path': str(self.local_storage_path),
                'timestamp': timezone.now().isoformat()
            }
            
            self.log_info(f"✅ Statistiques calculées: {usage_stats['file_count']} fichiers, {usage_stats['formatted_size']}")
            duration = self.end_operation("Calcul des statistiques de stockage")
            stats['calculation_duration'] = duration
            
            return stats
            
        except Exception as e:
            self.log_error("❌ Erreur lors du calcul des statistiques", e)
            raise
    
    def _get_disk_usage(self) -> Dict[str, Any]:
        """Récupère les statistiques d'utilisation du disque"""
        try:
            if self.local_storage_path.exists():
                disk_usage = shutil.disk_usage(self.local_storage_path)
                
                return {
                    'total': disk_usage.total,
                    'used': disk_usage.used,
                    'free': disk_usage.free,
                    'total_formatted': self.format_size(disk_usage.total),
                    'used_formatted': self.format_size(disk_usage.used),
                    'free_formatted': self.format_size(disk_usage.free),
                    'usage_percent': round((disk_usage.used / disk_usage.total) * 100, 2) if disk_usage.total > 0 else 0
                }
            else:
                return {
                    'total': 0,
                    'used': 0,
                    'free': 0,
                    'total_formatted': '0 B',
                    'used_formatted': '0 B',
                    'free_formatted': '0 B',
                    'usage_percent': 0
                }
        except Exception as e:
            self.log_warning(f"⚠️ Impossible de récupérer l'usage disque: {str(e)}")
            return {
                'total': 0,
                'used': 0,
                'free': 0,
                'total_formatted': 'N/A',
                'used_formatted': 'N/A',
                'free_formatted': 'N/A',
                'usage_percent': 0
            }
    
    def _get_storage_by_config(self) -> Dict[str, Any]:
        """Récupère les statistiques de stockage par configuration"""
        config_stats = {}
        
        if not self.local_storage_path.exists():
            return config_stats
        
        for config_dir in self.local_storage_path.iterdir():
            if config_dir.is_dir():
                config_name = config_dir.name
                config_size = 0
                config_files = 0
                
                for file_path in config_dir.rglob('*'):
                    if file_path.is_file():
                        config_size += file_path.stat().st_size
                        config_files += 1
                
                config_stats[config_name] = {
                    'size': config_size,
                    'files': config_files,
                    'formatted_size': self.format_size(config_size)
                }
        
        return config_stats
    
    def _get_backup_age_stats(self) -> Dict[str, Any]:
        """Récupère les statistiques d'âge des sauvegardes"""
        if not self.local_storage_path.exists():
            return {
                'oldest_backup': None,
                'newest_backup': None,
                'by_age_range': {
                    '< 1 jour': 0,
                    '1-7 jours': 0,
                    '1-4 semaines': 0,
                    '> 1 mois': 0
                }
            }
        
        oldest_time = None
        newest_time = None
        age_ranges = {
            '< 1 jour': 0,
            '1-7 jours': 0,
            '1-4 semaines': 0,
            '> 1 mois': 0
        }
        
        now = datetime.now()
        
        for file_path in self.local_storage_path.rglob('*'):
            if file_path.is_file():
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                
                if oldest_time is None or mtime < oldest_time:
                    oldest_time = mtime
                if newest_time is None or mtime > newest_time:
                    newest_time = mtime
                
                # Calcul de l'âge
                age = now - mtime
                
                if age.days < 1:
                    age_ranges['< 1 jour'] += 1
                elif age.days <= 7:
                    age_ranges['1-7 jours'] += 1
                elif age.days <= 28:
                    age_ranges['1-4 semaines'] += 1
                else:
                    age_ranges['> 1 mois'] += 1
        
        return {
            'oldest_backup': oldest_time.isoformat() if oldest_time else None,
            'newest_backup': newest_time.isoformat() if newest_time else None,
            'by_age_range': age_ranges
        }
    
    def cleanup_old_backups(self, retention_days: int = None) -> int:
        """
        Nettoie les anciennes sauvegardes selon les règles de rétention
        
        Args:
            retention_days: Nombre de jours de rétention (défaut: 30)
            
        Returns:
            Nombre de sauvegardes supprimées
        """
        if retention_days is None:
            retention_days = getattr(settings, 'BACKUP_RETENTION_DAYS', 30)
        
        self.start_operation(f"Nettoyage des sauvegardes (rétention: {retention_days} jours)")
        
        cutoff_date = timezone.now() - timedelta(days=retention_days)
        cleaned_count = 0
        cleaned_size = 0
        
        try:
            if not self.local_storage_path.exists():
                self.log_info("📁 Aucun répertoire de stockage trouvé")
                return 0
            
            for file_path in self.local_storage_path.rglob('*'):
                if file_path.is_file():
                    # Vérifier l'âge du fichier
                    file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                    file_mtime = timezone.make_aware(file_mtime) if timezone.is_naive(file_mtime) else file_mtime
                    
                    if file_mtime < cutoff_date:
                        file_size = file_path.stat().st_size
                        try:
                            file_path.unlink()
                            cleaned_count += 1
                            cleaned_size += file_size
                            self.log_info(f"🗑️ Supprimé: {file_path.name} ({self.format_size(file_size)})")
                        except Exception as e:
                            self.log_warning(f"⚠️ Impossible de supprimer {file_path.name}: {str(e)}")
            
            # Nettoyage des répertoires vides
            for config_dir in self.local_storage_path.iterdir():
                if config_dir.is_dir():
                    try:
                        if not any(config_dir.iterdir()):  # Répertoire vide
                            config_dir.rmdir()
                            self.log_info(f"📁 Répertoire vide supprimé: {config_dir.name}")
                    except Exception as e:
                        self.log_warning(f"⚠️ Impossible de supprimer le répertoire {config_dir.name}: {str(e)}")
            
            duration = self.end_operation("Nettoyage des sauvegardes")
            self.log_info(f"✅ Nettoyage terminé: {cleaned_count} fichiers supprimés ({self.format_size(cleaned_size)}) en {duration}s")
            
            return cleaned_count
            
        except Exception as e:
            self.log_error("❌ Erreur lors du nettoyage", e)
            raise
    
    def _get_temp_files_stats(self) -> Dict[str, Any]:
        """Récupère les statistiques des fichiers temporaires"""
        from .cleanup_service import CleanupService
        
        try:
            cleanup_service = CleanupService()
            temp_stats = cleanup_service.get_cleanup_stats()
            
            # Calculer les totaux des fichiers temporaires (hors storage)
            temp_dirs = ['restore_temp', 'temp', 'uploads']
            total_temp_size = sum(temp_stats.get(dir_name, {}).get('size', 0) for dir_name in temp_dirs)
            total_temp_files = sum(temp_stats.get(dir_name, {}).get('file_count', 0) for dir_name in temp_dirs)
            
            # Format de retour compatible avec le frontend
            return {
                'size': total_temp_size,
                'size_formatted': self.format_size(total_temp_size),
                'file_count': total_temp_files,
                'breakdown': temp_stats
            }
            
        except Exception as e:
            self.log_warning(f"⚠️ Impossible de récupérer les stats de fichiers temporaires: {e}")
            return {
                'size': 0,
                'size_formatted': '0 B',
                'file_count': 0,
                'breakdown': {}
            } 