"""
Service de validation de sécurité pour les uploads de sauvegardes
Système multi-couches contre les virus et malwares
"""

import os
import hashlib
import zipfile
import tempfile
import mimetypes
import subprocess
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from contextlib import contextmanager
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile

# Configuration du logger de sécurité
security_logger = logging.getLogger('django.security')

class SecurityValidationError(Exception):
    """Exception levée lors de la détection d'un problème de sécurité"""
    pass

class SecurityValidator:
    """
    Validateur de sécurité multi-couches pour les uploads de sauvegardes
    """
    
    # Extensions autorisées (très restrictif)
    ALLOWED_EXTENSIONS = {'.zip', '.encrypted'}
    
    # Taille maximale : 500 MB
    MAX_FILE_SIZE = 500 * 1024 * 1024
    
    # Taille de chunk pour lecture streaming (1MB)
    CHUNK_SIZE = 1024 * 1024
    
    # MIME types autorisés
    ALLOWED_MIME_TYPES = {
        'application/zip',
        'application/x-zip-compressed',
        'application/octet-stream'  # Pour les fichiers .encrypted
    }
    
    # Ratios de compression suspects
    MAX_COMPRESSION_RATIO_PER_FILE = 1000  # Ratio par fichier
    MAX_COMPRESSION_RATIO_GLOBAL = 100     # Ratio global
    
    # Timeouts pour les opérations
    ANTIVIRUS_TIMEOUT = 30  # secondes
    CLAMAV_CHECK_TIMEOUT = 5  # secondes
    
    # Signatures de fichiers dangereux (magic bytes)
    DANGEROUS_SIGNATURES = {
        b'MZ': 'Exécutable Windows (PE)',
        b'\x7fELF': 'Exécutable Linux (ELF)',
        b'\xca\xfe\xba\xbe': 'Exécutable Java',
        b'\xfe\xed\xfa\xce': 'Exécutable Mach-O (macOS)',
        b'\xce\xfa\xed\xfe': 'Exécutable Mach-O (macOS)',
        b'#!/bin/': 'Script shell',
        b'#!/usr/bin/': 'Script système',
        b'<?php': 'Script PHP',
        b'<%': 'Script ASP/JSP',
        b'<script': 'Script JavaScript',
        b'javascript:': 'JavaScript inline',
        b'vbscript:': 'VBScript',
        b'data:text/html': 'HTML embarqué',
        b'\x50\x4b\x03\x04': 'Archive ZIP (à vérifier)',  # Sera validé séparément
    }
    
    # Extensions dangereuses même zippées
    DANGEROUS_EXTENSIONS = {
        '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
        '.msi', '.dll', '.so', '.dylib', '.app', '.deb', '.rpm', '.dmg',
        '.iso', '.img', '.php', '.asp', '.jsp', '.py', '.pl', '.rb', '.sh',
        '.ps1', '.psm1', '.psd1', '.ps1xml', '.cpl', '.msc', '.reg'
    }
    
    # Noms de fichiers suspects
    SUSPICIOUS_FILENAMES = {
        'autorun.inf', 'desktop.ini', 'thumbs.db', '.htaccess', '.htpasswd',
        'web.config', 'global.asax', 'bin/sh', 'cmd.exe', 'powershell.exe',
        'wscript.exe', 'cscript.exe', 'regsvr32.exe', 'rundll32.exe'
    }
    
    def __init__(self):
        self.validation_results = {}
    
    def validate_upload(self, uploaded_file: UploadedFile, user) -> Dict[str, Any]:
        """
        Validation complète d'un fichier uploadé
        
        Args:
            uploaded_file: Fichier uploadé à valider
            user: Utilisateur qui upload le fichier
            
        Returns:
            Dict avec les résultats de validation et métadonnées
            
        Raises:
            SecurityValidationError: En cas d'erreur critique de validation
        """
        # Validation des paramètres d'entrée
        if not uploaded_file:
            raise SecurityValidationError("Fichier uploadé manquant")
        if not user:
            raise SecurityValidationError("Utilisateur manquant")
            
        security_logger.info(f"🔒 Début validation sécurité fichier: {uploaded_file.name} (utilisateur: {user.username})")
        
        validation_result = {
            'is_safe': False,
            'filename': uploaded_file.name,
            'file_size': uploaded_file.size,
            'mime_type': uploaded_file.content_type,
            'checks_passed': [],
            'security_warnings': [],
            'security_errors': [],
            'file_hash': None,
            'metadata': {}
        }
        
        try:
            # Phase 1: Validations de base
            self._validate_basic_properties(uploaded_file, validation_result)
            
            # Phase 2: Analyse du contenu binaire avec streaming
            with self._get_file_content_stream(uploaded_file) as content_stream:
                # Calcul du hash en streaming
                validation_result['file_hash'] = self._calculate_hash_stream(content_stream)
                
                # Reset du stream pour les analyses suivantes
                content_stream.seek(0)
                
                # Lecture des premiers bytes pour signature
                file_header = content_stream.read(16)
                content_stream.seek(0)
                
                self._validate_file_signature(file_header, validation_result)
                
                # Phase 3: Validation spécifique ZIP si applicable
                if self._is_zip_file(file_header):
                    self._validate_zip_content_stream(content_stream, validation_result)
                
                # Phase 4: Scan antivirus (si disponible)
                content_stream.seek(0)
                self._antivirus_scan_stream(content_stream, validation_result)
            
            # Phase 5: Validation finale
            validation_result['is_safe'] = (
                len(validation_result['security_errors']) == 0 and
                len(validation_result['checks_passed']) >= 4  # Minimum de vérifications réussies
            )
            
            if validation_result['is_safe']:
                security_logger.info(f"✅ Fichier validé avec succès: {uploaded_file.name}")
            else:
                security_logger.warning(f"❌ Fichier rejeté: {uploaded_file.name} - Erreurs: {validation_result['security_errors']}")
            
            return validation_result
            
        except SecurityValidationError:
            # Re-lever les erreurs de sécurité explicites
            raise
        except Exception as e:
            security_logger.error(f"🚨 Erreur critique lors de la validation: {uploaded_file.name} - {str(e)}")
            validation_result['security_errors'].append(f"Erreur de validation: {str(e)}")
            validation_result['is_safe'] = False
            return validation_result
    
    @contextmanager
    def _get_file_content_stream(self, uploaded_file: UploadedFile):
        """
        Gestionnaire de contexte pour obtenir un stream du contenu du fichier
        Utilise un fichier temporaire pour éviter de charger tout en mémoire
        """
        temp_file = None
        try:
            # Créer un fichier temporaire
            temp_file = tempfile.NamedTemporaryFile(delete=False)
            
            # Copier le contenu par chunks pour éviter les problèmes de mémoire
            uploaded_file.seek(0)
            while True:
                chunk = uploaded_file.read(self.CHUNK_SIZE)
                if not chunk:
                    break
                temp_file.write(chunk)
            
            temp_file.flush()
            temp_file.close()
            
            # Rouvrir en lecture
            with open(temp_file.name, 'rb') as f:
                yield f
                
        finally:
            # Nettoyage garanti du fichier temporaire
            if temp_file:
                try:
                    os.unlink(temp_file.name)
                except OSError:
                    security_logger.warning(f"Impossible de supprimer le fichier temporaire: {temp_file.name}")
            
            # Remettre le curseur du fichier uploadé au début
            uploaded_file.seek(0)
    
    def _validate_basic_properties(self, uploaded_file: UploadedFile, result: Dict) -> None:
        """Validation des propriétés de base du fichier"""
        
        # Vérifier la taille
        if uploaded_file.size > self.MAX_FILE_SIZE:
            result['security_errors'].append(f"Fichier trop volumineux: {uploaded_file.size} bytes (max: {self.MAX_FILE_SIZE})")
        else:
            result['checks_passed'].append('size_check')
        
        # Vérifier l'extension
        file_ext = Path(uploaded_file.name).suffix.lower()
        if file_ext not in self.ALLOWED_EXTENSIONS:
            result['security_errors'].append(f"Extension non autorisée: {file_ext}")
        else:
            result['checks_passed'].append('extension_check')
        
        # Vérifier le MIME type
        if uploaded_file.content_type not in self.ALLOWED_MIME_TYPES:
            result['security_warnings'].append(f"MIME type suspect: {uploaded_file.content_type}")
        else:
            result['checks_passed'].append('mime_check')
        
        # Vérifier le nom de fichier
        self._validate_filename(uploaded_file.name, result)
    
    def _validate_filename(self, filename: str, result: Dict) -> None:
        """Validation spécifique du nom de fichier"""
        filename_lower = filename.lower()
        
        # Vérifier les noms suspects
        if any(suspicious in filename_lower for suspicious in self.SUSPICIOUS_FILENAMES):
            result['security_errors'].append(f"Nom de fichier suspect: {filename}")
            return
        
        # Vérifier les caractères dangereux
        dangerous_chars = {'<', '>', ':', '"', '|', '?', '*', '\0'}
        if any(char in filename for char in dangerous_chars):
            result['security_errors'].append(f"Caractères dangereux dans le nom: {filename}")
            return
            
        result['checks_passed'].append('filename_check')
    
    def _calculate_hash_stream(self, stream) -> str:
        """Calcul du hash SHA-256 en streaming"""
        hasher = hashlib.sha256()
        
        stream.seek(0)
        while True:
            chunk = stream.read(self.CHUNK_SIZE)
            if not chunk:
                break
            hasher.update(chunk)
        
        return hasher.hexdigest()
    
    def _validate_file_signature(self, file_header: bytes, result: Dict) -> None:
        """Validation des signatures de fichier (magic bytes)"""
        
        # Vérifier les signatures dangereuses
        for signature, description in self.DANGEROUS_SIGNATURES.items():
            if signature == b'\x50\x4b\x03\x04':  # ZIP signature, sera validée séparément
                continue
                
            if file_header.startswith(signature):
                result['security_errors'].append(f"Signature dangereuse détectée: {description}")
                return
        
        # Vérifier la signature ZIP valide
        if file_header.startswith(b'\x50\x4b\x03\x04'):
            result['checks_passed'].append('zip_signature_check')
        elif file_header.startswith(b'Salted__'):  # Fichier chiffré OpenSSL
            result['checks_passed'].append('encrypted_signature_check')
        else:
            result['security_warnings'].append("Signature de fichier non reconnue")
    
    def _is_zip_file(self, file_header: bytes) -> bool:
        """Vérifie si le fichier est un ZIP valide"""
        return file_header.startswith(b'\x50\x4b\x03\x04')
    
    def _validate_zip_content_stream(self, stream, result: Dict) -> None:
        """Validation approfondie du contenu ZIP avec stream"""
        
        try:
            with zipfile.ZipFile(stream, 'r') as zip_ref:
                # Vérifier l'intégrité de l'archive
                bad_files = zip_ref.testzip()
                if bad_files:
                    result['security_errors'].append(f"Archive ZIP corrompue: {bad_files}")
                    return
                
                file_list = zip_ref.namelist()
                result['metadata']['zip_files_count'] = len(file_list)
                
                # Vérifier chaque fichier dans l'archive
                for file_path in file_list:
                    self._validate_zip_entry(file_path, result)
                    
                    # Arrêter l'analyse si des erreurs critiques sont trouvées
                    if result['security_errors']:
                        break
                
                # Vérifier les ratios de compression (détection zip bombs)
                if not result['security_errors']:
                    self._validate_compression_ratio(zip_ref, result)
                
                if not result['security_errors']:
                    result['checks_passed'].append('zip_content_check')
                    
        except zipfile.BadZipFile:
            result['security_errors'].append("Fichier ZIP invalide ou corrompu")
        except zipfile.LargeZipFile:
            result['security_errors'].append("Archive ZIP trop volumineuse")
        except Exception as e:
            result['security_errors'].append(f"Erreur lors de l'analyse ZIP: {str(e)}")
    
    def _validate_zip_entry(self, file_path: str, result: Dict) -> None:
        """Validation d'une entrée spécifique dans le ZIP"""
        
        # Vérifier les chemins suspects (path traversal)
        normalized_path = os.path.normpath(file_path)
        if '..' in file_path or file_path.startswith('/') or normalized_path != file_path:
            result['security_errors'].append(f"Chemin suspect dans ZIP: {file_path}")
            return
        
        # Vérifier les extensions dangereuses
        file_ext = Path(file_path).suffix.lower()
        if file_ext in self.DANGEROUS_EXTENSIONS:
            result['security_errors'].append(f"Extension dangereuse dans ZIP: {file_path}")
            return
        
        # Vérifier les noms de fichiers suspects
        filename = Path(file_path).name.lower()
        if filename in self.SUSPICIOUS_FILENAMES:
            result['security_errors'].append(f"Fichier suspect dans ZIP: {file_path}")
    
    def _validate_compression_ratio(self, zip_ref: zipfile.ZipFile, result: Dict) -> None:
        """Validation des ratios de compression (détection zip bombs)"""
        
        total_compressed = 0
        total_uncompressed = 0
        
        for info in zip_ref.infolist():
            total_compressed += info.compress_size
            total_uncompressed += info.file_size
            
            # Vérifier le ratio par fichier
            if info.compress_size > 0:
                ratio = info.file_size / info.compress_size
                if ratio > self.MAX_COMPRESSION_RATIO_PER_FILE:
                    result['security_warnings'].append(
                        f"Ratio de compression suspect: {info.filename} ({ratio:.1f}:1)"
                    )
        
        # Vérifier le ratio global
        if total_compressed > 0:
            global_ratio = total_uncompressed / total_compressed
            result['metadata']['compression_ratio'] = global_ratio
            
            if global_ratio > self.MAX_COMPRESSION_RATIO_GLOBAL:
                result['security_warnings'].append(
                    f"Ratio de compression global élevé: {global_ratio:.1f}:1"
                )
    
    def _antivirus_scan_stream(self, stream, result: Dict) -> None:
        """Scan antivirus avec stream (si ClamAV est disponible)"""
        
        try:
            # Vérifier si ClamAV est disponible
            if not self._check_clamav_available():
                result['security_warnings'].append("Scanner antivirus non disponible")
                return
            
            # Utiliser un gestionnaire de contexte pour le fichier temporaire
            with tempfile.NamedTemporaryFile() as temp_file:
                # Copier le stream vers le fichier temporaire
                stream.seek(0)
                while True:
                    chunk = stream.read(self.CHUNK_SIZE)
                    if not chunk:
                        break
                    temp_file.write(chunk)
                
                temp_file.flush()
                
                # Lancer le scan ClamAV
                try:
                    scan_result = subprocess.run(
                        ['clamscan', '--no-summary', temp_file.name],
                        capture_output=True,
                        text=True,
                        timeout=self.ANTIVIRUS_TIMEOUT
                    )
                    
                    if scan_result.returncode == 0:
                        result['checks_passed'].append('antivirus_scan')
                        security_logger.info("✅ Scan antivirus: fichier propre")
                    elif scan_result.returncode == 1:
                        # Virus détecté
                        virus_info = scan_result.stdout.strip()
                        result['security_errors'].append(f"VIRUS DÉTECTÉ: {virus_info}")
                        security_logger.critical(f"🦠 VIRUS DÉTECTÉ dans upload: {virus_info}")
                    else:
                        result['security_warnings'].append(
                            f"Erreur lors du scan antivirus (code: {scan_result.returncode})"
                        )
                        
                except subprocess.TimeoutExpired:
                    result['security_warnings'].append("Timeout du scan antivirus")
                    security_logger.warning("Timeout lors du scan antivirus")
                    
        except Exception as e:
            result['security_warnings'].append(f"Erreur scan antivirus: {str(e)}")
            security_logger.error(f"Erreur lors du scan antivirus: {str(e)}")
    
    def _check_clamav_available(self) -> bool:
        """Vérifie si ClamAV est disponible sur le système"""
        try:
            result = subprocess.run(
                ['clamscan', '--version'], 
                capture_output=True, 
                timeout=self.CLAMAV_CHECK_TIMEOUT,
                text=True
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, OSError):
            return False
    
    def create_security_report(self, validation_result: Dict) -> str:
        """
        Crée un rapport de sécurité détaillé
        
        Args:
            validation_result: Résultat de la validation
            
        Returns:
            Rapport formaté en string
        """
        if not validation_result:
            return "Aucun résultat de validation fourni"
        
        report = []
        report.append("=== RAPPORT DE SÉCURITÉ ===")
        report.append(f"Fichier: {validation_result.get('filename', 'N/A')}")
        report.append(f"Taille: {validation_result.get('file_size', 'N/A')} bytes")
        report.append(f"Hash SHA-256: {validation_result.get('file_hash', 'N/A')}")
        report.append(f"MIME Type: {validation_result.get('mime_type', 'N/A')}")
        report.append(f"Statut: {'✅ SÉCURISÉ' if validation_result.get('is_safe', False) else '❌ DANGEREUX'}")
        report.append("")
        
        checks_passed = validation_result.get('checks_passed', [])
        if checks_passed:
            report.append("Vérifications réussies:")
            for check in checks_passed:
                report.append(f"  ✅ {check}")
            report.append("")
        
        security_warnings = validation_result.get('security_warnings', [])
        if security_warnings:
            report.append("Avertissements:")
            for warning in security_warnings:
                report.append(f"  ⚠️ {warning}")
            report.append("")
        
        security_errors = validation_result.get('security_errors', [])
        if security_errors:
            report.append("ERREURS DE SÉCURITÉ:")
            for error in security_errors:
                report.append(f"  🚨 {error}")
            report.append("")
        
        metadata = validation_result.get('metadata', {})
        if metadata:
            report.append("Métadonnées:")
            for key, value in metadata.items():
                report.append(f"  • {key}: {value}")
        
        return "\n".join(report) 