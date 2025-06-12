"""
Service principal de sauvegarde avec architecture hybride
"""

import os
import subprocess
import zipfile
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
from django.conf import settings
from django.utils import timezone
from ..models import BackupConfiguration, BackupHistory
from .base_service import BaseService
from .metadata_service import MetadataService
from .storage_service import StorageService
from .encryption_service import EncryptionService


class BackupService(BaseService):
    """Service principal pour créer les sauvegardes"""
    
    # Constantes
    DATABASE_DUMP_FILENAME = "database.sql"
    
    def __init__(self):
        super().__init__('BackupService')
        self.metadata_service = MetadataService()
        self.storage_service = StorageService()
        self.encryption_service = EncryptionService()
    
    def create_backup(self, config: BackupConfiguration, user, backup_name: Optional[str] = None) -> BackupHistory:
        """
        Crée une sauvegarde complète selon la configuration
        
        Args:
            config: Configuration de sauvegarde
            user: Utilisateur qui lance la sauvegarde
            backup_name: Nom personnalisé (généré automatiquement si None)
            
        Returns:
            Instance BackupHistory créée
        """
        # Création de l'enregistrement d'historique
        if not backup_name:
            backup_name = f"{config.name}_{timezone.now().strftime('%Y%m%d_%H%M%S')}"
        
        backup_history = BackupHistory.objects.create(
            configuration=config,
            backup_name=backup_name,
            backup_type=config.backup_type,
            status='running',
            started_at=timezone.now(),
            created_by=user
        )
        
        self.start_operation(f"Sauvegarde {backup_name}")
        
        try:
            # Création du répertoire de travail
            backup_dir = self._create_backup_directory(backup_name)
            self.log_info(f"📁 Répertoire de sauvegarde: {backup_dir}")
            
            # Statistiques de la sauvegarde
            stats = {
                'tables_count': 0,
                'records_count': 0,
                'files_count': 0,
                'total_size': 0
            }
            
            # Phase 1: Export des métadonnées (Django JSON)
            if config.backup_type in ['full', 'metadata']:
                metadata_stats = self._backup_metadata(backup_dir)
                stats.update(metadata_stats)
            
            # Phase 2: Export des données (SQL natif)
            if config.backup_type in ['full', 'data']:
                data_stats = self._backup_database_data(backup_dir)
                stats['tables_count'] += data_stats.get('tables_count', 0)
                stats['records_count'] += data_stats.get('records_count', 0)
            
            # Phase 3: Sauvegarde des fichiers système
            if config.include_files and config.backup_type in ['full']:
                files_stats = self._backup_files(backup_dir)
                stats['files_count'] = files_stats.get('files_count', 0)
            
            # Phase 4: Création de l'archive finale
            archive_path = self._create_final_archive(backup_dir, backup_name, config.compression_enabled)
            
            # Phase 5: Chiffrement (maintenant OBLIGATOIRE pour toutes les sauvegardes)
            final_path = self._encrypt_backup(archive_path, user)
            archive_path.unlink()  # Suppression de l'archive non chiffrée
            
            # Calcul des métadonnées finales
            final_size = final_path.stat().st_size
            checksum = self.calculate_checksum(final_path)
            
            # Stockage selon la stratégie configurée
            stored_path = self.storage_service.store_backup(final_path, config)
            
            # Suppression du répertoire temporaire
            self._cleanup_temp_directory(backup_dir)
            
            # Nettoyage automatique des fichiers temporaires anciens
            self._auto_cleanup_temp_files()
            
            duration = self.end_operation(f"Sauvegarde {backup_name}")
            
            # Mise à jour finale du statut
            backup_history.status = 'completed'
            backup_history.completed_at = timezone.now()
            backup_history.duration_seconds = duration
            backup_history.file_path = str(stored_path)
            backup_history.file_size = final_size
            backup_history.checksum = checksum
            backup_history.tables_count = stats['tables_count']
            backup_history.records_count = stats['records_count']
            backup_history.files_count = stats['files_count']
            backup_history.log_data = self.get_logs_summary()
            backup_history.save()
            
            # Nettoyage
            self._cleanup_backup_directory(backup_dir)
            if final_path != stored_path and final_path.exists():
                final_path.unlink()  # Suppression du fichier local si stocké ailleurs
            
            self.log_info(f"✅ Sauvegarde terminée avec chiffrement: {final_path}")
            
            return backup_history
            
        except Exception as e:
            # Mise à jour de l'historique en cas d'erreur
            backup_history.status = 'failed'
            backup_history.completed_at = timezone.now()
            backup_history.error_message = str(e)
            backup_history.log_data = self.get_logs_summary()
            backup_history.save()
            
            self.log_error("❌ Échec de la sauvegarde", e)
            raise
    
    def _create_backup_directory(self, backup_name: str) -> Path:
        """Crée le répertoire de travail pour la sauvegarde"""
        backup_dir = self.ensure_backup_directory() / "temp" / backup_name
        backup_dir.mkdir(parents=True, exist_ok=True)
        return backup_dir
    
    def _backup_metadata(self, backup_dir: Path) -> Dict[str, Any]:
        """Sauvegarde les métadonnées avec Django dumpdata"""
        self.log_info("📋 Phase 1: Export des métadonnées")
        
        metadata_file = backup_dir / "metadata.json"
        stats = self.metadata_service.export_metadata(metadata_file)
        
        # Ajout du schéma de la base de données
        schema_file = backup_dir / "schema.json"
        schema = self.metadata_service.get_database_schema()
        self.save_json_file(schema, schema_file)
        
        self.log_info(f"✅ Métadonnées exportées: {stats['records_count']} enregistrements")
        
        return {
            'metadata_records': stats['records_count'],
            'metadata_models': stats['models_count']
        }
    
    def _backup_database_data(self, backup_dir: Path) -> Dict[str, Any]:
        """Sauvegarde les données avec les outils natifs de la DB"""
        self.log_info("🗄️ Phase 2: Export des données SQL")
        
        db_settings = settings.DATABASES['default']
        engine = db_settings['ENGINE']
        
        if 'sqlite3' in engine:
            return self._backup_sqlite(backup_dir, db_settings)
        elif 'postgresql' in engine:
            return self._backup_postgresql(backup_dir, db_settings)
        elif 'mysql' in engine:
            return self._backup_mysql(backup_dir, db_settings)
        else:
            self.log_warning(f"⚠️ Moteur de DB non supporté pour export natif: {engine}")
            return {'tables_count': 0, 'records_count': 0}
    
    def _backup_sqlite(self, backup_dir: Path, db_settings: Dict[str, Any]) -> Dict[str, Any]:
        """Sauvegarde spécifique pour SQLite avec génération d'un dump SQL propre"""
        db_path = Path(db_settings['NAME'])
        if not db_path.exists():
            self.log_warning("⚠️ Base de données SQLite introuvable")
            return {'tables_count': 0, 'records_count': 0}
        
        # Génération d'un dump SQL avec sqlite3 (version propre)
        sql_dump_file = backup_dir / self.DATABASE_DUMP_FILENAME
        
        try:
            # Étape 1: Générer le dump brut
            temp_dump_file = backup_dir / "database_raw.sql"
            cmd = ['sqlite3', str(db_path), '.dump']
            
            with open(temp_dump_file, 'w', encoding='utf-8') as f:
                result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, text=True)
            
            if result.returncode != 0:
                self.log_error(f"❌ Erreur sqlite3 dump: {result.stderr}")
                # Fallback vers la copie directe en cas d'erreur
                return self._backup_sqlite_fallback(backup_dir, db_settings)
            
            # Étape 2: Nettoyer le dump pour la restauration
            self._clean_sqlite_dump(temp_dump_file, sql_dump_file)
            
            # Supprimer le fichier temporaire
            temp_dump_file.unlink()
            
            # Statistiques du dump SQL nettoyé
            sql_file_size = sql_dump_file.stat().st_size
            
            # Analyser le dump pour obtenir des statistiques basiques
            stats = self._analyze_sqlite_dump(sql_dump_file)
            
            self.log_info(f"✅ Base SQLite exportée en SQL propre: {self.format_size(sql_file_size)}")
            self.log_info(f"📊 Tables détectées: {stats['tables_count']}, Statements: {stats['statements_count']}")
            
            return {
                'tables_count': stats['tables_count'],
                'records_count': stats['statements_count'],  # Approximation
                'data_size': sql_file_size
            }
            
        except Exception as e:
            self.log_error(f"❌ Erreur lors du dump SQLite: {str(e)}")
            # Fallback vers la copie directe
            return self._backup_sqlite_fallback(backup_dir, db_settings)
    
    def _clean_sqlite_dump(self, input_file: Path, output_file: Path) -> None:
        """Nettoie un dump SQLite pour le rendre compatible avec la restauration"""
        self.log_info("🧹 Nettoyage du dump SQLite...")
        
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        lines = content.split('\n')
        cleaned_lines = []
        
        # Filtrer les lignes problématiques
        for line in lines:
            line_stripped = line.strip()
            
            # Ignorer les commandes transactionnelles (notre RestoreService les gère)
            if (line_stripped.startswith('BEGIN TRANSACTION') or
                line_stripped.startswith('COMMIT') or
                line_stripped.startswith('PRAGMA foreign_keys=OFF')):
                self.log_debug(f"🚫 Ligne transactionnelle ignorée: {line_stripped[:50]}...")
                continue
            
            # Ignorer les lignes vides
            if not line_stripped:
                continue
            
            # Vérifier les tokens suspects (sessions Django, etc.)
            if self._is_suspicious_token(line_stripped):
                self.log_warning(f"⚠️ Token suspect filtré: {line_stripped[:50]}...")
                continue
            
            # Ajouter la ligne nettoyée
            cleaned_lines.append(line)
        
        # Sauvegarder le contenu nettoyé
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(cleaned_lines))
        
        removed_lines = len(lines) - len(cleaned_lines)
        self.log_info(f"✅ Dump nettoyé: {removed_lines} lignes problématiques supprimées")
    
    def _is_suspicious_token(self, line: str) -> bool:
        """Détecte les tokens suspects dans une ligne SQL"""
        import re
        
        # Patterns suspects
        suspicious_patterns = [
            r'^[a-z0-9]{32,}$',  # Tokens de session (32+ caractères alphanumériques)
            r'.*["\'][a-z0-9]{25,}["\'].*',  # Chaînes avec tokens longs
            r'.*sessionid.*',  # Sessions explicites
            r'.*csrftoken.*',  # Tokens CSRF
        ]
        
        for pattern in suspicious_patterns:
            if re.match(pattern, line.lower()):
                return True
        
        return False
    
    def _backup_sqlite_fallback(self, backup_dir: Path, db_settings: Dict[str, Any]) -> Dict[str, Any]:
        """Méthode de fallback: copie directe du fichier SQLite"""
        self.log_warning("🔄 Utilisation de la méthode de fallback (copie directe)")
        
        db_path = Path(db_settings['NAME'])
        backup_db_path = backup_dir / "database.sqlite3"
        shutil.copy2(db_path, backup_db_path)
        
        # Statistiques approximatives
        file_size = backup_db_path.stat().st_size
        self.log_info(f"✅ Base SQLite copiée (fallback): {self.format_size(file_size)}")
        
        return {
            'tables_count': 1,  # Approximatif
            'records_count': 0,  # Non calculable facilement
            'data_size': file_size
        }
    
    def _analyze_sqlite_dump(self, dump_file: Path) -> Dict[str, Any]:
        """Analyse un dump SQLite pour extraire des statistiques basiques"""
        try:
            with open(dump_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Compter les tables CREATE TABLE
            import re
            tables = re.findall(r'CREATE TABLE ["`]?(\w+)["`]?', content, re.IGNORECASE)
            
            # Compter les statements INSERT
            insert_statements = len(re.findall(r'INSERT INTO', content, re.IGNORECASE))
            
            # Filtrer les tables système SQLite
            user_tables = [t for t in tables if not t.startswith('sqlite_')]
            
            return {
                'tables_count': len(user_tables),
                'statements_count': insert_statements,
                'total_tables': len(tables),
                'user_tables': user_tables
            }
            
        except Exception as e:
            self.log_warning(f"⚠️ Impossible d'analyser le dump SQLite: {e}")
            return {
                'tables_count': 0,
                'statements_count': 0,
                'total_tables': 0,
                'user_tables': []
            }
    
    def _backup_postgresql(self, backup_dir: Path, db_settings: Dict[str, Any]) -> Dict[str, Any]:
        """Sauvegarde spécifique pour PostgreSQL"""
        dump_file = backup_dir / self.DATABASE_DUMP_FILENAME
        
        cmd = [
            'pg_dump',
            f"--host={db_settings.get('HOST', 'localhost')}",
            f"--port={db_settings.get('PORT', 5432)}",
            f"--username={db_settings['USER']}",
            f"--dbname={db_settings['NAME']}",
            '--verbose',
            '--no-password',
            f"--file={dump_file}"
        ]
        
        env = os.environ.copy()
        if db_settings.get('PASSWORD'):
            env['PGPASSWORD'] = db_settings['PASSWORD']
        
        try:
            result = subprocess.run(cmd, env=env, capture_output=True, text=True)
            if result.returncode != 0:
                raise subprocess.CalledProcessError(result.returncode, cmd, result.stderr)
            
            file_size = dump_file.stat().st_size
            self.log_info(f"✅ Base PostgreSQL exportée: {self.format_size(file_size)}")
            
            return {
                'tables_count': 0,  # Calculable en analysant le dump
                'records_count': 0,
                'data_size': file_size
            }
            
        except subprocess.CalledProcessError as e:
            self.log_error(f"❌ Erreur pg_dump: {e.stderr}", e)
            raise
    
    def _backup_mysql(self, backup_dir: Path, db_settings: Dict[str, Any]) -> Dict[str, Any]:
        """Sauvegarde spécifique pour MySQL"""
        dump_file = backup_dir / self.DATABASE_DUMP_FILENAME
        
        cmd = [
            'mysqldump',
            f"--host={db_settings.get('HOST', 'localhost')}",
            f"--port={db_settings.get('PORT', 3306)}",
            f"--user={db_settings['USER']}",
            f"--password={db_settings.get('PASSWORD', '')}",
            '--single-transaction',
            '--routines',
            '--triggers',
            db_settings['NAME']
        ]
        
        try:
            with open(dump_file, 'w') as f:
                result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, text=True)
            
            if result.returncode != 0:
                raise subprocess.CalledProcessError(result.returncode, cmd, result.stderr)
            
            file_size = dump_file.stat().st_size
            self.log_info(f"✅ Base MySQL exportée: {self.format_size(file_size)}")
            
            return {
                'tables_count': 0,
                'records_count': 0,
                'data_size': file_size
            }
            
        except subprocess.CalledProcessError as e:
            self.log_error(f"❌ Erreur mysqldump: {e.stderr}", e)
            raise
    
    def _backup_files(self, backup_dir: Path) -> Dict[str, Any]:
        """Sauvegarde les fichiers système (media, logs, etc.)"""
        self.log_info("📁 Phase 3: Sauvegarde des fichiers")
        
        files_dir = backup_dir / "files"
        files_dir.mkdir(exist_ok=True)
        
        files_count = 0
        
        # Fichiers media si configurés
        if hasattr(settings, 'MEDIA_ROOT') and settings.MEDIA_ROOT:
            media_source = Path(settings.MEDIA_ROOT)
            if media_source.exists():
                media_dest = files_dir / "media"
                shutil.copytree(media_source, media_dest, dirs_exist_ok=True)
                files_count += sum(1 for _ in media_dest.rglob('*') if _.is_file())
                self.log_info(f"📷 Fichiers media copiés vers {media_dest}")
        
        # Logs si le répertoire existe
        logs_source = Path('logs')
        if logs_source.exists():
            logs_dest = files_dir / "logs"
            shutil.copytree(logs_source, logs_dest, dirs_exist_ok=True)
            files_count += sum(1 for _ in logs_dest.rglob('*') if _.is_file())
            self.log_info(f"📋 Logs copiés vers {logs_dest}")
        
        self.log_info(f"✅ {files_count} fichiers sauvegardés")
        
        return {'files_count': files_count}
    
    def _create_final_archive(self, backup_dir: Path, backup_name: str, compression: bool) -> Path:
        """Crée l'archive finale de la sauvegarde"""
        self.log_info("📦 Phase 4: Création de l'archive")
        
        archive_name = f"{backup_name}.zip"
        archive_path = backup_dir.parent / archive_name
        
        compression_type = zipfile.ZIP_DEFLATED if compression else zipfile.ZIP_STORED
        
        with zipfile.ZipFile(archive_path, 'w', compression_type) as archive:
            for file_path in backup_dir.rglob('*'):
                if file_path.is_file():
                    arc_name = file_path.relative_to(backup_dir)
                    archive.write(file_path, arc_name)
        
        file_size = archive_path.stat().st_size
        self.log_info(f"✅ Archive créée: {self.format_size(file_size)}")
        
        return archive_path
    
    def _encrypt_backup(self, archive_path: Path, user) -> Path:
        """Chiffre la sauvegarde avec clé système transparente"""
        self.log_info("🔐 Phase 5: Chiffrement automatique")
        
        encrypted_path = archive_path.with_suffix('.encrypted')
        
        # Générer la clé système transparente
        encryption_key = self.encryption_service.generate_system_key(user)
        
        self.encryption_service.encrypt_file_with_key(archive_path, encrypted_path, encryption_key)
        
        self.log_info(f"🔒 Sauvegarde chiffrée automatiquement: {encrypted_path}")
        
        return encrypted_path
    
    def _cleanup_backup_directory(self, backup_dir: Path) -> None:
        """Nettoie le répertoire temporaire de sauvegarde"""
        try:
            shutil.rmtree(backup_dir)
            self.log_info(f"🧹 Répertoire temporaire nettoyé: {backup_dir}")
        except Exception as e:
            self.log_warning(f"⚠️ Impossible de nettoyer {backup_dir}: {e}")
    
    def list_backups(self, config: Optional[BackupConfiguration] = None) -> List[BackupHistory]:
        """Liste les sauvegardes disponibles"""
        queryset = BackupHistory.objects.all()
        if config:
            queryset = queryset.filter(configuration=config)
        return queryset.order_by('-created_at')
    
    def delete_backup(self, backup: BackupHistory) -> bool:
        """Supprime une sauvegarde et ses fichiers"""
        try:
            # Suppression du fichier physique
            if backup.file_path and Path(backup.file_path).exists():
                Path(backup.file_path).unlink()
                self.log_info(f"🗑️ Fichier supprimé: {backup.file_path}")
            
            # Suppression de l'enregistrement
            backup.delete()
            self.log_info(f"✅ Sauvegarde supprimée: {backup.backup_name}")
            
            return True
            
        except Exception as e:
            self.log_error(f"❌ Erreur lors de la suppression: {backup.backup_name}", e)
            return False
    
    def _auto_cleanup_temp_files(self):
        """Nettoyage automatique des fichiers temporaires anciens"""
        try:
            from .cleanup_service import CleanupService
            
            cleanup_service = CleanupService()
            # Nettoyer les fichiers de plus de 4h automatiquement (moins agressif pour les sauvegardes)
            results = cleanup_service.cleanup_all_temporary_files(max_age_hours=4)
            
            # Log seulement si quelque chose a été nettoyé
            if results['totals']['files_deleted'] > 0:
                self.log_info(
                    f"🧹 Nettoyage automatique: "
                    f"{results['totals']['files_deleted']} fichiers temporaires supprimés, "
                    f"{cleanup_service.format_size(results['totals']['size_freed'])} libérés"
                )
        except Exception as e:
            # Ne pas faire échouer la sauvegarde si le nettoyage échoue
            self.log_warning(f"⚠️ Nettoyage automatique échoué: {e}")
    
    def _cleanup_temp_directory(self, temp_dir: Path):
        """Nettoie le répertoire temporaire de sauvegarde"""
        try:
            if temp_dir.exists():
                shutil.rmtree(temp_dir)
                self.log_info(f"🗑️ Répertoire temporaire nettoyé: {temp_dir}")
        except Exception as e:
            self.log_warning(f"⚠️ Impossible de nettoyer le répertoire {temp_dir}: {e}") 