from django.db import models
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
import hashlib


def validate_retention_days(value):
    """Valide que la période de rétention est sensée (au moins 1 jour)"""
    if value < 1:
        raise ValidationError('La période de rétention doit être d\'au moins 1 jour.')


class BackupConfiguration(models.Model):
    """
    Configuration des sauvegardes avec validation métier et optimisations.
    
    Cette classe gère les configurations de sauvegarde avec validation
    automatique des paramètres et optimisations pour les requêtes fréquentes.
    """
    
    BACKUP_TYPES = [
        ('full', 'Complète'),
        ('metadata', 'Métadonnées seulement'),
        ('data', 'Données seulement'),
    ]
    
    FREQUENCY_CHOICES = [
        ('daily', 'Quotidienne'),
        ('weekly', 'Hebdomadaire'),
        ('monthly', 'Mensuelle'),
        ('manual', 'Manuelle'),
    ]
    
    name = models.CharField(
        max_length=100, 
        verbose_name="Nom de la configuration",
        help_text="Nom unique pour identifier cette configuration"
    )
    backup_type = models.CharField(
        max_length=20, 
        choices=BACKUP_TYPES, 
        default='full',
        db_index=True  # Index pour optimiser les filtres par type
    )
    frequency = models.CharField(
        max_length=20, 
        choices=FREQUENCY_CHOICES, 
        default='manual',
        db_index=True  # Index pour optimiser les requêtes de planification
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True  # Index pour filtrer rapidement les configs actives
    )
    include_files = models.BooleanField(default=True, verbose_name="Inclure les fichiers")
    compression_enabled = models.BooleanField(default=True, verbose_name="Compression")
    retention_days = models.PositiveIntegerField(
        default=30, 
        verbose_name="Rétention (jours)",
        validators=[validate_retention_days],
        help_text="Nombre de jours de conservation des sauvegardes (minimum 1)"
    )
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='backup_configurations'
    )
    
    class Meta:
        verbose_name = "Configuration de sauvegarde"
        verbose_name_plural = "Configurations de sauvegarde"
        # Index composé pour optimiser les requêtes fréquentes
        indexes = [
            models.Index(fields=['is_active', 'frequency'], name='active_frequency_idx'),
            models.Index(fields=['created_by', 'is_active'], name='user_active_configs_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'created_by'], 
                name='unique_config_name_per_user'
            )
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_backup_type_display()})"
    
    def clean(self):
        """Validation personnalisée du modèle"""
        super().clean()
        if self.frequency != 'manual' and not self.is_active:
            raise ValidationError(
                'Une configuration avec une fréquence automatique doit être active.'
            )
    
    def get_active_backups_count(self):
        """Retourne le nombre de sauvegardes actives pour cette configuration"""
        return self.backuphistory_set.filter(
            status__in=['pending', 'running']
        ).count()


class BackupHistory(models.Model):
    """
    Historique des sauvegardes avec calculs automatiques et optimisations.
    
    Cette classe trace l'historique complet des sauvegardes avec des
    méthodes utilitaires pour le calcul automatique des durées et statistiques.
    """
    
    BACKUP_TYPE_CHOICES = [
        ('full', 'Complète'),
        ('data', 'Données uniquement'),
        ('metadata', 'Métadonnées uniquement'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('running', 'En cours'),
        ('completed', 'Terminée'),
        ('failed', 'Échec'),
        ('file_missing', 'Fichier manquant'),
    ]
    
    configuration = models.ForeignKey(
        BackupConfiguration, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='backup_histories'
    )
    backup_name = models.CharField(max_length=200, verbose_name="Nom de la sauvegarde")
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='pending',
        db_index=True  # Index pour filtrer par statut
    )
    backup_type = models.CharField(
        max_length=20, 
        choices=BACKUP_TYPE_CHOICES,
        db_index=True
    )
    
    # Métadonnées de la sauvegarde
    file_path = models.CharField(max_length=500, blank=True, verbose_name="Chemin du fichier")
    file_size = models.BigIntegerField(
        null=True, 
        blank=True, 
        verbose_name="Taille (bytes)",
        help_text="Taille du fichier de sauvegarde en bytes"
    )
    checksum = models.CharField(
        max_length=64, 
        blank=True, 
        verbose_name="Checksum SHA-256",
        help_text="Empreinte SHA-256 pour vérifier l'intégrité"
    )
    
    # Statistiques
    tables_count = models.PositiveIntegerField(null=True, blank=True)
    records_count = models.PositiveIntegerField(null=True, blank=True)
    files_count = models.PositiveIntegerField(null=True, blank=True)
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    
    # Logs et erreurs
    log_data = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='created_backups'
    )
    
    class Meta:
        verbose_name = "Historique de sauvegarde"
        verbose_name_plural = "Historique des sauvegardes"
        ordering = ['-created_at']
        # Indexes composés pour optimiser les requêtes courantes
        indexes = [
            models.Index(fields=['status', 'created_at'], name='status_date_idx'),
            models.Index(fields=['backup_type', 'status'], name='type_status_idx'),
            models.Index(fields=['created_by', 'status'], name='user_status_idx'),
        ]
    
    def __str__(self):
        return f"{self.backup_name} - {self.get_status_display()}"
    
    def save(self, *args, **kwargs):
        """Override save pour calculer automatiquement la durée"""
        if self.started_at and self.completed_at and not self.duration_seconds:
            delta = self.completed_at - self.started_at
            self.duration_seconds = int(delta.total_seconds())
        super().save(*args, **kwargs)
    
    def start_backup(self):
        """Démarre la sauvegarde en mettant à jour le statut et l'heure de début"""
        self.status = 'running'
        self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at'])
    
    def complete_backup(self, success=True, error_message=None):
        """Termine la sauvegarde avec le statut approprié"""
        self.completed_at = timezone.now()
        self.status = 'completed' if success else 'failed'
        if error_message:
            self.error_message = error_message
        self.save(update_fields=['completed_at', 'status', 'error_message', 'duration_seconds'])
    
    def calculate_checksum(self):
        """Calcule le checksum SHA-256 du fichier de sauvegarde"""
        if not self.file_path:
            return None
        
        try:
            hash_sha256 = hashlib.sha256()
            with open(self.file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_sha256.update(chunk)
            self.checksum = hash_sha256.hexdigest()
            self.save(update_fields=['checksum'])
            return self.checksum
        except (FileNotFoundError, PermissionError):
            return None
    
    @property
    def duration_formatted(self):
        """Retourne la durée formatée en format lisible"""
        if self.duration_seconds:
            hours = self.duration_seconds // 3600
            minutes = (self.duration_seconds % 3600) // 60
            seconds = self.duration_seconds % 60
            if hours:
                return f"{hours}h {minutes}m {seconds}s"
            elif minutes:
                return f"{minutes}m {seconds}s"
            else:
                return f"{seconds}s"
        return "—"
    
    @property
    def file_size_formatted(self):
        """Retourne la taille du fichier formatée en unités lisibles"""
        if not self.file_size:
            return "—"
        
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} PB"
    
    @property
    def is_expired(self):
        """Vérifie si cette sauvegarde a expiré selon la politique de rétention"""
        if not self.configuration or not self.configuration.retention_days:
            return False
        
        expiry_date = self.created_at + timezone.timedelta(
            days=self.configuration.retention_days
        )
        return timezone.now() > expiry_date


class RestoreHistory(models.Model):
    """
    Historique des restaurations avec méthodes utilitaires améliorées.
    
    Cette classe gère l'historique des restaurations avec des fonctionnalités
    avancées pour le suivi et la validation des opérations de restauration.
    """
    
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('running', 'En cours'),
        ('completed', 'Terminée'),
        ('failed', 'Échouée'),
        ('cancelled', 'Annulée'),
    ]
    
    RESTORE_TYPES = [
        ('full', 'Complète'),
        ('selective', 'Sélective'),
        ('merge', 'Fusion'),
    ]
    
    backup_source = models.ForeignKey(
        BackupHistory, 
        on_delete=models.CASCADE, 
        verbose_name="Sauvegarde source",
        related_name='restore_histories'
    )
    restore_name = models.CharField(max_length=200, verbose_name="Nom de la restauration")
    restore_type = models.CharField(
        max_length=20, 
        choices=RESTORE_TYPES, 
        default='full',
        db_index=True
    )
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='pending',
        db_index=True
    )
    
    # Options de restauration
    restore_options = models.JSONField(
        default=dict, 
        blank=True, 
        verbose_name="Options",
        help_text="Options JSON pour personnaliser la restauration"
    )
    
    # Statistiques
    tables_restored = models.PositiveIntegerField(null=True, blank=True)
    records_restored = models.PositiveIntegerField(null=True, blank=True)
    files_restored = models.PositiveIntegerField(null=True, blank=True)
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    
    # Logs et erreurs
    log_data = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='created_restores'
    )
    
    class Meta:
        verbose_name = "Historique de restauration"
        verbose_name_plural = "Historique des restaurations"
        ordering = ['-created_at']
        # Indexes pour optimiser les requêtes
        indexes = [
            models.Index(fields=['status', 'created_at'], name='restore_status_date_idx'),
            models.Index(fields=['restore_type', 'status'], name='restore_type_status_idx'),
        ]
    
    def __str__(self):
        return f"{self.restore_name} - {self.get_status_display()}"
    
    def save(self, *args, **kwargs):
        """Override save pour calculer automatiquement la durée"""
        if self.started_at and self.completed_at and not self.duration_seconds:
            delta = self.completed_at - self.started_at
            self.duration_seconds = int(delta.total_seconds())
        super().save(*args, **kwargs)
    
    def clean(self):
        """Validation personnalisée"""
        super().clean()
        if self.backup_source.status != 'completed':
            raise ValidationError(
                'Impossible de restaurer depuis une sauvegarde non terminée.'
            )
    
    def start_restore(self):
        """Démarre la restauration"""
        self.status = 'running'
        self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at'])
    
    def complete_restore(self, success=True, error_message=None):
        """Termine la restauration"""
        self.completed_at = timezone.now()
        self.status = 'completed' if success else 'failed'
        if error_message:
            self.error_message = error_message
        self.save(update_fields=['completed_at', 'status', 'error_message', 'duration_seconds'])
    
    @property
    def duration_formatted(self):
        """Retourne la durée formatée en format lisible"""
        if self.duration_seconds:
            hours = self.duration_seconds // 3600
            minutes = (self.duration_seconds % 3600) // 60
            seconds = self.duration_seconds % 60
            if hours:
                return f"{hours}h {minutes}m {seconds}s"
            elif minutes:
                return f"{minutes}m {seconds}s"
            else:
                return f"{seconds}s"
        return "—"
    
    @property
    def success_rate(self):
        """Calcule le taux de succès basé sur les éléments restaurés"""
        source_total = (
            (self.backup_source.tables_count or 0) +
            (self.backup_source.records_count or 0) +
            (self.backup_source.files_count or 0)
        )
        
        restored_total = (
            (self.tables_restored or 0) +
            (self.records_restored or 0) +
            (self.files_restored or 0)
        )
        
        if source_total == 0:
            return 0
        
        return (restored_total / source_total) * 100


class UploadedBackup(models.Model):
    """
    🆕 NOUVEAU: Modèle isolé pour les sauvegardes uploadées depuis l'extérieur.
    
    Ce modèle est COMPLÈTEMENT SÉPARÉ de BackupHistory pour éviter toute
    interférence lors des restaurations. Les uploads externes ne peuvent
    jamais écraser l'historique principal du système.
    """
    
    STATUS_CHOICES = [
        ('processing', 'Traitement en cours'),
        ('validated', 'Validée'),
        ('ready', 'Prête pour restauration'),
        ('failed_validation', 'Validation échouée'),
        ('corrupted', 'Fichier corrompu'),
    ]
    
    # Identification
    original_filename = models.CharField(max_length=255, verbose_name="Nom du fichier original")
    upload_name = models.CharField(max_length=200, verbose_name="Nom d'identification")
    
    # Métadonnées du fichier uploadé
    file_path = models.CharField(max_length=500, verbose_name="Chemin du fichier uploadé")
    file_size = models.BigIntegerField(verbose_name="Taille (bytes)")
    file_checksum = models.CharField(max_length=64, verbose_name="Checksum SHA-256")
    
    # État et validation
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='processing', db_index=True)
    validation_data = models.JSONField(default=dict, blank=True, verbose_name="Données de validation")
    
    # Contenu analysé (sans affecter le système principal)
    backup_metadata = models.JSONField(default=dict, blank=True, verbose_name="Métadonnées extraites")
    detected_backup_type = models.CharField(max_length=20, blank=True)
    detected_source_system = models.CharField(max_length=100, blank=True)
    
    # Traçabilité
    uploaded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='uploaded_backups'
    )
    
    # Erreurs et logs (isolés)
    error_message = models.TextField(blank=True)
    processing_log = models.JSONField(default=list, blank=True)
    
    class Meta:
        verbose_name = "Sauvegarde uploadée"
        verbose_name_plural = "Sauvegardes uploadées"
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['status', 'uploaded_at'], name='upload_status_date'),
            models.Index(fields=['uploaded_by', 'status'], name='upload_user_status'),
        ]
    
    def __str__(self):
        return f"Upload: {self.upload_name} ({self.get_status_display()})"
    
    @property
    def file_size_formatted(self):
        """Retourne la taille formatée"""
        if not self.file_size:
            return "—"
        
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} PB"
    
    def mark_as_ready(self):
        """Marque l'upload comme prêt pour restauration"""
        self.status = 'ready'
        self.save(update_fields=['status'])
    
    def mark_as_failed(self, error_message: str):
        """Marque l'upload comme échoué"""
        self.status = 'failed_validation'
        self.error_message = error_message
        self.save(update_fields=['status', 'error_message'])


class ExternalRestoration(models.Model):
    """
    🆕 NOUVEAU: Modèle isolé pour les restaurations depuis uploads externes.
    
    Ce modèle trace les restaurations d'uploads externes sans jamais
    créer de confusion avec RestoreHistory qui est réservé aux
    sauvegardes internes du système.
    """
    
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('extracting', 'Extraction en cours'),
        ('analyzing', 'Analyse du contenu'),
        ('executing', 'Exécution de la restauration'),
        ('finalizing', 'Finalisation'),
        ('completed', 'Terminée'),
        ('failed', 'Échouée'),
        ('cancelled', 'Annulée'),
    ]
    
    MERGE_STRATEGY_CHOICES = [
        ('replace', 'Remplacement complet'),
        ('merge', 'Fusion intelligente'),
        ('preserve_system', 'Préserver les données système'),
    ]
    
    # Source de la restauration
    uploaded_backup = models.ForeignKey(
        UploadedBackup, 
        on_delete=models.CASCADE,
        related_name='external_restorations'
    )
    
    # Configuration de la restauration
    restoration_name = models.CharField(max_length=200, verbose_name="Nom de la restauration")
    merge_strategy = models.CharField(
        max_length=20, 
        choices=MERGE_STRATEGY_CHOICES, 
        default='preserve_system',
        verbose_name="Stratégie de fusion"
    )
    
    # Options avancées (isolées du système principal)
    restoration_options = models.JSONField(
        default=dict, 
        blank=True,
        help_text="Options spécifiques pour cette restauration externe"
    )
    
    # État et progression
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    progress_percentage = models.PositiveIntegerField(default=0)
    current_step = models.CharField(max_length=100, blank=True)
    
    # Statistiques (isolées)
    external_tables_processed = models.PositiveIntegerField(null=True, blank=True)
    external_records_processed = models.PositiveIntegerField(null=True, blank=True)
    external_files_processed = models.PositiveIntegerField(null=True, blank=True)
    
    # Résultats de la fusion
    system_tables_preserved = models.PositiveIntegerField(null=True, blank=True)
    conflicts_resolved = models.PositiveIntegerField(null=True, blank=True)
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    
    # Logs et erreurs (isolés)
    execution_log = models.JSONField(default=list, blank=True)
    error_message = models.TextField(blank=True)
    rollback_info = models.JSONField(default=dict, blank=True)
    
    # Traçabilité
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='external_restorations'
    )
    
    class Meta:
        verbose_name = "Restauration externe"
        verbose_name_plural = "Restaurations externes"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at'], name='ext_restore_status'),
            models.Index(fields=['merge_strategy', 'status'], name='ext_merge_status'),
        ]
    
    def __str__(self):
        return f"Restauration externe: {self.restoration_name} ({self.get_status_display()})"
    
    def save(self, *args, **kwargs):
        """Override save pour calculer automatiquement la durée"""
        if self.started_at and self.completed_at and not self.duration_seconds:
            delta = self.completed_at - self.started_at
            self.duration_seconds = int(delta.total_seconds())
        super().save(*args, **kwargs)
    
    def start_restoration(self):
        """Démarre la restauration externe"""
        self.status = 'extracting'
        self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at'])
    
    def complete_restoration(self, success=True, error_message=None):
        """Termine la restauration externe"""
        self.completed_at = timezone.now()
        self.status = 'completed' if success else 'failed'
        self.progress_percentage = 100 if success else self.progress_percentage
        if error_message:
            self.error_message = error_message
        self.save(update_fields=['completed_at', 'status', 'progress_percentage', 'error_message', 'duration_seconds'])
    
    def update_progress(self, percentage: int, step: str = ""):
        """Met à jour la progression"""
        self.progress_percentage = min(max(percentage, 0), 100)
        if step:
            self.current_step = step
        self.save(update_fields=['progress_percentage', 'current_step'])
    
    @property
    def duration_formatted(self):
        """Retourne la durée formatée"""
        if self.duration_seconds:
            hours = self.duration_seconds // 3600
            minutes = (self.duration_seconds % 3600) // 60
            seconds = self.duration_seconds % 60
            if hours:
                return f"{hours}h {minutes}m {seconds}s"
            elif minutes:
                return f"{minutes}m {seconds}s"
            else:
                return f"{seconds}s"
        return "—"
