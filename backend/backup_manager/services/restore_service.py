"""
Service de restauration pour les sauvegardes
"""

import zipfile
import tempfile
import subprocess
import shutil
import re
import sqlite3
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from django.conf import settings
from django.utils import timezone
from ..models import BackupHistory, RestoreHistory
from .base_service import BaseService
from .metadata_service import MetadataService
from .storage_service import StorageService
from .encryption_service import EncryptionService


class RestoreError(Exception):
    """Exception spécifique pour les erreurs de restauration"""
    pass


class DatabaseRestoreError(RestoreError):
    """Exception spécifique pour les erreurs de restauration de base de données"""
    pass


class FileRestoreError(RestoreError):
    """Exception spécifique pour les erreurs de restauration de fichiers"""
    pass


class RestoreService(BaseService):
    """Service pour restaurer les sauvegardes"""
    
    # Constantes
    DATABASE_DUMP_FILENAME = "database.sql"
    DATABASE_SQLITE_FILENAME = "database.sqlite3"
    METADATA_FILENAME = "metadata.json"
    FILES_DIRNAME = "files"
    
    AUTO_CLEANUP_MAX_AGE_HOURS = 2
    MAX_SQL_RETRIES = 3
    
    # Valeurs par défaut pour corrections NOT NULL
    DEFAULT_NOT_NULL_VALUES = {
        'encryption_enabled': 'TRUE',
        'compression_enabled': 'TRUE', 
        'encryption_algorithm': "'AES256'",
        'compression_level': '6',
        'created_at': "datetime('now')",
        'updated_at': "datetime('now')",
    }
    
    def __init__(self):
        super().__init__('RestoreService')
        self.metadata_service = MetadataService()
        self.storage_service = StorageService()
        self.encryption_service = EncryptionService()
    
    def restore_backup(self, backup: BackupHistory, user, restore_options: Optional[Dict[str, Any]] = None) -> RestoreHistory:
        """
        Restaure une sauvegarde
        
        Args:
            backup: Sauvegarde à restaurer
            user: Utilisateur qui lance la restauration
            restore_options: Options de restauration
            
        Returns:
            Instance RestoreHistory créée
        """
        restore_options = restore_options or {}
        restore_history = self._create_restore_history(backup, user, restore_options)
        
        try:
            self._execute_restore_workflow(backup, user, restore_options, restore_history)
            return restore_history
            
        except Exception as e:
            self._handle_restore_failure(restore_history, e)
            raise
    
    def _create_restore_history(self, backup: BackupHistory, user, restore_options: Dict[str, Any]) -> RestoreHistory:
        """Crée l'enregistrement d'historique de restauration"""
        restore_name = f"Restauration_{backup.backup_name}_{timezone.now().strftime('%Y%m%d_%H%M%S')}"
        restore_type = restore_options.get('restore_type', 'full')
        
        return RestoreHistory.objects.create(
            backup_source=backup,
            restore_name=restore_name,
            restore_type=restore_type,
            status='running',
            restore_options=restore_options,
            started_at=timezone.now(),
            created_by=user
        )
    
    def _execute_restore_workflow(self, backup: BackupHistory, user, restore_options: Dict[str, Any], restore_history: RestoreHistory) -> None:
        """Exécute le workflow complet de restauration"""
        self.start_operation(f"Restauration {restore_history.restore_name}")
        
        # Préparation des fichiers
        work_dir, extract_dir = self._prepare_restore_files(backup, user, restore_history.restore_name)
        
        try:
            # Exécution des phases de restauration
            stats = self._execute_restore_phases(extract_dir, restore_options, restore_history)
            
            # Finalisation
            self._finalize_restore(restore_history, stats)
            
            # Nettoyage
            self._cleanup_after_restore(work_dir)
            
        except Exception:
            self._cleanup_after_restore(work_dir)
            raise
    
    def _prepare_restore_files(self, backup: BackupHistory, user, restore_name: str) -> Tuple[Path, Path]:
        """Prépare les fichiers nécessaires à la restauration"""
        # Récupération du fichier de sauvegarde
        backup_file = self.storage_service.get_backup_file(backup.file_path)
        if not backup_file:
            raise FileNotFoundError(f"Fichier de sauvegarde introuvable: {backup.file_path}")
        
        # Création du répertoire de travail
        work_dir = self._create_restore_directory(restore_name)
        self.log_info(f"📁 Répertoire de restauration: {work_dir}")
        
        # Déchiffrement automatique si nécessaire
        source_file = self._handle_decryption_if_needed(backup_file, work_dir, user)
        
        # Extraction de l'archive
        extract_dir = self._extract_backup_archive(source_file, work_dir)
        
        return work_dir, extract_dir
    
    def _handle_decryption_if_needed(self, backup_file: Path, work_dir: Path, user) -> Path:
        """Gère le déchiffrement du fichier si nécessaire"""
        if backup_file.suffix != '.encrypted':
            return backup_file
        
        decrypted_file = work_dir / "backup_decrypted.zip"
        system_key = self.encryption_service.generate_system_key(user)
        self.encryption_service.decrypt_file_with_key(backup_file, decrypted_file, system_key)
        self.log_info("🔓 Fichier déchiffré automatiquement avec la clé système")
        
        return decrypted_file
    
    def _execute_restore_phases(self, extract_dir: Path, restore_options: Dict[str, Any], restore_history: RestoreHistory) -> Dict[str, Any]:
        """Exécute les différentes phases de restauration"""
        restore_type = restore_options.get('restore_type', 'full')
        stats = {
            'tables_restored': 0,
            'records_restored': 0,
            'files_restored': 0
        }
        
        # Phase 1: Restauration des métadonnées
        if restore_type in ['full', 'metadata'] and (extract_dir / self.METADATA_FILENAME).exists():
            metadata_stats = self._restore_metadata(extract_dir, restore_options)
            stats.update(metadata_stats)
        
        # Phase 2: Restauration des données SQL
        if restore_type in ['full', 'data']:
            data_stats = self._restore_database_data(extract_dir, restore_options)
            stats.update(data_stats)
            
            # Gestion spéciale si la base a été remplacée
            if data_stats.get('database_replaced', False):
                restore_history = self._handle_database_replacement(restore_history, restore_options)
        
        # Phase 3: Restauration des fichiers
        if restore_type == 'full' and (extract_dir / self.FILES_DIRNAME).exists():
            files_stats = self._restore_files(extract_dir, restore_options)
            stats['files_restored'] = files_stats.get('files_restored', 0)
        
        return stats
    
    def _handle_database_replacement(self, restore_history: RestoreHistory, restore_options: Dict[str, Any]) -> RestoreHistory:
        """Gère le cas où la base de données a été complètement remplacée"""
        self.log_warning("🔄 Base de données remplacée - Gestion spéciale du RestoreHistory")
        
        # Sauvegarder les données de l'ancien historique
        old_restore_history = restore_history
        original_backup = restore_history.backup_source
        
        # Créer un nouveau BackupHistory dans la nouvelle base
        new_backup = self._create_compatible_backup_history(original_backup, restore_history.created_by)
        
        # Créer un nouveau RestoreHistory avec le nouveau BackupHistory
        new_restore_history = self._create_compatible_restore_history(
            old_restore_history, new_backup, restore_options
        )
        
        # Nettoyer l'ancien restore_history
        self._cleanup_old_restore_history(old_restore_history)
        
        return new_restore_history
    
    def _create_compatible_backup_history(self, original_backup: BackupHistory, user) -> BackupHistory:
        """Crée un BackupHistory compatible avec la nouvelle base"""
        new_backup = BackupHistory.objects.create(
            backup_name=f"Restauré_{original_backup.backup_name}",
            status='completed',
            backup_type=original_backup.backup_type,
            file_path=original_backup.file_path,
            file_size=original_backup.file_size,
            checksum=original_backup.checksum,
            started_at=original_backup.started_at,
            completed_at=original_backup.completed_at,
            duration_seconds=original_backup.duration_seconds,
            created_by=user
        )
        
        self.log_info(f"🔄 Nouveau BackupHistory créé: ID {new_backup.id}")
        return new_backup
    
    def _create_compatible_restore_history(self, old_restore_history: RestoreHistory, new_backup: BackupHistory, restore_options: Dict[str, Any]) -> RestoreHistory:
        """Crée un RestoreHistory compatible avec la nouvelle base"""
        new_restore_history = RestoreHistory.objects.create(
            backup_source=new_backup,
            restore_name=f"{old_restore_history.restore_name}_db_replaced",
            restore_type=old_restore_history.restore_type,
            status='running',
            restore_options=restore_options,
            started_at=old_restore_history.started_at,
            created_by=old_restore_history.created_by
        )
        
        self.log_info(f"🔄 Nouveau RestoreHistory créé: ID {new_restore_history.id}")
        return new_restore_history
    
    def _cleanup_old_restore_history(self, old_restore_history: RestoreHistory) -> None:
        """Nettoie l'ancien restore_history"""
        try:
            old_restore_history.delete()
            self.log_info("🗑️ Ancien RestoreHistory supprimé")
        except Exception as e:
            self.log_warning(f"⚠️ Impossible de supprimer l'ancien RestoreHistory: {e}")
    
    def _finalize_restore(self, restore_history: RestoreHistory, stats: Dict[str, Any]) -> None:
        """Finalise la restauration en mettant à jour l'historique"""
        duration = self.end_operation(f"Restauration {restore_history.restore_name}")
        
        restore_history.status = 'completed'
        restore_history.completed_at = timezone.now()
        restore_history.duration_seconds = duration
        restore_history.tables_restored = stats['tables_restored']
        restore_history.records_restored = stats['records_restored']
        restore_history.files_restored = stats['files_restored']
        restore_history.log_data = self.get_logs_summary()
        restore_history.save()
        
        self.log_info(f"✅ Restauration terminée en {duration}s")
    
    def _handle_restore_failure(self, restore_history: RestoreHistory, error: Exception) -> None:
        """Gère l'échec de la restauration"""
        restore_history.status = 'failed'
        restore_history.completed_at = timezone.now()
        restore_history.error_message = str(error)
        restore_history.log_data = self.get_logs_summary()
        restore_history.save()
        
        self.log_error("❌ Échec de la restauration", error)
    
    def _cleanup_after_restore(self, work_dir: Path) -> None:
        """Effectue le nettoyage après la restauration"""
        self._cleanup_restore_directory(work_dir)
        self._auto_cleanup_temp_files()
    
    def _create_restore_directory(self, restore_name: str) -> Path:
        """Crée le répertoire de travail pour la restauration"""
        restore_dir = self.ensure_backup_directory() / "restore_temp" / restore_name
        restore_dir.mkdir(parents=True, exist_ok=True)
        return restore_dir
    
    def _extract_backup_archive(self, archive_path: Path, work_dir: Path) -> Path:
        """Extrait l'archive de sauvegarde"""
        self.log_info("📦 Extraction de l'archive")
        
        extract_dir = work_dir / "extracted"
        extract_dir.mkdir(exist_ok=True)
        
        try:
            with zipfile.ZipFile(archive_path, 'r') as archive:
                archive.extractall(extract_dir)
            
            self.log_info(f"✅ Archive extraite: {extract_dir}")
            return extract_dir
            
        except zipfile.BadZipFile as e:
            raise FileRestoreError(f"Archive corrompue: {e}")
        except Exception as e:
            raise FileRestoreError(f"Erreur lors de l'extraction: {e}")
    
    def _restore_metadata(self, extract_dir: Path, restore_options: Dict[str, Any]) -> Dict[str, Any]:
        """Restaure les métadonnées Django"""
        self.log_info("📋 Phase 1: Restauration des métadonnées")
        
        metadata_file = extract_dir / self.METADATA_FILENAME
        if not metadata_file.exists():
            self.log_warning("⚠️ Fichier de métadonnées introuvable")
            return {'records_restored': 0, 'tables_restored': 0, 'metadata_restored': 0}
        
        # Options de restauration des métadonnées
        metadata_options = {
            'flush_before': restore_options.get('flush_metadata', False),
            'ignore_duplicates': restore_options.get('ignore_duplicates', True)
        }
        
        try:
            stats = self.metadata_service.import_metadata(metadata_file, metadata_options)
            
            if stats.get('success', True):
                self.log_info(f"✅ Métadonnées restaurées: {stats['records_imported']} enregistrements")
                return {
                    'records_restored': stats['records_imported'],
                    'tables_restored': stats['models_imported'],
                    'metadata_restored': stats['records_imported']
                }
            else:
                error_msg = stats.get('error', 'Erreur inconnue')
                self.log_warning(f"⚠️ Import des métadonnées échoué: {error_msg}")
                
                return {
                    'records_restored': 0,
                    'tables_restored': 0, 
                    'metadata_restored': 0,
                    'metadata_error': error_msg
                }
        
        except Exception as e:
            self.log_warning(f"⚠️ Erreur lors de la restauration des métadonnées: {str(e)}")
            self.log_info("📝 Poursuite de la restauration sans les métadonnées")
            
            return {
                'records_restored': 0,
                'tables_restored': 0,
                'metadata_restored': 0,
                'metadata_error': str(e)
            }
    
    def _restore_database_data(self, extract_dir: Path, restore_options: Dict[str, Any]) -> Dict[str, Any]:
        """Restaure les données de la base de données"""
        self.log_info("🗄️ Phase 2: Restauration des données SQL")
        
        db_settings = settings.DATABASES['default']
        engine = db_settings['ENGINE']
        
        try:
            if 'sqlite3' in engine:
                return self._restore_sqlite(extract_dir, db_settings, restore_options)
            elif 'postgresql' in engine:
                return self._restore_postgresql(extract_dir, db_settings, restore_options)
            elif 'mysql' in engine:
                return self._restore_mysql(extract_dir, db_settings, restore_options)
            else:
                self.log_warning(f"⚠️ Moteur de DB non supporté pour restauration: {engine}")
                return {'data_restored': 0}
                
        except Exception as e:
            raise DatabaseRestoreError(f"Erreur lors de la restauration de la base {engine}: {e}")
    
    def _restore_sqlite(self, extract_dir: Path, db_settings: Dict[str, Any], restore_options: Dict[str, Any]) -> Dict[str, Any]:
        """Restauration spécifique pour SQLite avec gestion sécurisée des contraintes"""
        # Vérifier la disponibilité du fichier SQL de données
        backup_sql_file = extract_dir / self.DATABASE_DUMP_FILENAME
        backup_db_file = extract_dir / self.DATABASE_SQLITE_FILENAME
        
        # Prioriser le fichier SQL s'il existe (plus sûr pour la restauration)
        if backup_sql_file.exists():
            return self._restore_sqlite_from_sql(backup_sql_file, db_settings, restore_options)
        elif backup_db_file.exists():
            return self._restore_sqlite_from_db(backup_db_file, db_settings, restore_options)
        else:
            self.log_warning("⚠️ Aucun fichier SQLite de sauvegarde trouvé")
            return {'data_restored': 0}
    
    def _restore_sqlite_from_sql(self, sql_file: Path, db_settings: Dict[str, Any], restore_options: Dict[str, Any]) -> Dict[str, Any]:
        """Restauration SQLite sécurisée depuis un fichier SQL avec gestion avancée des contraintes FK"""
        current_db_path = Path(db_settings['NAME'])
        
        try:
            # Connexion à la base de données actuelle
            conn = sqlite3.connect(str(current_db_path))
            cursor = conn.cursor()
            
            # Diagnostic et préparation
            fk_enabled = self._prepare_sqlite_restore(cursor)
            
            # Exécuter la restauration dans une transaction
            stats = self._execute_sqlite_restore_transaction(cursor, sql_file, restore_options, fk_enabled)
            
            conn.close()
            
            self._log_sqlite_restore_summary(stats)
            
            return {
                'data_restored': stats['executed_statements'],
                'total_statements': stats['total_statements'],
                'failed_statements': stats['failed_statements'],
                'fk_violations': stats['fk_violations'],
                'success_rate': stats['success_rate']
            }
            
        except Exception as e:
            # En cas d'erreur, nettoyer et relancer
            self._cleanup_sqlite_connection(cursor, conn, fk_enabled)
            raise DatabaseRestoreError(f"Erreur lors de la restauration SQLite: {str(e)}")
    
    def _prepare_sqlite_restore(self, cursor) -> bool:
        """Prépare la base SQLite pour la restauration"""
        self.log_info("🔍 Analyse du fichier SQL et préparation...")
        
        # Vérifier l'intégrité avant restauration
        cursor.execute("PRAGMA integrity_check")
        initial_integrity = cursor.fetchone()[0]
        self.log_info(f"📋 Intégrité initiale: {initial_integrity}")
        
        # Sauvegarder l'état des contraintes FK
        cursor.execute("PRAGMA foreign_keys")
        fk_enabled = cursor.fetchone()[0]
        self.log_info(f"🔗 Contraintes FK initialement: {'activées' if fk_enabled else 'désactivées'}")
        
        # Désactiver temporairement les contraintes FK
        cursor.execute("PRAGMA foreign_keys = OFF")
        cursor.execute("PRAGMA defer_foreign_keys = ON")
        self.log_info("🔓 Contraintes FK temporairement désactivées")
        
        return bool(fk_enabled)
    
    def _execute_sqlite_restore_transaction(self, cursor, sql_file: Path, restore_options: Dict[str, Any], fk_enabled: bool) -> Dict[str, Any]:
        """Exécute la restauration SQLite dans une transaction"""
        # Commencer une transaction déférée
        cursor.execute("BEGIN DEFERRED TRANSACTION")
        
        # Optionnellement vider les tables si demandé
        if restore_options.get('flush_before', False):
            self._flush_sqlite_tables(cursor)
        
        # Préprocesser et exécuter le script SQL
        stats = self._execute_sql_statements(cursor, sql_file, restore_options)
        
        # Vérifier les contraintes avant commit
        fk_violations = self._check_sqlite_constraints(cursor, restore_options)
        stats['fk_violations'] = len(fk_violations)
        
        # Valider la transaction
        cursor.execute("COMMIT")
        self.log_info("✅ Transaction validée avec succès")
        
        # Restaurer l'état des contraintes
        cursor.execute(f"PRAGMA foreign_keys = {'ON' if fk_enabled else 'OFF'}")
        cursor.execute("PRAGMA defer_foreign_keys = OFF")
        
        # Vérification finale d'intégrité
        self._verify_sqlite_integrity(cursor)
        
        return stats
    
    def _flush_sqlite_tables(self, cursor) -> None:
        """Vide les tables SQLite existantes"""
        self.log_info("🗑️ Suppression des données existantes...")
        
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            AND name NOT LIKE 'sqlite_%' 
            AND name NOT IN ('django_migrations', 'auth_permission', 'django_content_type')
            ORDER BY name
        """)
        tables = cursor.fetchall()
        
        for table in tables:
            table_name = table[0]
            try:
                cursor.execute(f"DELETE FROM {table_name}")
                self.log_debug(f"  ✅ Table {table_name} vidée")
            except sqlite3.Error as e:
                self.log_warning(f"  ⚠️ Impossible de vider {table_name}: {e}")
    
    def _execute_sql_statements(self, cursor, sql_file: Path, restore_options: Dict[str, Any]) -> Dict[str, Any]:
        """Exécute les statements SQL avec gestion intelligente des erreurs"""
        self.log_info("📥 Import des données SQL avec gestion intelligente des erreurs...")
        
        with open(sql_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        statements = self._parse_sql_statements(sql_content)
        
        executed_statements = 0
        failed_statements = []
        deferred_statements = []
        
        # Premier passage: exécuter les statements non problématiques
        for i, statement in enumerate(statements):
            statement = statement.strip()
            if not statement or statement.startswith('--'):
                continue
            
            try:
                cursor.execute(statement)
                executed_statements += 1
            except sqlite3.Error as e:
                if self._handle_sql_error(cursor, e, statement, i, restore_options, deferred_statements, failed_statements):
                    executed_statements += 1
        
        # Deuxième passage: retry des statements différés
        executed_statements += self._retry_deferred_statements(cursor, deferred_statements, failed_statements)
        
        success_rate = executed_statements / len(statements) * 100 if statements else 0
        
        return {
            'executed_statements': executed_statements,
            'total_statements': len(statements),
            'failed_statements': len(failed_statements),
            'success_rate': success_rate
        }
    
    def _handle_sql_error(self, cursor, error: sqlite3.Error, statement: str, line_num: int, restore_options: Dict[str, Any], 
                         deferred_statements: List[Tuple[str, int]], failed_statements: List[Tuple[str, str, int]]) -> bool:
        """Gère les erreurs SQL de manière intelligente"""
        error_msg = str(error)
        
        if "UNIQUE constraint failed" in error_msg:
            if restore_options.get('ignore_duplicates', True):
                self.log_debug(f"⚠️ Doublon ignoré: {error_msg}")
                return False
        elif "FOREIGN KEY constraint failed" in error_msg:
            deferred_statements.append((statement, line_num))
            self.log_debug(f"🔄 Statement différé pour FK: ligne {line_num}")
            return False
        elif "NOT NULL constraint failed" in error_msg:
            corrected_statement = self._fix_not_null_statement(statement, error_msg)
            if corrected_statement != statement:
                try:
                    cursor.execute(corrected_statement)
                    self.log_info("🔧 Statement corrigé pour NOT NULL")
                    return True
                except sqlite3.Error:
                    pass
            deferred_statements.append((statement, line_num))
            return False
        
        # Autres erreurs: logger et continuer
        failed_statements.append((statement, error_msg, line_num))
        self.log_warning(f"⚠️ Erreur SQL ligne {line_num}: {error_msg}")
        return False
    
    def _retry_deferred_statements(self, cursor, deferred_statements: List[Tuple[str, int]], 
                                 failed_statements: List[Tuple[str, str, int]]) -> int:
        """Retry des statements différés avec logique d'attente"""
        if not deferred_statements:
            return 0
        
        self.log_info(f"🔄 Retry de {len(deferred_statements)} statements différés...")
        
        executed_count = 0
        retry_count = 0
        
        while deferred_statements and retry_count < self.MAX_SQL_RETRIES:
            retry_count += 1
            remaining_statements = []
            
            for statement, line_num in deferred_statements:
                try:
                    cursor.execute(statement)
                    executed_count += 1
                    self.log_debug(f"✅ Statement retry réussi: ligne {line_num}")
                except sqlite3.Error as e:
                    remaining_statements.append((statement, line_num))
                    if retry_count == self.MAX_SQL_RETRIES:
                        failed_statements.append((statement, str(e), line_num))
            
            deferred_statements = remaining_statements
            
            if remaining_statements:
                self.log_info(f"🔄 Retry {retry_count}/{self.MAX_SQL_RETRIES}: {len(remaining_statements)} statements restants")
        
        return executed_count
    
    def _check_sqlite_constraints(self, cursor, restore_options: Dict[str, Any]) -> List[Tuple]:
        """Vérifie les contraintes SQLite avant commit"""
        self.log_info("🔍 Vérification des contraintes avant commit...")
        
        # Réactiver temporairement les FK pour vérifier
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA foreign_key_check")
        fk_violations = cursor.fetchall()
        
        if fk_violations:
            self.log_warning(f"⚠️ {len(fk_violations)} violations de FK détectées:")
            for violation in fk_violations[:5]:  # Afficher seulement les 5 premières
                self.log_warning(f"  - Table: {violation[0]}, FK: {violation[3]}")
            
            if not restore_options.get('ignore_fk_violations', True):
                raise DatabaseRestoreError(f"Violations de contraintes FK détectées: {len(fk_violations)}")
            else:
                self.log_info("🔧 Violations FK ignorées selon les options")
        
        return fk_violations
    
    def _verify_sqlite_integrity(self, cursor) -> None:
        """Vérifie l'intégrité finale de la base SQLite"""
        cursor.execute("PRAGMA integrity_check")
        final_integrity = cursor.fetchone()[0]
        
        if final_integrity == "ok":
            self.log_info("✅ Vérification d'intégrité finale réussie")
        else:
            self.log_warning(f"⚠️ Problème d'intégrité finale: {final_integrity}")
    
    def _log_sqlite_restore_summary(self, stats: Dict[str, Any]) -> None:
        """Log le résumé de la restauration SQLite"""
        self.log_info("✅ Base SQLite restaurée:")
        self.log_info(f"  📊 {stats['executed_statements']}/{stats['total_statements']} statements exécutées ({stats['success_rate']:.1f}%)")
        self.log_info(f"  ❌ {stats['failed_statements']} statements échouées")
        self.log_info(f"  🔗 {stats['fk_violations']} violations FK détectées")
    
    def _cleanup_sqlite_connection(self, cursor, conn, fk_enabled: bool) -> None:
        """Nettoie la connexion SQLite en cas d'erreur"""
        try:
            cursor.execute("ROLLBACK")
            cursor.execute(f"PRAGMA foreign_keys = {'ON' if fk_enabled else 'OFF'}")
            cursor.execute("PRAGMA defer_foreign_keys = OFF")
            conn.close()
        except Exception:
            pass
    
    def _parse_sql_statements(self, sql_content: str) -> List[str]:
        """Parse les statements SQL de manière intelligente en gérant les statements multi-lignes"""
        # Supprimer les commentaires
        sql_content = re.sub(r'--.*$', '', sql_content, flags=re.MULTILINE)
        
        # Séparer par ';' mais en tenant compte des strings
        statements = []
        current_statement = ""
        in_string = False
        string_char = None
        
        i = 0
        while i < len(sql_content):
            char = sql_content[i]
            
            if not in_string:
                if char in ['"', "'"]:
                    in_string = True
                    string_char = char
                elif char == ';':
                    statements.append(current_statement.strip())
                    current_statement = ""
                    i += 1
                    continue
            else:
                if char == string_char and (i == 0 or sql_content[i-1] != '\\'):
                    in_string = False
                    string_char = None
            
            current_statement += char
            i += 1
        
        # Ajouter le dernier statement s'il existe
        if current_statement.strip():
            statements.append(current_statement.strip())
        
        return statements
    
    def _fix_not_null_statement(self, statement: str, error_msg: str) -> str:
        """Tente de corriger un statement qui viole une contrainte NOT NULL"""
        # Extraire le nom de la colonne de l'erreur
        match = re.search(r'NOT NULL constraint failed: (\w+)\.(\w+)', error_msg)
        if not match:
            return statement
        
        table_name, column_name = match.groups()
        
        # Si c'est un INSERT, tenter d'ajouter une valeur par défaut
        if statement.upper().startswith('INSERT') and column_name in self.DEFAULT_NOT_NULL_VALUES:
            self.log_info(f"🔧 Tentative de correction NOT NULL pour {table_name}.{column_name}")
            # Cette logique pourrait être améliorée selon les besoins
        
        return statement
    
    def _restore_sqlite_from_db(self, backup_db_file: Path, db_settings: Dict[str, Any], restore_options: Dict[str, Any]) -> Dict[str, Any]:
        """Restauration SQLite depuis un fichier de base de données (méthode de remplacement - moins sûre)"""
        current_db_path = Path(db_settings['NAME'])
        
        # Sauvegarde de la DB actuelle si demandé
        if restore_options.get('backup_current', True):
            self._backup_current_database(current_db_path)
        
        # Avertissement sur cette méthode
        self.log_warning("⚠️ Utilisation de la méthode de remplacement de DB (moins sûre)")
        
        # Remplacement de la base de données
        if current_db_path.exists():
            current_db_path.unlink()
        
        shutil.copy2(backup_db_file, current_db_path)
        
        file_size = current_db_path.stat().st_size
        self.log_info(f"✅ Base SQLite restaurée par remplacement: {self.format_size(file_size)}")
        
        # IMPORTANT: Marquer que la DB a été complètement remplacée
        return {
            'data_restored': 1, 
            'database_replaced': True  # Nouvelle clé pour indiquer le remplacement complet
        }
    
    def _backup_current_database(self, current_db_path: Path) -> None:
        """Sauvegarde la base de données actuelle"""
        backup_current_path = current_db_path.with_suffix(f'.backup_{timezone.now().strftime("%Y%m%d_%H%M%S")}.sqlite3')
        if current_db_path.exists():
            shutil.copy2(current_db_path, backup_current_path)
            self.log_info(f"💾 DB actuelle sauvegardée: {backup_current_path}")
    
    def _restore_postgresql(self, extract_dir: Path, db_settings: Dict[str, Any], restore_options: Dict[str, Any]) -> Dict[str, Any]:
        """Restauration spécifique pour PostgreSQL"""
        dump_file = extract_dir / self.DATABASE_DUMP_FILENAME
        if not dump_file.exists():
            self.log_warning("⚠️ Dump PostgreSQL introuvable")
            return {'data_restored': 0}
        
        # Drop et recréation de la DB si demandé
        if restore_options.get('drop_before_restore', False):
            self._drop_postgresql_database(db_settings)
            self._create_postgresql_database(db_settings)
        
        # Restauration avec psql
        cmd = [
            'psql',
            f"--host={db_settings.get('HOST', 'localhost')}",
            f"--port={db_settings.get('PORT', 5432)}",
            f"--username={db_settings['USER']}",
            f"--dbname={db_settings['NAME']}",
            '--quiet',
            f"--file={dump_file}"
        ]
        
        env = {'PGPASSWORD': db_settings.get('PASSWORD', '')} if db_settings.get('PASSWORD') else {}
        
        try:
            result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=3600)
            if result.returncode != 0:
                raise subprocess.CalledProcessError(result.returncode, cmd, result.stderr)
            
            self.log_info("✅ Base PostgreSQL restaurée")
            return {'data_restored': 1}
            
        except subprocess.CalledProcessError as e:
            raise DatabaseRestoreError(f"Erreur psql: {e.stderr}")
        except subprocess.TimeoutExpired:
            raise DatabaseRestoreError("Timeout lors de la restauration PostgreSQL")
    
    def _restore_mysql(self, extract_dir: Path, db_settings: Dict[str, Any], restore_options: Dict[str, Any]) -> Dict[str, Any]:
        """Restauration spécifique pour MySQL"""
        # Paramètre restore_options disponible pour futures options
        _ = restore_options  # Marquer comme intentionnellement inutilisé
        
        dump_file = extract_dir / self.DATABASE_DUMP_FILENAME
        if not dump_file.exists():
            self.log_warning("⚠️ Dump MySQL introuvable")
            return {'data_restored': 0}
        
        cmd = [
            'mysql',
            f"--host={db_settings.get('HOST', 'localhost')}",
            f"--port={db_settings.get('PORT', 3306)}",
            f"--user={db_settings['USER']}",
            f"--password={db_settings.get('PASSWORD', '')}",
            db_settings['NAME']
        ]
        
        try:
            with open(dump_file, 'r') as f:
                result = subprocess.run(cmd, stdin=f, capture_output=True, text=True, timeout=3600)
            
            if result.returncode != 0:
                raise subprocess.CalledProcessError(result.returncode, cmd, result.stderr)
            
            self.log_info("✅ Base MySQL restaurée")
            return {'data_restored': 1}
            
        except subprocess.CalledProcessError as e:
            raise DatabaseRestoreError(f"Erreur mysql: {e.stderr}")
        except subprocess.TimeoutExpired:
            raise DatabaseRestoreError("Timeout lors de la restauration MySQL")
    
    def _restore_files(self, extract_dir: Path, restore_options: Dict[str, Any]) -> Dict[str, Any]:
        """Restaure les fichiers système"""
        self.log_info("📁 Phase 3: Restauration des fichiers")
        
        files_dir = extract_dir / self.FILES_DIRNAME
        if not files_dir.exists():
            self.log_warning("⚠️ Répertoire de fichiers introuvable")
            return {'files_restored': 0}
        
        try:
            files_restored = 0
            
            # Restauration des fichiers media
            files_restored += self._restore_media_files(files_dir, restore_options)
            
            # Restauration des logs
            files_restored += self._restore_log_files(files_dir, restore_options)
            
            self.log_info(f"✅ {files_restored} fichiers restaurés")
            return {'files_restored': files_restored}
            
        except Exception as e:
            raise FileRestoreError(f"Erreur lors de la restauration des fichiers: {e}")
    
    def _restore_media_files(self, files_dir: Path, restore_options: Dict[str, Any]) -> int:
        """Restaure les fichiers media"""
        media_source = files_dir / "media"
        if not (media_source.exists() and hasattr(settings, 'MEDIA_ROOT')):
            return 0
        
        media_dest = Path(settings.MEDIA_ROOT)
        
        if restore_options.get('backup_current_files', True):
            self._backup_current_media_files(media_dest)
        
        # Restauration
        if media_dest.exists():
            shutil.rmtree(media_dest)
        shutil.copytree(media_source, media_dest, dirs_exist_ok=True)
        
        files_count = sum(1 for _ in media_dest.rglob('*') if _.is_file())
        self.log_info(f"📷 Fichiers media restaurés: {media_dest}")
        
        return files_count
    
    def _backup_current_media_files(self, media_dest: Path) -> None:
        """Sauvegarde les fichiers media actuels"""
        backup_media_path = media_dest.parent / f"media_backup_{timezone.now().strftime('%Y%m%d_%H%M%S')}"
        if media_dest.exists():
            shutil.copytree(media_dest, backup_media_path, dirs_exist_ok=True)
            self.log_info(f"💾 Fichiers media actuels sauvegardés: {backup_media_path}")
    
    def _restore_log_files(self, files_dir: Path, restore_options: Dict[str, Any]) -> int:
        """Restaure les fichiers de logs"""
        logs_source = files_dir / "logs"
        if not logs_source.exists():
            return 0
        
        logs_dest = Path('logs')
        
        if restore_options.get('merge_logs', True):
            # Fusion avec les logs existants
            if logs_dest.exists():
                shutil.copytree(logs_source, logs_dest, dirs_exist_ok=True)
            else:
                shutil.copytree(logs_source, logs_dest)
        else:
            # Remplacement complet
            if logs_dest.exists():
                shutil.rmtree(logs_dest)
            shutil.copytree(logs_source, logs_dest)
        
        files_count = sum(1 for _ in logs_dest.rglob('*') if _.is_file())
        self.log_info(f"📋 Logs restaurés: {logs_dest}")
        
        return files_count
    
    def _cleanup_restore_directory(self, restore_dir: Path) -> None:
        """Nettoie le répertoire temporaire de restauration"""
        try:
            if restore_dir.exists():
                shutil.rmtree(restore_dir)
                self.log_info(f"🧹 Répertoire temporaire nettoyé: {restore_dir}")
        except Exception as e:
            self.log_warning(f"⚠️ Impossible de nettoyer {restore_dir}: {e}")
    
    def _drop_postgresql_database(self, db_settings: Dict[str, Any]) -> None:
        """Supprime une base PostgreSQL"""
        # Cette fonction nécessite des privilèges administrateur
        # À implémenter selon les besoins spécifiques
        pass
    
    def _create_postgresql_database(self, db_settings: Dict[str, Any]) -> None:
        """Crée une base PostgreSQL"""
        # Cette fonction nécessite des privilèges administrateur
        # À implémenter selon les besoins spécifiques
        pass
    
    def _auto_cleanup_temp_files(self) -> None:
        """Nettoyage automatique des fichiers temporaires anciens"""
        try:
            from .cleanup_service import CleanupService
            
            cleanup_service = CleanupService()
            # Nettoyer les fichiers de plus de 2h automatiquement
            results = cleanup_service.cleanup_all_temporary_files(max_age_hours=self.AUTO_CLEANUP_MAX_AGE_HOURS)
            
            # Log seulement si quelque chose a été nettoyé
            if results['totals']['files_deleted'] > 0:
                self.log_info(
                    f"🧹 Nettoyage automatique: "
                    f"{results['totals']['files_deleted']} fichiers temporaires supprimés, "
                    f"{cleanup_service.format_size(results['totals']['size_freed'])} libérés"
                )
        except Exception as e:
            # Ne pas faire échouer la restauration si le nettoyage échoue
            self.log_warning(f"⚠️ Nettoyage automatique échoué: {e}") 