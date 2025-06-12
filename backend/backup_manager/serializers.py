"""
Serializers pour le système de sauvegarde/restauration
Séparation de la logique de sérialisation des vues pour une meilleure organisation
"""

from rest_framework import serializers
from .models import BackupConfiguration, BackupHistory, RestoreHistory


class BackupConfigurationSerializer(serializers.ModelSerializer):
    """Serializer pour les configurations de sauvegarde"""
    
    class Meta:
        model = BackupConfiguration
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'created_by')


class BackupHistorySerializer(serializers.ModelSerializer):
    """Serializer pour l'historique des sauvegardes"""
    
    duration_formatted = serializers.ReadOnlyField()
    
    class Meta:
        model = BackupHistory
        fields = '__all__'


class RestoreHistorySerializer(serializers.ModelSerializer):
    """Serializer pour l'historique des restaurations"""
    
    # Champs formatés
    duration_formatted = serializers.SerializerMethodField()
    backup_source_name = serializers.SerializerMethodField()
    
    class Meta:
        model = RestoreHistory
        fields = '__all__'
    
    def get_duration_formatted(self, obj):
        """Formate la durée pour l'affichage"""
        if not obj.duration_seconds:
            return "—"
        seconds = obj.duration_seconds
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        
        if hours > 0:
            return f"{hours}h {minutes}m {secs}s"
        elif minutes > 0:
            return f"{minutes}m {secs}s"
        else:
            return f"{secs}s"
    
    def get_backup_source_name(self, obj):
        """Nom de la sauvegarde source"""
        return obj.backup_source.backup_name if obj.backup_source else "—" 