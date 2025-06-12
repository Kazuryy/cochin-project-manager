"""
Service de chiffrement pour les sauvegardes
"""

import os
import hashlib
from pathlib import Path
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from django.conf import settings
from .base_service import BaseService
import base64


class EncryptionService(BaseService):
    """Service pour chiffrer/déchiffrer les sauvegardes"""
    
    # Constantes de sécurité
    SALT_SIZE = 32
    KEY_ITERATIONS = 100000
    CHUNK_SIZE = 64 * 1024  # 64KB pour traitement par chunks
    
    def __init__(self):
        super().__init__('EncryptionService')
    
    def encrypt_file(self, source_path: Path, dest_path: Path, password: Optional[str] = None) -> None:
        """
        Chiffre un fichier avec AES-256
        
        Args:
            source_path: Fichier source à chiffrer
            dest_path: Fichier de destination chiffré
            password: Mot de passe (utilise la clé par défaut si None)
        """
        self.log_info(f"🔐 Chiffrement de {source_path.name}")
        
        try:
            # Génération du sel et de la clé
            salt = os.urandom(self.SALT_SIZE)
            key = self._derive_key(password or self._get_default_password(), salt)
            
            # Initialisation du chiffreur
            fernet = Fernet(key)
            
            # Lecture et chiffrement par chunks pour les gros fichiers
            with open(source_path, 'rb') as source_file, open(dest_path, 'wb') as dest_file:
                # Écrire le sel en premier
                dest_file.write(salt)
                
                # Chiffrement par chunks
                while True:
                    chunk = source_file.read(self.CHUNK_SIZE)
                    if not chunk:
                        break
                    
                    encrypted_chunk = fernet.encrypt(chunk)
                    # Écrire la taille du chunk puis le chunk chiffré
                    dest_file.write(len(encrypted_chunk).to_bytes(4, 'big'))
                    dest_file.write(encrypted_chunk)
            
            self.log_info(f"✅ Fichier chiffré: {dest_path}")
            
        except Exception as e:
            self.log_error("❌ Erreur lors du chiffrement", e)
            raise
    
    def decrypt_file(self, source_path: Path, dest_path: Path, password: Optional[str] = None) -> None:
        """
        Déchiffre un fichier
        
        Args:
            source_path: Fichier chiffré source
            dest_path: Fichier de destination déchiffré
            password: Mot de passe (utilise la clé par défaut si None)
        """
        self.log_info(f"🔓 Déchiffrement de {source_path.name}")
        
        try:
            with open(source_path, 'rb') as source_file, open(dest_path, 'wb') as dest_file:
                # Extraction du sel
                salt = source_file.read(self.SALT_SIZE)
                
                # Dérivation de la clé
                key = self._derive_key(password or self._get_default_password(), salt)
                fernet = Fernet(key)
                
                # Déchiffrement par chunks
                while True:
                    # Lire la taille du chunk
                    size_bytes = source_file.read(4)
                    if len(size_bytes) < 4:
                        break
                    
                    chunk_size = int.from_bytes(size_bytes, 'big')
                    encrypted_chunk = source_file.read(chunk_size)
                    
                    if not encrypted_chunk:
                        break
                    
                    decrypted_chunk = fernet.decrypt(encrypted_chunk)
                    dest_file.write(decrypted_chunk)
            
            self.log_info(f"✅ Fichier déchiffré: {dest_path}")
            
        except Exception as e:
            self.log_error("❌ Erreur lors du déchiffrement", e)
            raise
    
    def _derive_key(self, password: str, salt: bytes) -> bytes:
        """Dérive une clé de chiffrement à partir du mot de passe"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=self.KEY_ITERATIONS,
        )
        key = kdf.derive(password.encode('utf-8'))
        # Encode la clé en base64 pour Fernet
        return base64.urlsafe_b64encode(key)
    
    def _get_default_password(self) -> str:
        """Obtient le mot de passe par défaut depuis les settings"""
        return getattr(settings, 'BACKUP_ENCRYPTION_KEY', 'default-backup-key-change-me')
    
    def generate_user_based_key(self, user, additional_password: Optional[str] = None) -> str:
        """
        Génère une clé de chiffrement basée sur l'utilisateur
        
        Args:
            user: Utilisateur Django
            additional_password: Mot de passe additionnel optionnel
            
        Returns:
            Clé de chiffrement dérivée
        """
        # Clé de base : utilisateur + clé système
        base_string = f"{user.username}:{user.id}:{self._get_default_password()}"
        
        # Si mot de passe additionnel, l'intégrer
        if additional_password:
            base_string += f":{additional_password}"
            
        # Générer une clé robuste
        return hashlib.sha256(base_string.encode('utf-8')).hexdigest()
    
    def hash_password(self, password: str) -> str:
        """Hash un mot de passe pour stockage sécurisé"""
        return hashlib.sha256(password.encode('utf-8')).hexdigest()
    
    def verify_password(self, password: str, password_hash: str) -> bool:
        """Vérifie un mot de passe contre son hash"""
        return self.hash_password(password) == password_hash
    
    @staticmethod
    def generate_key_from_password(password: str) -> str:
        """Génère une clé de chiffrement forte à partir d'un mot de passe"""
        return hashlib.sha256(password.encode('utf-8')).hexdigest()
    
    def verify_encrypted_file(self, file_path: Path, password: Optional[str] = None) -> bool:
        """
        Vérifie si un fichier chiffré peut être déchiffré
        
        Args:
            file_path: Chemin du fichier chiffré
            password: Mot de passe à tester
            
        Returns:
            True si le fichier peut être déchiffré
        """
        try:
            with open(file_path, 'rb') as f:
                salt = f.read(self.SALT_SIZE)
                # Lire seulement la taille du premier chunk pour le test
                size_bytes = f.read(4)
                if len(size_bytes) < 4:
                    return False
                
                chunk_size = int.from_bytes(size_bytes, 'big')
                encrypted_data = f.read(min(chunk_size, 1024))  # Test sur maximum 1KB
            
            key = self._derive_key(password or self._get_default_password(), salt)
            fernet = Fernet(key)
            fernet.decrypt(encrypted_data)
            
            return True
            
        except Exception:
            return False
    
    def generate_system_key(self, user) -> bytes:
        """
        Génère une clé de chiffrement système transparente
        Basée sur SECRET_KEY + données utilisateur
        """
        # Combinaison sécurisée pour clé unique
        key_material = f"{settings.SECRET_KEY}_{user.id}_{user.username}".encode()
        
        # Utiliser un salt unique par utilisateur pour éviter les attaques
        user_salt = f"backup_salt_user_{user.id}".encode()
        
        # Dérivation de clé sécurisée avec PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=user_salt,
            iterations=self.KEY_ITERATIONS,
        )
        return kdf.derive(key_material)
    
    def encrypt_file_with_key(self, source_path: Path, dest_path: Path, key: bytes) -> None:
        """
        Chiffre un fichier avec AES-256 en utilisant une clé bytes directement
        
        Args:
            source_path: Fichier source à chiffrer
            dest_path: Fichier de destination chiffré
            key: Clé de chiffrement (bytes, 32 octets pour AES-256)
        """
        self.log_info(f"🔐 Chiffrement de {source_path.name}")
        
        try:
            # Vérification de la longueur de la clé
            if len(key) != 32:
                raise ValueError(f"La clé doit faire exactement 32 octets, reçu {len(key)}")
            
            # Encodage de la clé pour Fernet
            fernet_key = base64.urlsafe_b64encode(key)
            fernet = Fernet(fernet_key)
            
            # Chiffrement par chunks pour optimiser la mémoire
            with open(source_path, 'rb') as source_file, open(dest_path, 'wb') as dest_file:
                # Chiffrement par chunks (pas de sel nécessaire)
                while True:
                    chunk = source_file.read(self.CHUNK_SIZE)
                    if not chunk:
                        break
                    
                    encrypted_chunk = fernet.encrypt(chunk)
                    # Écrire la taille du chunk puis le chunk chiffré
                    dest_file.write(len(encrypted_chunk).to_bytes(4, 'big'))
                    dest_file.write(encrypted_chunk)
            
            self.log_info(f"✅ Fichier chiffré: {dest_path}")
            
        except Exception as e:
            self.log_error("❌ Erreur lors du chiffrement", e)
            raise
    
    def decrypt_file_with_key(self, source_path: Path, dest_path: Path, key: bytes) -> None:
        """
        Déchiffre un fichier en utilisant une clé bytes directement
        
        Args:
            source_path: Fichier chiffré source
            dest_path: Fichier de destination déchiffré
            key: Clé de déchiffrement (bytes, 32 octets pour AES-256)
        """
        self.log_info(f"🔓 Déchiffrement de {source_path.name}")
        
        try:
            # Vérification de la longueur de la clé
            if len(key) != 32:
                raise ValueError(f"La clé doit faire exactement 32 octets, reçu {len(key)}")
            
            with open(source_path, 'rb') as source_file, open(dest_path, 'wb') as dest_file:
                # Encodage de la clé pour Fernet
                fernet_key = base64.urlsafe_b64encode(key)
                fernet = Fernet(fernet_key)
                
                # Déchiffrement par chunks (pas de sel à ignorer)
                while True:
                    # Lire la taille du chunk
                    size_bytes = source_file.read(4)
                    if len(size_bytes) < 4:
                        break
                    
                    chunk_size = int.from_bytes(size_bytes, 'big')
                    encrypted_chunk = source_file.read(chunk_size)
                    
                    if not encrypted_chunk:
                        break
                    
                    decrypted_chunk = fernet.decrypt(encrypted_chunk)
                    dest_file.write(decrypted_chunk)
            
            self.log_info(f"✅ Fichier déchiffré: {dest_path}")
            
        except Exception as e:
            self.log_error("❌ Erreur lors du déchiffrement", e)
            raise 