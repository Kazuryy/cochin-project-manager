"""
🆕 Service de Restauration Externe - Solution d'Isolation Complète

Ce service gère les uploads et restaurations de sauvegardes externes
sans JAMAIS interférer avec l'historique principal du système.

PROBLÈMES RÉSOLUS:
- Écrasement de l'historique lors des restaurations
- Sauvegardes fantômes (fichiers supprimés mais bases restaurées)  
- États incohérents (running vs completed)
- Conflits entre uploads externes et système interne

PRINCIPE: Isolation totale via des tables dédiées
"""

import os
import tempfile
import zipfile
import shutil
import sqlite3
import json
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from ..models import UploadedBackup, ExternalRestoration
from .base_service import BaseService
from .encryption_service import EncryptionService


class ExternalRestoreService(BaseService):
    """
    Service spécialisé pour les restaurations externes avec isolation complète.
    
    Ce service garantit que les uploads externes ne peuvent JAMAIS :
    - Écraser l'historique des sauvegardes système
    - Supprimer les fichiers de sauvegarde existants
    - Créer des sauvegardes fantômes
    - Interférer avec les opérations internes
    """
    
    # Tables système PROTÉGÉES (ne jamais restaurer depuis uploads externes)
    PROTECTED_SYSTEM_TABLES = frozenset([
        'backup_manager_backuphistory',
        'backup_manager_backupconfiguration', 
        'backup_manager_restorehistory',
        'backup_manager_uploadedbackup',      # 🆕 Nouvelle table protégée
        'backup_manager_externalrestoration', # 🆕 Nouvelle table protégée
        'auth_user',                         # Ancien nom
        'authentication_user',               # 🔧 Vrai nom de la table
        'auth_group',
        'auth_permission',
        'authentication_group',              # 🔧 Alias potentiel
        'authentication_permission',         # 🔧 Alias potentiel
        'django_session',
        'django_migrations',
        'django_content_type',
        'django_admin_log',                  # 🔧 Logs admin
        'auth_group_permissions',            # 🔧 Table de liaison
        'auth_user_groups',                  # 🔧 Table de liaison
        'auth_user_user_permissions',        # 🔧 Table de liaison
    ])
    
    # Répertoires de fichiers PROTÉGÉS (ne jamais écraser)
    PROTECTED_FILE_PATHS = frozenset([
        'backups/',
        'logs/',
        'media/system/',
    ])
    
    def __init__(self):
        super().__init__('ExternalRestoreService')
        self.encryption_service = EncryptionService()
    
    def handle_external_upload(self, uploaded_file, user, upload_name: str) -> UploadedBackup:
        """
        Traite un upload externe et crée un UploadedBackup isolé.
        
        GARANTIES DE SÉCURITÉ:
        - Stockage dans un répertoire séparé
        - Validation sans impact sur le système
        - Aucune interaction avec BackupHistory
        """
        self.log_info(f"🔄 Début traitement upload externe: {upload_name}")
        
        # Créer le répertoire d'uploads isolé
        upload_dir = self._create_isolated_upload_directory()
        
        # Générer un nom de fichier unique et sécurisé
        timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
        safe_filename = f"external_{timestamp}_{upload_name}.uploaded"
        upload_path = upload_dir / safe_filename
        
        try:
            # Sauvegarder le fichier uploadé dans l'espace isolé
            with open(upload_path, 'wb') as destination:
                for chunk in uploaded_file.chunks():
                    destination.write(chunk)
            
            # Calculer les métadonnées
            file_size = upload_path.stat().st_size
            checksum = self._calculate_file_checksum(upload_path)
            
            # Créer l'enregistrement UploadedBackup (isolé)
            uploaded_backup = UploadedBackup.objects.create(
                original_filename=uploaded_file.name,
                upload_name=upload_name,
                file_path=str(upload_path),
                file_size=file_size,
                file_checksum=checksum,
                status='processing',
                uploaded_by=user
            )
            
            self.log_info(f"✅ Upload externe enregistré: ID {uploaded_backup.id}")
            
            # Lancer la validation en arrière-plan
            self._validate_external_backup(uploaded_backup)
            
            return uploaded_backup
            
        except Exception as e:
            self.log_error(f"❌ Erreur upload externe: {e}")
            # Nettoyer le fichier en cas d'erreur
            if upload_path.exists():
                upload_path.unlink()
            raise
    
    def restore_from_external_backup(
        self, 
        uploaded_backup: UploadedBackup, 
        user, 
        merge_strategy: str = 'preserve_system'
    ) -> ExternalRestoration:
        """
        Restaure depuis un upload externe avec stratégie de fusion sécurisée.
        
        STRATÉGIES DE FUSION:
        - 'preserve_system': Préserve TOUTES les données système (recommandé)
        - 'merge': Fusion intelligente (avancé)
        - 'replace': Remplacement (DANGEREUX - désactivé par défaut)
        """
        if uploaded_backup.status != 'ready':
            raise ValueError(f"Upload non prêt pour restauration: {uploaded_backup.status}")
        
        # Créer l'enregistrement de restauration externe
        try:
            date_part = timezone.now().strftime('%d%m%y_%H%M')
            restoration = ExternalRestoration.objects.create(
                uploaded_backup=uploaded_backup,
                merge_strategy=merge_strategy,
                restoration_name=f"Restoration_{uploaded_backup.upload_name}_{date_part}",
                status='pending',
                created_by=user
            )
            
            self._execute_external_restoration(restoration)
            return restoration
            
        except Exception as e:
            restoration.complete_restoration(success=False, error_message=str(e))
            self.log_error(f"❌ Échec restauration externe: {e}")
            raise
    
    def _create_isolated_upload_directory(self) -> Path:
        """Crée un répertoire isolé pour les uploads externes"""
        upload_dir = Path(settings.BASE_DIR) / "backups" / "external_uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Créer un fichier .gitignore pour ignorer les uploads
        gitignore_path = upload_dir / ".gitignore"
        if not gitignore_path.exists():
            with open(gitignore_path, 'w') as f:
                f.write("# Uploads externes - ne pas versionner\n*\n!.gitignore\n")
        
        return upload_dir
    
    def _validate_external_backup(self, uploaded_backup: UploadedBackup) -> None:
        """Valide un upload externe sans impact sur le système"""
        self.log_info(f"🔍 Validation upload ID {uploaded_backup.id}")
        
        try:
            upload_path = Path(uploaded_backup.file_path)
            
            # Vérifier l'existence du fichier
            if not upload_path.exists():
                uploaded_backup.mark_as_failed("Fichier uploadé introuvable")
                return
            
            # Vérifier le checksum
            calculated_checksum = self._calculate_file_checksum(upload_path)
            if calculated_checksum != uploaded_backup.file_checksum:
                uploaded_backup.mark_as_failed("Checksum invalide - fichier corrompu")
                return
            
            # Analyser le contenu (déchiffrement si nécessaire)
            metadata = self._analyze_backup_content(upload_path)
            
            # Mettre à jour les métadonnées
            uploaded_backup.backup_metadata = metadata
            uploaded_backup.detected_backup_type = metadata.get('backup_type', 'unknown')
            uploaded_backup.detected_source_system = metadata.get('source_system', 'unknown')
            
            # Marquer comme prêt si validé
            if metadata.get('is_valid', False):
                uploaded_backup.mark_as_ready()
                self.log_info(f"✅ Upload ID {uploaded_backup.id} validé et prêt")
            else:
                uploaded_backup.mark_as_failed("Contenu invalide ou non reconnu")
                
        except Exception as e:
            uploaded_backup.mark_as_failed(f"Erreur validation: {str(e)}")
            self.log_error(f"❌ Erreur validation upload ID {uploaded_backup.id}: {e}")
    
    def _analyze_backup_content(self, backup_path: Path) -> Dict[str, Any]:
        """Analyse le contenu d'un fichier de sauvegarde sans l'appliquer"""
        metadata = {
            'is_valid': False,
            'backup_type': 'unknown',
            'source_system': 'unknown',
            'contains_system_tables': False,
            'estimated_tables': 0,
            'analysis_warnings': []
        }
        
        self.log_info(f"🔍 Analyse du fichier: {backup_path}")
        self.log_info(f"   📁 Taille: {backup_path.stat().st_size} bytes")
        self.log_info(f"   📄 Extension: {backup_path.suffix}")
        
        try:
            # Créer un répertoire temporaire pour l'analyse
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                working_file = backup_path
                
                # Déchiffrer si nécessaire
                if backup_path.suffix == '.encrypted':
                    self.log_info("🔓 Tentative de déchiffrement...")
                    decrypted_path = temp_path / "decrypted.zip"
                    if self._try_decrypt_backup(backup_path, decrypted_path):
                        working_file = decrypted_path
                        self.log_info("✅ Déchiffrement réussi")
                    else:
                        self.log_warning("⚠️ Impossible de déchiffrer le fichier")
                        metadata['analysis_warnings'].append("Impossible de déchiffrer le fichier")
                        # Essayer quand même d'analyser le fichier original
                        working_file = backup_path
                
                # Vérifier si c'est un fichier ZIP
                if working_file.suffix in ['.zip'] or self._is_zip_file(working_file):
                    self.log_info("📦 Fichier ZIP détecté, extraction...")
                    extract_dir = temp_path / "extracted"
                    extract_dir.mkdir()
                    
                    try:
                        with zipfile.ZipFile(working_file, 'r') as zip_file:
                            zip_file.extractall(extract_dir)
                            self.log_info(f"✅ Extraction réussie - {len(zip_file.namelist())} fichiers")
                        
                        metadata.update(self._analyze_extracted_backup(extract_dir))
                        
                    except zipfile.BadZipFile:
                        self.log_warning("❌ Fichier ZIP corrompu ou invalide")
                        metadata['analysis_warnings'].append("Fichier ZIP corrompu")
                        
                elif working_file.suffix == '.sql':
                    # Fichier SQL direct
                    self.log_info("📄 Fichier SQL direct détecté")
                    sql_analysis = self._analyze_sql_file(working_file)
                    metadata.update({
                        'is_valid': sql_analysis['tables_count'] > 0,
                        'backup_type': 'sql_dump',
                        'estimated_tables': sql_analysis['tables_count'],
                        'sql_statements': sql_analysis['statements_count'],
                        'contains_system_tables': sql_analysis['has_system_tables']
                    })
                    
                else:
                    # Fichier non reconnu
                    self.log_warning(f"⚠️ Type de fichier non reconnu: {working_file.suffix}")
                    metadata['analysis_warnings'].append(f"Type de fichier non reconnu: {working_file.suffix}")
                    
                    # Essayer quand même de le traiter comme un ZIP (fichiers sans extension)
                    if self._is_zip_file(working_file):
                        self.log_info("🔍 Détection ZIP par signature de fichier...")
                        extract_dir = temp_path / "extracted"
                        extract_dir.mkdir()
                        
                        try:
                            with zipfile.ZipFile(working_file, 'r') as zip_file:
                                zip_file.extractall(extract_dir)
                            metadata.update(self._analyze_extracted_backup(extract_dir))
                        except:
                            pass
                
        except Exception as e:
            self.log_error(f"❌ Erreur lors de l'analyse: {e}")
            metadata['analysis_warnings'].append(f"Erreur analyse: {str(e)}")
        
        self.log_info(f"📊 Résultat analyse: valide={metadata['is_valid']}, type={metadata['backup_type']}, tables={metadata['estimated_tables']}")
        return metadata
    
    def _analyze_extracted_backup(self, extract_dir: Path) -> Dict[str, Any]:
        """Analyse un répertoire de sauvegarde extrait"""
        analysis = {
            'is_valid': False,
            'backup_type': 'unknown',
            'source_system': 'cochin-project-manager',
            'contains_system_tables': False,
            'estimated_tables': 0,
            'sql_statements': 0,
            'analysis_warnings': []
        }
        
        self.log_info(f"📂 Analyse du répertoire extrait: {extract_dir}")
        
        # Lister tous les fichiers trouvés
        all_files = list(extract_dir.rglob("*"))
        self.log_info(f"   📄 {len(all_files)} fichiers trouvés au total")
        
        # Chercher les fichiers SQL
        sql_files = list(extract_dir.rglob("*.sql"))
        self.log_info(f"   📊 {len(sql_files)} fichiers SQL trouvés")
        
        if sql_files:
            analysis['backup_type'] = 'sql_dump'
            
            for sql_file in sql_files:
                self.log_info(f"   🔍 Analyse de {sql_file.name}")
                sql_analysis = self._analyze_sql_file(sql_file)
                analysis['estimated_tables'] += sql_analysis['tables_count']
                analysis['sql_statements'] += sql_analysis['statements_count']
                
                if sql_analysis['has_system_tables']:
                    analysis['contains_system_tables'] = True
                    analysis['analysis_warnings'].append(
                        "⚠️ Contient des tables système - fusion sécurisée recommandée"
                    )
        
        # Chercher les métadonnées Django
        metadata_files = list(extract_dir.rglob("metadata.json"))
        self.log_info(f"   📋 {len(metadata_files)} fichiers de métadonnées trouvés")
        if metadata_files:
            analysis['backup_type'] = 'full_django'
        
        # Chercher d'autres types de fichiers reconnus
        db_files = list(extract_dir.rglob("*.db")) + list(extract_dir.rglob("*.sqlite*"))
        json_files = list(extract_dir.rglob("*.json"))
        csv_files = list(extract_dir.rglob("*.csv"))
        
        self.log_info(f"   💾 {len(db_files)} fichiers de base de données")
        self.log_info(f"   📝 {len(json_files)} fichiers JSON")
        self.log_info(f"   📈 {len(csv_files)} fichiers CSV")
        
        # Validation plus permissive
        has_valid_content = (
            analysis['estimated_tables'] > 0 or 
            metadata_files or 
            db_files or 
            (json_files and len(json_files) > 2) or  # Au moins quelques fichiers JSON
            (csv_files and len(csv_files) > 1)       # Au moins quelques fichiers CSV
        )
        
        if has_valid_content:
            analysis['is_valid'] = True
            if analysis['backup_type'] == 'unknown':
                # Détecter le type selon le contenu
                if db_files:
                    analysis['backup_type'] = 'database_dump'
                elif json_files:
                    analysis['backup_type'] = 'json_export' 
                elif csv_files:
                    analysis['backup_type'] = 'csv_export'
                else:
                    analysis['backup_type'] = 'mixed_content'
        else:
            # En développement, être plus tolérant
            if settings.DEBUG and len(all_files) > 0:
                analysis['is_valid'] = True
                analysis['backup_type'] = 'development_test'
                analysis['analysis_warnings'].append(
                    "⚠️ Mode développement: validation permissive activée"
                )
                self.log_info("🔧 Mode développement: marquage comme valide pour test")
        
        self.log_info(f"   ✅ Analyse terminée: {analysis}")
        return analysis
    
    def _analyze_sql_file(self, sql_file: Path) -> Dict[str, Any]:
        """Analyse un fichier SQL pour détecter les tables système"""
        analysis = {
            'tables_count': 0,
            'statements_count': 0,
            'has_system_tables': False,
            'system_tables_found': []
        }
        
        try:
            with open(sql_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Compter les CREATE TABLE
            import re
            tables = re.findall(r'CREATE TABLE ["`]?(\w+)["`]?', content, re.IGNORECASE)
            analysis['tables_count'] = len(tables)
            
            # Compter les INSERT statements
            analysis['statements_count'] = len(re.findall(r'INSERT INTO', content, re.IGNORECASE))
            
            # Détecter les tables système
            for table in tables:
                if table in self.PROTECTED_SYSTEM_TABLES:
                    analysis['has_system_tables'] = True
                    analysis['system_tables_found'].append(table)
            
        except Exception as e:
            self.log_warning(f"⚠️ Erreur analyse SQL {sql_file}: {e}")
        
        return analysis
    
    def _execute_external_restoration(self, restoration: ExternalRestoration) -> None:
        """Exécute une restauration externe avec protection du système"""
        self.log_info(f"🔄 Début restauration externe ID {restoration.id}")
        
        restoration.start_restoration()
        
        try:
            # Étape 1: Extraction sécurisée
            restoration.update_progress(10, "Extraction du fichier uploadé")
            temp_dir = self._extract_external_backup(restoration.uploaded_backup)
            
            # Étape 2: Analyse et filtrage
            restoration.update_progress(30, "Analyse du contenu")
            filtered_data = self._filter_system_data(temp_dir, restoration.merge_strategy)
            
            # Étape 3: Application sélective
            restoration.update_progress(50, "Application des données filtrées")
            results = self._apply_filtered_data(filtered_data, restoration)
            
            # Étape 4: Finalisation
            restoration.update_progress(90, "Finalisation")
            self._finalize_external_restoration(restoration, results)
            
            restoration.complete_restoration(success=True)
            self.log_info(f"✅ Restauration externe ID {restoration.id} terminée")
            
        except Exception as e:
            restoration.complete_restoration(success=False, error_message=str(e))
            raise
        finally:
            # Nettoyer les fichiers temporaires
            if 'temp_dir' in locals():
                shutil.rmtree(temp_dir, ignore_errors=True)
    
    def _filter_system_data(self, temp_dir: Path, merge_strategy: str) -> Dict[str, Any]:
        """Filtre les données pour protéger le système"""
        self.log_info(f"🛡️ Filtrage des données système (stratégie: {merge_strategy})")
        
        if merge_strategy == 'preserve_system':
            # Mode le plus sûr: ne toucher AUCUNE table système
            return self._filter_preserve_all_system(temp_dir)
        elif merge_strategy == 'merge':
            # Mode fusion intelligente
            return self._filter_intelligent_merge(temp_dir)
        else:
            raise ValueError(f"Stratégie non supportée: {merge_strategy}")
    
    def _filter_preserve_all_system(self, temp_dir: Path) -> Dict[str, Any]:
        """Filtre en préservant TOUT le système existant"""
        filtered_data = {
            'sql_statements': [],
            'metadata_files': [],
            'user_files': [],
            'excluded_tables': list(self.PROTECTED_SYSTEM_TABLES),
            'stats': {'preserved_tables': 0, 'applied_tables': 0}
        }
        
        # Analyser les fichiers SQL et filtrer
        sql_files = list(temp_dir.rglob("*.sql"))
        for sql_file in sql_files:
            filtered_statements = self._filter_sql_statements(sql_file)
            filtered_data['sql_statements'].extend(filtered_statements)
        
        return filtered_data
    
    def _filter_sql_statements(self, sql_file: Path) -> List[str]:
        """Filtre les statements SQL pour exclure les tables système"""
        filtered_statements = []
        
        try:
            with open(sql_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            statements = content.split(';')
            
            for statement in statements:
                statement = statement.strip()
                if not statement:
                    continue
                
                # Vérifier si le statement touche une table protégée
                is_protected = self._is_statement_protected(statement)
                
                if not is_protected:
                    filtered_statements.append(statement + ';')
                else:
                    # Log plus détaillé du filtrage
                    table_name = self._extract_table_name_from_statement(statement)
                    self.log_info(f"🛡️ Statement filtré: table système détectée '{table_name}'")
            
        except Exception as e:
            self.log_error(f"❌ Erreur filtrage SQL {sql_file}: {e}")
        
        return filtered_statements
    
    def _is_statement_protected(self, statement: str) -> bool:
        """Vérifie si un statement SQL touche une table protégée"""
        statement_lower = statement.lower()
        
        # Extraire le nom de table du statement
        table_name = self._extract_table_name_from_statement(statement_lower)
        
        if table_name:
            # Vérification exacte du nom de table
            if table_name in self.PROTECTED_SYSTEM_TABLES:
                return True
            
            # Vérification par préfixe pour les tables Django/Auth
            protected_prefixes = ['auth_', 'authentication_', 'django_', 'backup_manager_']
            for prefix in protected_prefixes:
                if table_name.startswith(prefix):
                    return True
        
        return False
    
    def _extract_table_name_from_statement(self, statement: str) -> Optional[str]:
        """Extrait le nom de table d'un statement SQL"""
        import re
        
        statement_lower = statement.lower().strip()
        
        # Patterns pour différents types de statements
        patterns = [
            r'create\s+table\s+(?:if\s+not\s+exists\s+)?[`"\']*([a-zA-Z_][a-zA-Z0-9_]*)[`"\']*',
            r'insert\s+into\s+[`"\']*([a-zA-Z_][a-zA-Z0-9_]*)[`"\']*',
            r'update\s+[`"\']*([a-zA-Z_][a-zA-Z0-9_]*)[`"\']*',
            r'delete\s+from\s+[`"\']*([a-zA-Z_][a-zA-Z0-9_]*)[`"\']*',
            r'drop\s+table\s+(?:if\s+exists\s+)?[`"\']*([a-zA-Z_][a-zA-Z0-9_]*)[`"\']*',
            r'alter\s+table\s+[`"\']*([a-zA-Z_][a-zA-Z0-9_]*)[`"\']*',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, statement_lower)
            if match:
                return match.group(1)
        
        return None
    
    def _apply_filtered_data(self, filtered_data: Dict[str, Any], restoration: ExternalRestoration) -> Dict[str, Any]:
        """Applique les données filtrées de manière sécurisée"""
        results = {
            'statements_applied': 0,
            'statements_failed': 0,
            'tables_created': 0,
            'records_inserted': 0,
            'files_restored': 0,
            'errors': []
        }
        
        self.log_info(f"🔄 Application de {len(filtered_data['sql_statements'])} statements filtrés")
        
        # Appliquer les statements SQL filtrés avec résolution de conflits
        from django.db import connection
        
        for statement in filtered_data['sql_statements']:
            if not statement.strip():
                continue
                
            try:
                # 🆕 Résoudre les conflits d'ID potentiels
                resolved_statement = self._resolve_id_conflicts(statement)
                
                with transaction.atomic():
                    # Exécuter le statement résolu
                    with connection.cursor() as cursor:
                        cursor.execute(resolved_statement)
                        
                    results['statements_applied'] += 1
                    
                    # Compter les types d'opérations
                    statement_upper = resolved_statement.upper()
                    if 'CREATE TABLE' in statement_upper:
                        results['tables_created'] += 1
                        self.log_info(f"✅ Table créée via statement SQL")
                    elif 'INSERT INTO' in statement_upper:
                        # Compter le nombre d'enregistrements insérés
                        import re
                        values_match = re.search(r'VALUES\s*\((.*?)\)', resolved_statement, re.IGNORECASE | re.DOTALL)
                        if values_match:
                            # Estimer le nombre d'enregistrements (approximatif)
                            values_count = resolved_statement.upper().count('VALUES')
                            results['records_inserted'] += values_count
                        else:
                            results['records_inserted'] += 1
                        
            except Exception as e:
                error_message = str(e)
                
                # Erreurs bénignes qui n'empêchent pas la restauration
                benign_errors = [
                    'already exists',
                    'duplicate column name',
                    'near "UNIQUE": syntax error'  # Souvent des contraintes malformées
                ]
                
                is_benign = any(benign_error.lower() in error_message.lower() for benign_error in benign_errors)
                
                if is_benign:
                    # Erreur bénigne - on log en info mais on ne compte pas comme échec
                    self.log_info(f"ℹ️ Erreur bénigne ignorée: {error_message}")
                else:
                    # Erreur importante - on compte comme échec
                    results['statements_failed'] += 1
                    results['errors'].append(error_message)
                    self.log_warning(f"⚠️ Échec statement important: {error_message}")
        
        # Traiter les fichiers additionnels s'il y en a
        if 'user_files' in filtered_data:
            results['files_restored'] = len(filtered_data['user_files'])
        
        self.log_info(f"📊 Résultats application: {results['tables_created']} tables, {results['records_inserted']} enregistrements, {results['statements_failed']} échecs")
        
        return results
    
    def _resolve_id_conflicts(self, statement: str) -> str:
        """
        🆕 Résout les conflits d'ID et autres conflits en modifiant les statements SQL.
        
        Gère :
        - INSERT avec ID explicite → INSERT OR REPLACE ou sans ID
        - Contraintes UNIQUE → ignore si elles existent déjà
        - Index → ignore s'ils existent déjà
        """
        import re
        
        statement_clean = statement.strip()
        statement_upper = statement_clean.upper()
        
        # 1. STATEMENTS CREATE INDEX - Ignorer les erreurs "already exists"
        if statement_upper.startswith('CREATE') and 'INDEX' in statement_upper:
            # Transformer en CREATE INDEX IF NOT EXISTS
            if 'IF NOT EXISTS' not in statement_upper:
                return statement_clean.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS', 1)
            return statement_clean
        
        # 2. STATEMENTS ALTER TABLE ADD CONSTRAINT - Ignorer les erreurs de contraintes existantes  
        if statement_upper.startswith('ALTER TABLE') and ('ADD CONSTRAINT' in statement_upper or 'ADD UNIQUE' in statement_upper):
            # Pour les contraintes, on va les ignorer si elles causent des erreurs
            # On les laisse telles quelles, les erreurs seront catchées
            return statement_clean
        
        # 3. STATEMENTS INSERT INTO 
        if not statement_upper.startswith('INSERT INTO'):
            return statement_clean
        
        # Extraire le nom de la table
        table_match = re.search(r'INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)', statement_clean, re.IGNORECASE)
        if not table_match:
            return statement_clean
            
        table_name = table_match.group(1)
        
        # Tables de données métier qui peuvent être écrasées
        data_tables = [
            'database_dynamictable',
            'database_dynamicfield', 
            'database_dynamicrecord',
            'database_dynamicvalue',
            'conditional_fields_conditionalfieldrule',
            'conditional_fields_conditionalfieldoption'
        ]
        
        # Pour les tables de données métier, utiliser INSERT OR REPLACE
        if table_name in data_tables:
            return statement_clean.replace('INSERT INTO', 'INSERT OR REPLACE INTO', 1)
        
        # Pour les autres tables, essayer d'enlever l'ID explicite
        # Pattern plus robuste pour capturer les INSERT avec ID
        pattern = r'INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*id\s*,\s*([^)]+)\)\s*VALUES\s*\(\s*\d+\s*,\s*([^)]+)\)'
        
        match = re.search(pattern, statement_clean, re.IGNORECASE | re.DOTALL)
        
        if match:
            table_name_matched = match.group(1)
            field_list = match.group(2)
            values_list = match.group(3)
            
            # Reconstruire l'INSERT sans l'ID pour éviter les conflits
            new_statement = f"INSERT INTO {table_name_matched} ({field_list}) VALUES ({values_list})"
            
            self.log_info(f"🔧 Résolution conflit ID (sans ID): {table_name_matched}")
            return new_statement
        
        return statement_clean
    
    def _finalize_external_restoration(self, restoration: ExternalRestoration, results: Dict[str, Any]) -> None:
        """Finalise la restauration externe avec les statistiques"""
        # Mettre à jour les statistiques de la restauration
        restoration.external_tables_processed = results.get('tables_created', 0)
        restoration.external_records_processed = results.get('records_inserted', 0) 
        restoration.system_tables_preserved = len(self.PROTECTED_SYSTEM_TABLES)
        
        # Ajouter les statistiques dans les métadonnées de résultat
        restoration.result_metadata = {
            'tables_restored': results.get('tables_created', 0),
            'records_restored': results.get('records_inserted', 0),
            'files_restored': results.get('files_restored', 0),
            'statements_applied': results.get('statements_applied', 0),
            'statements_failed': results.get('statements_failed', 0),
            'system_tables_preserved': len(self.PROTECTED_SYSTEM_TABLES),
            'protected_tables': list(self.PROTECTED_SYSTEM_TABLES)
        }
        
        # Gérer les erreurs
        if results.get('errors'):
            error_count = len(results['errors'])
            restoration.error_message = f"{error_count} erreurs: " + "; ".join(results['errors'][:3])
            if error_count > 3:
                restoration.error_message += f" (et {error_count - 3} autres...)"
        
        # Sauvegarder les modifications
        restoration.save()
        
        self.log_info(f"📝 Restauration {restoration.id} finalisée: {restoration.external_tables_processed} tables, {restoration.external_records_processed} enregistrements")
    
    def _calculate_file_checksum(self, file_path: Path) -> str:
        """Calcule le checksum SHA-256 d'un fichier"""
        import hashlib
        
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    
    def _try_decrypt_backup(self, encrypted_path: Path, output_path: Path) -> bool:
        """Tente de déchiffrer un fichier de sauvegarde"""
        try:
            # TODO: Implémenter le déchiffrement avec la clé système
            # Pour l'instant, retourner False pour forcer l'analyse comme ZIP
            return False
        except Exception:
            return False
    
    def _extract_external_backup(self, uploaded_backup: UploadedBackup) -> Path:
        """Extrait un upload externe dans un répertoire temporaire"""
        temp_dir = Path(tempfile.mkdtemp(prefix="external_restore_"))
        backup_path = Path(uploaded_backup.file_path)
        
        try:
            if backup_path.suffix == '.encrypted':
                # Déchiffrement puis extraction
                decrypted_path = temp_dir / "decrypted.zip"
                if self._try_decrypt_backup(backup_path, decrypted_path):
                    backup_path = decrypted_path
            
            # Extraction ZIP
            with zipfile.ZipFile(backup_path, 'r') as zip_file:
                zip_file.extractall(temp_dir)
            
            return temp_dir
            
        except Exception as e:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise Exception(f"Erreur extraction: {e}")
    
    def list_external_uploads(self, user) -> List[UploadedBackup]:
        """Liste les uploads externes d'un utilisateur"""
        return UploadedBackup.objects.filter(uploaded_by=user).order_by('-uploaded_at')
    
    def list_external_restorations(self, user) -> List[ExternalRestoration]:
        """Liste les restaurations externes d'un utilisateur"""
        return ExternalRestoration.objects.filter(created_by=user).order_by('-created_at')
    
    def cleanup_old_uploads(self, max_age_days: int = 30) -> int:
        """Nettoie les anciens uploads externes"""
        cutoff_date = timezone.now() - timezone.timedelta(days=max_age_days)
        
        old_uploads = UploadedBackup.objects.filter(
            uploaded_at__lt=cutoff_date,
            status__in=['failed_validation', 'corrupted']
        )
        
        count = 0
        for upload in old_uploads:
            try:
                # Supprimer le fichier physique
                file_path = Path(upload.file_path)
                if file_path.exists():
                    file_path.unlink()
                
                # Supprimer l'enregistrement
                upload.delete()
                count += 1
                
            except Exception as e:
                self.log_warning(f"⚠️ Erreur nettoyage upload {upload.id}: {e}")
        
        self.log_info(f"🧹 {count} uploads externes nettoyés")
        return count
    
    def _is_zip_file(self, file_path: Path) -> bool:
        """Vérifie si un fichier est un ZIP en lisant sa signature"""
        try:
            with open(file_path, 'rb') as f:
                # Lire les 4 premiers bytes pour vérifier la signature ZIP
                signature = f.read(4)
                # Signatures ZIP possibles: PK\x03\x04, PK\x05\x06, PK\x07\x08
                return signature.startswith(b'PK')
        except:
            return False 