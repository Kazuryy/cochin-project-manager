"""
Service de base pour tous les services de backup
"""

import logging
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from django.conf import settings
from django.utils import timezone


class BaseService:
    """Classe de base pour tous les services de backup"""
    
    def __init__(self, logger_name: str = None):
        self.logger = logging.getLogger(logger_name or self.__class__.__name__)
        self.start_time: Optional[datetime] = None
        self.logs: List[Dict[str, Any]] = []
    
    def start_operation(self, operation_name: str) -> None:
        """Démarre une opération et initialise le suivi"""
        self.start_time = timezone.now()
        self.logs = []
        self.log_info(f"🚀 Début de l'opération: {operation_name}")
    
    def end_operation(self, operation_name: str) -> int:
        """Termine une opération et retourne la durée en secondes"""
        if self.start_time:
            duration = (timezone.now() - self.start_time).total_seconds()
            self.log_info(f"✅ Fin de l'opération: {operation_name} ({duration:.2f}s)")
            return int(duration)
        return 0
    
    def log_info(self, message: str, **extra_data) -> None:
        """Log d'information avec stockage pour historique"""
        self.logger.info(message)
        self._add_log_entry('info', message, extra_data)
    
    def log_warning(self, message: str, **extra_data) -> None:
        """Log d'avertissement avec stockage pour historique"""
        self.logger.warning(message)
        self._add_log_entry('warning', message, extra_data)
    
    def log_debug(self, message: str, **extra_data) -> None:
        """Log de debug avec stockage pour historique"""
        self.logger.debug(message)
        self._add_log_entry('debug', message, extra_data)
    
    def log_error(self, message: str, exception: Exception = None, **extra_data) -> None:
        """Log d'erreur avec stockage pour historique"""
        self.logger.error(message, exc_info=exception is not None)
        extra_data['exception'] = str(exception) if exception else None
        self._add_log_entry('error', message, extra_data)
    
    def _add_log_entry(self, level: str, message: str, extra_data: Dict[str, Any]) -> None:
        """Ajoute une entrée au log interne"""
        self.logs.append({
            'timestamp': timezone.now().isoformat(),
            'level': level,
            'message': message,
            'extra_data': extra_data
        })
    
    def get_logs_summary(self) -> Dict[str, Any]:
        """Retourne un résumé des logs de l'opération"""
        return {
            'total_entries': len(self.logs),
            'info_count': len([log for log in self.logs if log['level'] == 'info']),
            'warning_count': len([log for log in self.logs if log['level'] == 'warning']),
            'debug_count': len([log for log in self.logs if log['level'] == 'debug']),
            'error_count': len([log for log in self.logs if log['level'] == 'error']),
            'logs': self.logs
        }
    
    @staticmethod
    def calculate_checksum(file_path: Path) -> str:
        """Calcule le checksum SHA-256 d'un fichier"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    
    @staticmethod
    def format_size(size_bytes: int) -> str:
        """Formate une taille en bytes en format lisible"""
        if size_bytes == 0:
            return "0 B"
        size_names = ["B", "KB", "MB", "GB", "TB"]
        import math
        i = int(math.floor(math.log(size_bytes, 1024)))
        p = math.pow(1024, i)
        s = round(size_bytes / p, 2)
        return f"{s} {size_names[i]}"
    
    @staticmethod
    def ensure_backup_directory() -> Path:
        """S'assure que le répertoire de sauvegarde existe"""
        backup_dir = Path(getattr(settings, 'BACKUP_ROOT', 'backups'))
        backup_dir.mkdir(parents=True, exist_ok=True)
        return backup_dir
    
    def save_json_file(self, data: Dict[str, Any], file_path: Path, indent: int = 2) -> None:
        """Sauvegarde des données JSON dans un fichier"""
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=indent, ensure_ascii=False, default=str)
            self.log_info(f"📄 Fichier JSON sauvegardé: {file_path}")
        except Exception as e:
            self.log_error(f"❌ Erreur lors de la sauvegarde JSON: {file_path}", e)
            raise
    
    def load_json_file(self, file_path: Path) -> Dict[str, Any]:
        """Charge des données JSON depuis un fichier"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.log_info(f"📖 Fichier JSON chargé: {file_path}")
            return data
        except Exception as e:
            self.log_error(f"❌ Erreur lors du chargement JSON: {file_path}", e)
            raise 