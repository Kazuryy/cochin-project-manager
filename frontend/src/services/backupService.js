import api from './api';

/**
 * Service pour la gestion des sauvegardes et restaurations
 */
class BackupService {
  /**
   * Récupère la liste des configurations de sauvegarde
   */
  async getConfigurations() {
    return await api.get('/api/backup/configurations/');
  }

  /**
   * Crée une nouvelle configuration de sauvegarde
   */
  async createConfiguration(data) {
    return await api.post('/api/backup/configurations/', data);
  }

  /**
   * Met à jour une configuration de sauvegarde
   */
  async updateConfiguration(id, data) {
    return await api.put(`/api/backup/configurations/${id}/`, data);
  }

  /**
   * Supprime une configuration de sauvegarde
   */
  async deleteConfiguration(id) {
    return await api.delete(`/api/backup/configurations/${id}/`);
  }

  /**
   * Lance une sauvegarde
   */
  async createBackup(data) {
    return await api.post('/api/backup/create/', data);
  }

  /**
   * Lance une sauvegarde manuelle sans configuration
   */
  async createQuickBackup(backupType, options = {}) {
    const data = {
      backup_type: backupType,
      backup_name: `Sauvegarde_Rapide_${backupType}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`,
      ...options
    };
    return await api.post('/api/backup/quick-backup/', data);
  }

  /**
   * Récupère l'historique des sauvegardes
   */
  async getBackupHistory(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/api/backup/history/${queryString ? '?' + queryString : ''}`);
  }

  /**
   * Récupère les détails d'une sauvegarde
   */
  async getBackupDetails(backupId) {
    return await api.get(`/api/backup/history/${backupId}/`);
  }

  /**
   * Supprime une sauvegarde
   */
  async deleteBackup(id) {
    return await api.delete(`/api/backup/history/${id}/`);
  }

  /**
   * Télécharge une sauvegarde (déchiffrement automatique)
   */
  async downloadBackup(backupId) {
    // Utilisation directe de fetch pour gérer le téléchargement de fichier
    const url = `/api/backup/history/${backupId}/download/`;
    const headers = {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    };
    
    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors du téléchargement: ${response.status}`);
    }
    
    return response;
  }

  /**
   * Lance une restauration
   */
  async restoreBackup(backupId, options = {}) {
    return await api.post('/api/backup/restore/', {
      backup_id: backupId,
      ...options
    });
  }

  /**
   * Upload sécurisé et restauration d'une sauvegarde
   */
  async uploadAndRestore(formData, onUploadProgress) {
    try {
      const response = await api.post('/api/backup/upload-restore/', formData, {
        onUploadProgress: onUploadProgress,
        timeout: 300000, // 5 minutes de timeout pour les gros fichiers
      });
      
      // L'API Django REST Framework retourne directement l'objet, pas encapsulé dans .data
      console.log('🔍 DEBUG backupService - Réponse brute:', response);
      return response;
    } catch (error) {
      console.error('Erreur upload et restauration:', error);
      throw error;
    }
  }

  /**
   * Récupère l'historique des restaurations
   */
  async getRestoreHistory() {
    return await api.get('/api/backup/restore-history/');
  }

  /**
   * Récupère les détails d'une restauration
   */
  async getRestoreDetails(restoreId) {
    return await api.get(`/api/backup/restore-history/${restoreId}/`);
  }

  /**
   * Récupère le statut d'une opération (sauvegarde ou restauration)
   */
  async getOperationStatus(operationId, operationType = 'backup') {
    const endpoint = operationType === 'backup' ? 'history' : 'restore-history';
    return await api.get(`/api/backup/${endpoint}/${operationId}/status/`);
  }

  /**
   * Récupère les statistiques de stockage
   */
  async getStorageStats() {
    return await api.get('/api/backup/storage-stats/');
  }

  /**
   * Nettoie les anciennes sauvegardes selon les règles de rétention
   */
  async cleanupOldBackups() {
    return await api.post('/api/backup/cleanup/');
  }

  /**
   * Teste la connectivité du service de sauvegarde
   */
  async testConnection() {
    return await api.get('/api/backup/health/');
  }

  /**
   * Formate la taille des fichiers pour l'affichage
   */
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Formate la durée pour l'affichage
   */
  formatDuration(seconds) {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Formate les dates pour l'affichage
   */
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Récupère l'icône appropriée pour le statut
   */
  getStatusIcon(status) {
    const icons = {
      'completed': '✅',
      'failed': '❌',
      'running': '⏳',
      'pending': '⏸️'
    };
    return icons[status] || '❓';
  }

  /**
   * Récupère la classe CSS appropriée pour le statut
   */
  getStatusClass(status) {
    const classes = {
      'completed': 'badge-success',
      'failed': 'badge-error',
      'running': 'badge-info',
      'pending': 'badge-warning'
    };
    return classes[status] || 'badge-ghost';
  }
}

// Export d'une instance unique
export default new BackupService(); 