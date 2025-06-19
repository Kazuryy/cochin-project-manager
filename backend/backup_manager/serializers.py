"""
Serializers pour le système de sauvegarde/restauration
Séparation de la logique de sérialisation des vues pour une meilleure organisation
"""

from rest_framework import serializers
from .models import BackupConfiguration, BackupHistory, RestoreHistory, UploadedBackup, ExternalRestoration


class BackupConfigurationSerializer(serializers.ModelSerializer):
    """Serializer pour les configurations de sauvegarde"""
    
    class Meta:
        model = BackupConfiguration
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'created_by')


class BackupHistorySerializer(serializers.ModelSerializer):
    """Serializer pour l'historique des sauvegardes"""
    
    duration_formatted = serializers.ReadOnlyField()
    file_size_formatted = serializers.ReadOnlyField()
    
    class Meta:
        model = BackupHistory
        fields = '__all__'
        read_only_fields = ('created_at', 'created_by')


class RestoreHistorySerializer(serializers.ModelSerializer):
    """Serializer pour l'historique des restaurations"""
    
    duration_formatted = serializers.ReadOnlyField()
    
    class Meta:
        model = RestoreHistory
        fields = '__all__'
        read_only_fields = ('created_at', 'created_by')


class UploadedBackupSerializer(serializers.ModelSerializer):
    """
    🆕 Serializer pour les uploads externes.
    
    Gère les sauvegardes uploadées depuis l'extérieur avec validation
    et métadonnées sans interférer avec le système principal.
    """
    
    file_size_formatted = serializers.ReadOnlyField()
    uploaded_by_username = serializers.CharField(source='uploaded_by.username', read_only=True)
    
    class Meta:
        model = UploadedBackup
        fields = [
            'id', 'original_filename', 'upload_name', 'file_path', 'file_size',
            'file_size_formatted', 'file_checksum', 'status', 'validation_data',
            'backup_metadata', 'detected_backup_type', 'detected_source_system',
            'uploaded_at', 'error_message', 'processing_log', 'uploaded_by',
            'uploaded_by_username'
        ]
        read_only_fields = (
            'file_path', 'file_size', 'file_checksum', 'status', 'validation_data',
            'backup_metadata', 'detected_backup_type', 'detected_source_system',
            'uploaded_at', 'error_message', 'processing_log', 'uploaded_by'
        )
    
    def validate_upload_name(self, value):
        """Validation du nom d'upload"""
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Le nom doit contenir au moins 3 caractères.")
        
        # Éviter les caractères dangereux
        import re
        if not re.match(r'^[a-zA-Z0-9_\-\s]+$', value):
            raise serializers.ValidationError("Le nom ne peut contenir que des lettres, chiffres, tirets et espaces.")
        
        return value.strip()


class ExternalRestorationSerializer(serializers.ModelSerializer):
    """
    🆕 Serializer pour les restaurations externes.
    
    Gère les restaurations depuis uploads externes avec stratégies
    de fusion sécurisées et protection du système.
    """
    
    duration_formatted = serializers.ReadOnlyField()
    uploaded_backup_name = serializers.CharField(source='uploaded_backup.upload_name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = ExternalRestoration
        fields = [
            'id', 'uploaded_backup', 'uploaded_backup_name', 'restoration_name',
            'merge_strategy', 'restoration_options', 'status', 'progress_percentage',
            'current_step', 'external_tables_processed', 'external_records_processed',
            'external_files_processed', 'system_tables_preserved', 'conflicts_resolved',
            'started_at', 'completed_at', 'duration_seconds', 'duration_formatted',
            'execution_log', 'error_message', 'rollback_info', 'created_at',
            'created_by', 'created_by_username'
        ]
        read_only_fields = (
            'status', 'progress_percentage', 'current_step', 'external_tables_processed',
            'external_records_processed', 'external_files_processed', 'system_tables_preserved',
            'conflicts_resolved', 'started_at', 'completed_at', 'duration_seconds',
            'execution_log', 'error_message', 'rollback_info', 'created_at', 'created_by'
        )
    
    def validate_merge_strategy(self, value):
        """Validation de la stratégie de fusion"""
        # Par sécurité, interdire 'replace' en production
        if value == 'replace':
            raise serializers.ValidationError(
                "La stratégie 'replace' est désactivée pour la sécurité. "
                "Utilisez 'preserve_system' ou 'merge'."
            )
        return value
    
    def validate_uploaded_backup(self, value):
        """Validation de la sauvegarde uploadée"""
        if value.status != 'ready':
            raise serializers.ValidationError(
                f"La sauvegarde uploadée doit être prête (statut: {value.status})"
            )
        return value


class ExternalUploadRequestSerializer(serializers.Serializer):
    """
    🆕 Serializer pour les requêtes d'upload externe.
    
    Gère la validation des données d'upload sans créer d'objet.
    """
    
    upload_name = serializers.CharField(
        max_length=200,
        help_text="Nom d'identification pour cet upload"
    )
    file = serializers.FileField(
        help_text="Fichier de sauvegarde à uploader (.zip, .encrypted)"
    )
    
    def validate_upload_name(self, value):
        """Validation du nom d'upload"""
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Le nom doit contenir au moins 3 caractères.")
        
        import re
        if not re.match(r'^[a-zA-Z0-9_\-\s]+$', value):
            raise serializers.ValidationError(
                "Le nom ne peut contenir que des lettres, chiffres, tirets et espaces."
            )
        
        return value.strip()
    
    def validate_file(self, value):
        """Validation du fichier uploadé"""
        # Vérifier l'extension
        allowed_extensions = ['.zip', '.encrypted']
        file_name = value.name.lower()
        
        if not any(file_name.endswith(ext) for ext in allowed_extensions):
            raise serializers.ValidationError(
                f"Type de fichier non supporté. Formats acceptés: {', '.join(allowed_extensions)}"
            )
        
        # Vérifier la taille (limite: 500 MB)
        max_size = 500 * 1024 * 1024  # 500 MB
        if value.size > max_size:
            raise serializers.ValidationError(
                f"Fichier trop volumineux. Taille maximale: {max_size // (1024*1024)} MB"
            )
        
        return value


class ExternalRestorationRequestSerializer(serializers.Serializer):
    """
    🆕 Serializer pour les requêtes de restauration externe.
    
    Gère la validation des paramètres de restauration.
    """
    
    uploaded_backup_id = serializers.IntegerField(
        help_text="ID de la sauvegarde uploadée à restaurer"
    )
    merge_strategy = serializers.ChoiceField(
        choices=['preserve_system', 'merge'],
        default='preserve_system',
        help_text="Stratégie de fusion sécurisée"
    )
    restoration_options = serializers.JSONField(
        required=False,
        default=dict,
        help_text="Options avancées de restauration"
    )
    
    def validate_uploaded_backup_id(self, value):
        """Validation de l'ID de sauvegarde uploadée"""
        try:
            uploaded_backup = UploadedBackup.objects.get(id=value)
            if uploaded_backup.status != 'ready':
                raise serializers.ValidationError(
                    f"Sauvegarde non prête pour restauration (statut: {uploaded_backup.status})"
                )
            return value
        except UploadedBackup.DoesNotExist:
            raise serializers.ValidationError("Sauvegarde uploadée introuvable")
    
    def validate_merge_strategy(self, value):
        """Validation de la stratégie"""
        if value == 'replace':
            raise serializers.ValidationError(
                "Stratégie 'replace' désactivée pour la sécurité"
            )
        return value 