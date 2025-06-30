"""
Service de gestion des métadonnées (structure de la base de données)
"""

import tempfile
import json
import traceback
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
from django.core import management
from django.core.management.base import CommandError
from django.apps import apps
from django.conf import settings
from django.contrib.auth import get_user_model
from .base_service import BaseService


class MetadataService(BaseService):
    """Service pour exporter/importer les métadonnées de la base de données"""
    
    # Constantes
    EXCLUDED_APPS = frozenset(['sessions', 'admin', 'auth', 'contenttypes'])
    EXCLUDED_MODELS = frozenset(['LogEntry', 'Session'])
    
    # Validation : nombre max d'objets à valider pour les gros fichiers
    MAX_VALIDATION_ITEMS = 1000
    
    # Ordre d'import pour éviter les violations de contraintes FK
    IMPORT_ORDER = (
        # 1. Modèles de base sans dépendances
        'auth.user',
        'auth.group', 
        'auth.permission',
        'contenttypes.contenttype',
        
        # 2. Modèles d'authentification
        'authentication.user',
        
        # 3. Modèles avec des dépendances simples
        'database.dynamictable',
        'database.dynamiccolumn',
        'database.dynamicrow',
        'conditional_fields.conditionalfield',
        
        # 4. Modèles backup_manager (ordre important)
        'backup_manager.backupconfiguration',
        'backup_manager.backuphistory',
        'backup_manager.restorehistory',
    )
    
    # Corrections de schéma par modèle
    SCHEMA_FIXES = {
        'backup_manager.backupconfiguration': {
            'encryption_enabled': True,
            'encryption_algorithm': 'AES256',
            'compression_level': 6
        },
        'backup_manager.backuphistory': {
            'encryption_enabled': True,
            'compression_enabled': True
        }
    }
    
    def __init__(self):
        super().__init__('MetadataService')
        # Cache pour éviter les requêtes répétées
        self._fallback_user_id: Optional[int] = None
        self._cached_apps: Optional[List[str]] = None
    
    def export_metadata(self, export_path: Path, app_labels: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Exporte les métadonnées (structure) de la base de données
        
        Args:
            export_path: Chemin du fichier d'export
            app_labels: Liste des apps à exporter (toutes si None)
            
        Returns:
            Dictionnaire avec les statistiques d'export
        """
        self.start_operation("Export métadonnées")
        tmp_path: Optional[Path] = None
        
        try:
            # Préparation des apps à exporter
            apps_to_export = self._get_apps_to_export(app_labels)
            self.log_info(f"📦 Apps à exporter: {', '.join(apps_to_export)}")
            
            # Export avec Django dumpdata dans un fichier temporaire
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp_file:
                tmp_path = Path(tmp_file.name)
            
            management.call_command(
                'dumpdata',
                *apps_to_export,
                format='json',
                indent=2,
                output=str(tmp_path),
                use_natural_foreign_keys=True,
                use_natural_primary_keys=True,
                verbosity=0
            )
            
            # Déplacement vers le chemin final (shutil.move gère les cross-device links)
            import shutil
            shutil.move(str(tmp_path), str(export_path))
            tmp_path = None  # Éviter le nettoyage car déplacé
            
            # Statistiques (analyse une seule fois)
            file_size = export_path.stat().st_size
            metadata = self._analyze_export_file(export_path)
            
            stats = {
                'file_path': str(export_path),
                'file_size': file_size,
                'file_size_formatted': self.format_size(file_size),
                'apps_exported': apps_to_export,
                'models_count': metadata['models_count'],
                'records_count': metadata['records_count'],
                'checksum': self.calculate_checksum(export_path)
            }
            
            self.log_info(f"✅ Métadonnées exportées: {stats['records_count']} enregistrements, {stats['file_size_formatted']}")
            
            duration = self.end_operation("Export métadonnées")
            stats['duration_seconds'] = duration
            
            return stats
            
        except Exception as e:
            self.log_error("❌ Erreur lors de l'export des métadonnées", e)
            raise
        finally:
            # Nettoyage du fichier temporaire si nécessaire
            if tmp_path and tmp_path.exists():
                try:
                    tmp_path.unlink()
                except Exception as cleanup_error:
                    self.log_warning(f"⚠️ Impossible de nettoyer {tmp_path}: {cleanup_error}")
    
    def import_metadata(self, import_path: Path, restore_options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Importe les métadonnées depuis un fichier de sauvegarde
        
        Args:
            import_path: Chemin du fichier d'import
            restore_options: Options de restauration
            
        Returns:
            Dictionnaire avec les statistiques d'import
        """
        self.start_operation("Import métadonnées")
        preprocessed_file: Optional[Path] = None
        
        try:
            if not import_path.exists():
                raise FileNotFoundError(f"Fichier d'import introuvable: {import_path}")
            
            # Validation et analyse combinées pour éviter double lecture
            validation_and_metadata = self._validate_and_analyze_metadata(import_path)
            
            if not validation_and_metadata['valid']:
                return self._create_import_error_result(import_path, validation_and_metadata['error'])
            
            metadata = validation_and_metadata['metadata']
            self.log_info(f"📖 Fichier à importer: {metadata['records_count']} enregistrements")
            
            # Options de restauration
            options = restore_options or {}
            flush_before = options.get('flush_before', False)
            ignore_duplicates = options.get('ignore_duplicates', True)
            
            if flush_before:
                self.log_warning("🗑️ Suppression des données existantes (flush)")
                management.call_command('flush', interactive=False, verbosity=0)
            
            # Préprocesser les métadonnées pour corriger les problèmes
            preprocessed_file = self._preprocess_metadata_for_import(import_path)
            
            # Import avec Django loaddata
            loaddata_options = {'verbosity': 1}
            if ignore_duplicates:
                loaddata_options['ignore'] = True
            
            management.call_command('loaddata', str(preprocessed_file), **loaddata_options)
            
            # Statistiques de succès
            stats = {
                'file_path': str(import_path),
                'records_imported': metadata['records_count'],
                'models_imported': metadata['models_count'],
                'flush_before': flush_before,
                'ignore_duplicates': ignore_duplicates,
                'success': True
            }
            
            self.log_info(f"✅ Métadonnées importées: {stats['records_imported']} enregistrements")
            
            duration = self.end_operation("Import métadonnées")
            stats['duration_seconds'] = duration
            
            return stats
            
        except CommandError as django_error:
            error_msg = str(django_error)
            self.log_error(f"❌ Erreur Django lors de l'import: {error_msg}")
            
            return {
                'file_path': str(import_path),
                'records_imported': 0,
                'models_imported': 0,
                'error': error_msg,
                'success': False,
                'flush_before': restore_options.get('flush_before', False) if restore_options else False,
                'ignore_duplicates': restore_options.get('ignore_duplicates', True) if restore_options else True
            }
            
        except Exception as e:
            self.log_error("❌ Erreur lors de l'import des métadonnées", e)
            return self._create_import_error_result(import_path, str(e))
        finally:
            # Nettoyage du fichier temporaire si nécessaire
            if preprocessed_file and preprocessed_file != import_path and preprocessed_file.exists():
                try:
                    preprocessed_file.unlink()
                except Exception as cleanup_error:
                    self.log_warning(f"⚠️ Impossible de nettoyer {preprocessed_file}: {cleanup_error}")
    
    def get_database_schema(self) -> Dict[str, Any]:
        """
        Récupère le schéma actuel de la base de données
        
        Returns:
            Dictionnaire avec le schéma de la DB
        """
        self.start_operation("Analyse schéma base de données")
        
        try:
            schema = {
                'apps': {},
                'total_models': 0,
                'total_tables': 0
            }
            
            for app_config in apps.get_app_configs():
                if app_config.label in self.EXCLUDED_APPS:
                    continue
                
                app_models = self._extract_app_models(app_config)
                
                if app_models:
                    self._add_app_to_schema(schema, app_config, app_models)
            
            self.log_info(f"📊 Schéma analysé: {schema['total_models']} modèles dans {len(schema['apps'])} apps")
            
            self.end_operation("Analyse schéma base de données")
            return schema
            
        except Exception as e:
            self.log_error("❌ Erreur lors de l'analyse du schéma", e)
            raise
    
    def _extract_app_models(self, app_config) -> List[Dict[str, Any]]:
        """Extrait les modèles d'une app en filtrant les exclusions"""
        app_models = []
        
        for model in app_config.get_models():
            if model.__name__ in self.EXCLUDED_MODELS:
                continue
            
            model_fields = self._extract_model_fields(model)
            
            app_models.append({
                'name': model.__name__,
                'table_name': model._meta.db_table,
                'fields': model_fields
            })
        
        return app_models
    
    def _extract_model_fields(self, model) -> List[Dict[str, Any]]:
        """Extrait les champs d'un modèle"""
        model_fields = []
        
        for field in model._meta.get_fields():
            if hasattr(field, 'column'):
                model_fields.append({
                    'name': field.name,
                    'type': field.__class__.__name__,
                    'column': field.column
                })
        
        return model_fields
    
    def _add_app_to_schema(self, schema: Dict[str, Any], app_config, app_models: List[Dict[str, Any]]) -> None:
        """Ajoute une app au schéma avec ses modèles"""
        models_count = len(app_models)
        schema['apps'][app_config.label] = {
            'name': app_config.name,
            'models': app_models,
            'models_count': models_count
        }
        schema['total_models'] += models_count
        schema['total_tables'] += models_count
    
    def _get_apps_to_export(self, app_labels: Optional[List[str]]) -> List[str]:
        """Détermine les apps à exporter avec cache"""
        if app_labels:
            return [label for label in app_labels if label not in self.EXCLUDED_APPS]
        
        # Cache pour éviter de recalculer à chaque fois
        if self._cached_apps is None:
            all_apps = [app.label for app in apps.get_app_configs()]
            self._cached_apps = [app for app in all_apps if app not in self.EXCLUDED_APPS]
        
        return self._cached_apps.copy()
    
    def _validate_and_analyze_metadata(self, file_path: Path) -> Dict[str, Any]:
        """Validation et analyse combinées pour éviter double lecture"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Vérifier que c'est bien un format Django fixture
            if not isinstance(data, list):
                return {
                    'valid': False,
                    'error': "Le fichier de métadonnées doit contenir un tableau JSON",
                    'metadata': {'records_count': 0, 'models_count': 0, 'models': []}
                }
            
            records_count = len(data)
            models = set()
            
            # Validation optimisée : ne valider qu'un échantillon pour les gros fichiers
            validation_items = min(records_count, self.MAX_VALIDATION_ITEMS)
            
            for i in range(validation_items):
                item = data[i]
                
                if not isinstance(item, dict):
                    return {
                        'valid': False,
                        'error': f"Objet {i} invalide: doit être un dictionnaire",
                        'metadata': {'records_count': 0, 'models_count': 0, 'models': []}
                    }
                
                if 'model' not in item:
                    return {
                        'valid': False,
                        'error': f"Objet {i} invalide: champ 'model' manquant",
                        'metadata': {'records_count': 0, 'models_count': 0, 'models': []}
                    }
                
                if 'fields' not in item:
                    return {
                        'valid': False,
                        'error': f"Objet {i} invalide: champ 'fields' manquant",
                        'metadata': {'records_count': 0, 'models_count': 0, 'models': []}
                    }
                
                models.add(item['model'])
            
            # Analyser le reste pour les modèles (sans validation complète)
            for item in data[validation_items:]:
                if isinstance(item, dict) and 'model' in item:
                    models.add(item['model'])
            
            validation_message = f"✅ Format validé: {records_count} objets"
            if validation_items < records_count:
                validation_message += f" (échantillon de {validation_items} validé)"
            
            self.log_info(validation_message)
            
            return {
                'valid': True,
                'error': None,
                'metadata': {
                    'records_count': records_count,
                    'models_count': len(models),
                    'models': list(models)
                }
            }
            
        except json.JSONDecodeError as format_error:
            return {
                'valid': False,
                'error': f"Format invalide: {str(format_error)}",
                'metadata': {'records_count': 0, 'models_count': 0, 'models': []}
            }
        except Exception as e:
            return {
                'valid': False,
                'error': f"Erreur de validation: {str(e)}",
                'metadata': {'records_count': 0, 'models_count': 0, 'models': []}
            }
    
    def _analyze_export_file(self, file_path: Path) -> Dict[str, Any]:
        """Analyse un fichier d'export pour extraire les métadonnées (version rapide)"""
        try:
            data = self.load_json_file(file_path)
            
            if isinstance(data, list):
                records_count = len(data)
                models = {record['model'] for record in data if isinstance(record, dict) and 'model' in record}
                
                return {
                    'records_count': records_count,
                    'models_count': len(models),
                    'models': list(models)
                }
            
            return {'records_count': 0, 'models_count': 0, 'models': []}
            
        except Exception as e:
            self.log_warning(f"⚠️ Impossible d'analyser le fichier d'export: {e}")
            return {'records_count': 0, 'models_count': 0, 'models': []}
    
    def _create_import_error_result(self, import_path: Path, error: str) -> Dict[str, Any]:
        """Crée un résultat d'erreur standardisé pour l'import"""
        return {
            'file_path': str(import_path),
            'records_imported': 0,
            'models_imported': 0,
            'error': error,
            'success': False
        }
    
    def _preprocess_metadata_for_import(self, import_path: Path) -> Path:
        """Préprocesseur les métadonnées pour corriger les problèmes de schéma et ordre d'import"""
        try:
            # Charger les données (une seule fois)
            with open(import_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                return import_path
            
            # Optimisation : traitement en une seule passe
            username_to_id_map = self._build_username_mapping(data)
            fallback_user_id = self._get_fallback_user_id()
            data_by_model = self._organize_data_by_model(data)
            
            processed_data = []
            modifications_count = 0
            
            # Traiter les modèles dans l'ordre défini
            for model_name in self.IMPORT_ORDER:
                if model_name in data_by_model:
                    for record in data_by_model[model_name]:
                        processed_record, mods = self._process_record(
                            record, model_name, username_to_id_map, fallback_user_id
                        )
                        processed_data.append(processed_record)
                        modifications_count += mods
                    
                    del data_by_model[model_name]
            
            # Ajouter les modèles non ordonnés
            for remaining_model, records in data_by_model.items():
                self.log_info(f"⚠️ Modèle non ordonné ajouté: {remaining_model}")
                for record in records:
                    processed_record, mods = self._process_record(
                        record, remaining_model, username_to_id_map, fallback_user_id
                    )
                    processed_data.append(processed_record)
                    modifications_count += mods
            
            # Si aucune modification, retourner le fichier original
            if modifications_count == 0:
                self.log_info("✅ Aucune correction de schéma nécessaire")
                return import_path
            
            # Créer un fichier temporaire avec les corrections
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as temp_file:
                json.dump(processed_data, temp_file, indent=2, ensure_ascii=False)
                temp_path = Path(temp_file.name)
            
            self.log_info(f"🔧 Schéma corrigé: {modifications_count} modifications, fichier: {temp_path}")
            return temp_path
            
        except Exception as e:
            self.log_warning(f"⚠️ Erreur lors du préprocessing, utilisation du fichier original: {e}")
            self.log_debug(f"Stack trace: {traceback.format_exc()}")
            return import_path
    
    def _build_username_mapping(self, data: List[Dict[str, Any]]) -> Dict[str, int]:
        """Construit le mapping nom d'utilisateur -> ID de manière optimisée"""
        username_to_id_map = {}
        
        # Optimisation : traiter seulement les enregistrements d'utilisateurs
        for record in data:
            if (isinstance(record, dict) and 
                record.get('model') == 'authentication.user' and 
                'fields' in record and 
                'pk' in record):
                
                username = record['fields'].get('username')
                user_id = record['pk']
                if username and user_id:
                    username_to_id_map[username] = user_id
                    self.log_debug(f"🔍 Mapping utilisateur: {username} -> {user_id}")
        
        self.log_info(f"🗂️ Mapping utilisateurs créé: {len(username_to_id_map)} utilisateurs")
        return username_to_id_map
    
    def _get_fallback_user_id(self) -> int:
        """Obtient l'ID de l'utilisateur de fallback avec cache"""
        if self._fallback_user_id is None:
            user_model = get_user_model()
            fallback_user = user_model.objects.filter(is_staff=True, is_active=True).first()
            self._fallback_user_id = fallback_user.id if fallback_user else 1
            
            self.log_info(f"🔄 Utilisateur de fallback: ID {self._fallback_user_id}")
        
        return self._fallback_user_id
    
    def _organize_data_by_model(self, data: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Organise les données par modèle de manière optimisée"""
        data_by_model: Dict[str, List[Dict[str, Any]]] = {}
        
        for record in data:
            if not isinstance(record, dict) or 'model' not in record or 'fields' not in record:
                continue
            
            model_name = record['model']
            if model_name not in data_by_model:
                data_by_model[model_name] = []
            data_by_model[model_name].append(record)
        
        return data_by_model
    
    def _process_record(self, record: Dict[str, Any], model_name: str, username_mapping: Dict[str, int], fallback_user_id: int) -> Tuple[Dict[str, Any], int]:
        """Traite un enregistrement individuel avec type hints précis"""
        fields = record['fields'].copy()
        modifications_count = 0
        
        # Appliquer les corrections de schéma
        if model_name in self.SCHEMA_FIXES:
            fixes = self.SCHEMA_FIXES[model_name]
            for field_name, default_value in fixes.items():
                if field_name not in fields:
                    fields[field_name] = default_value
                    modifications_count += 1
                    self.log_info(f"🔧 Ajout champ manquant {field_name}={default_value} pour {model_name}")
        
        # Convertir les références utilisateur
        for field_name, field_value in list(fields.items()):
            if self._is_user_reference_field(field_name, field_value):
                new_value, modified = self._convert_user_reference(
                    field_name, field_value, username_mapping, fallback_user_id, model_name
                )
                if modified:
                    fields[field_name] = new_value
                    modifications_count += 1
        
        # Créer l'enregistrement corrigé
        corrected_record = {
            'model': record['model'],
            'fields': fields
        }
        
        # Ajouter pk seulement s'il existe et n'est pas None
        if record.get('pk') is not None:
            corrected_record['pk'] = record['pk']
        
        return corrected_record, modifications_count
    
    def _is_user_reference_field(self, field_name: str, field_value: Any) -> bool:
        """Détermine si un champ est une référence utilisateur de manière optimisée"""
        if field_name == 'created_by':
            return isinstance(field_value, list) and len(field_value) > 0
        elif field_name.endswith('_user'):
            return isinstance(field_value, list) and len(field_value) > 0
        elif field_name.endswith('_id'):
            return field_value == '' or (isinstance(field_value, list) and len(field_value) == 0)
        return False
    
    def _convert_user_reference(self, field_name: str, field_value: Any, username_mapping: Dict[str, int], fallback_user_id: int, model_name: str) -> Tuple[Union[int, None], bool]:
        """Convertit une référence utilisateur avec type hints précis"""
        if field_name == 'created_by' and isinstance(field_value, list) and len(field_value) > 0:
            username = field_value[0]
            if username in username_mapping:
                user_id = username_mapping[username]
                self.log_info(f"🔧 Conversion référence utilisateur: {model_name}.{field_name} [{username}] -> {user_id}")
                return user_id, True
            else:
                self.log_warning(f"⚠️ Utilisateur {username} non trouvé, utilisation du fallback ID {fallback_user_id}")
                return fallback_user_id, True
        
        elif field_name.endswith('_id') and (field_value == '' or (isinstance(field_value, list) and len(field_value) == 0)):
            if field_name == 'created_by_id':
                self.log_info(f"🔧 Conversion created_by_id vers fallback {fallback_user_id}: {model_name}")
                return fallback_user_id, True
            else:
                self.log_info(f"🔧 Conversion FK vide en null: {model_name}.{field_name}")
                return None, True
        
        return field_value, False
    
    def _preprocess_metadata_for_export(self, export_path: Path) -> Path:
        """Préprocesseur pour l'export (placeholder pour compatibilité)"""
        return export_path 