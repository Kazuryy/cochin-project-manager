import api from './api';

/**
 * Service pour la gestion des sauvegardes et restaurations
 * Version améliorée avec gestion d'erreurs robuste
 */
class BackupService {
  constructor() {
    this.operationCache = new Map();
    this.pollingIntervals = new Map();
    this.eventHandlers = new Map();
  }

  // ========================================
  // GESTION DES CONFIGURATIONS
  // ========================================

  /**
   * Récupère la liste des configurations de sauvegarde
   */
  async getConfigurations() {
    try {
      const response = await api.get('/api/backup/configurations/');
      return this._extractData(response, 'configurations');
    } catch (error) {
      console.error('Erreur lors de la récupération des configurations:', error);
      throw this._formatError(error, 'Impossible de récupérer les configurations');
    }
  }

  /**
   * Crée une nouvelle configuration de sauvegarde
   */
  async createConfiguration(data) {
    try {
      const response = await api.post('/api/backup/configurations/', data);
      return { 
        success: true, 
        message: 'Configuration créée avec succès',
        data: response
      };
    } catch (error) {
      console.error('Erreur lors de la création de la configuration:', error);
      throw this._formatError(error, 'Échec de la création de la configuration');
    }
  }

  /**
   * Met à jour une configuration de sauvegarde
   */
  async updateConfiguration(id, data) {
    try {
      if (!id) {
        throw new Error('ID de configuration invalide');
      }
      
      const response = await api.put(`/api/backup/configurations/${id}/`, data);
      return { 
        success: true, 
        message: 'Configuration mise à jour avec succès',
        data: response
      };
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la configuration:', error);
      throw this._formatError(error, 'Échec de la mise à jour de la configuration');
    }
  }

  /**
   * Supprime une configuration de sauvegarde
   */
  async deleteConfiguration(id) {
    try {
      if (!id) {
        throw new Error('ID de configuration invalide');
      }
      
      await api.delete(`/api/backup/configurations/${id}/`);
      return { success: true, message: 'Configuration supprimée avec succès' };
    } catch (error) {
      console.error('Erreur lors de la suppression de la configuration:', error);
      throw this._formatError(error, 'Échec de la suppression de la configuration');
    }
  }

  // ========================================
  // GESTION DES SAUVEGARDES
  // ========================================

  /**
   * Lance une sauvegarde
   */
  async createBackup(data) {
    try {
      // Validation des données
      if (!data.configuration_id && !data.backup_type) {
        throw new Error('Données de sauvegarde incomplètes: configuration_id ou backup_type requis');
      }
      
      // S'assurer que configuration_id est un nombre
      if (data.configuration_id) {
        data.configuration_id = Number(data.configuration_id);
        if (isNaN(data.configuration_id)) {
          throw new Error('ID de configuration invalide');
        }
      }
      
      const response = await api.post('/api/backup/create/', data, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Démarrer le suivi de l'opération
      const backupId = response?.backup?.id || response?.id;
      if (backupId) {
        this.startOperationPolling(backupId, 'backup');
      }
      
      return { 
        success: true, 
        message: 'Sauvegarde lancée avec succès',
        data: response
      };
    } catch (error) {
      console.error('Erreur lors du lancement de la sauvegarde:', error);
      throw this._formatError(error, 'Échec du lancement de la sauvegarde');
    }
  }

  /**
   * Lance une sauvegarde rapide sans configuration
   */
  async createQuickBackup(backupType, options = {}) {
    try {
    // Validation du type de sauvegarde
    if (!['full', 'data', 'metadata'].includes(backupType)) {
      throw new Error(`Type de sauvegarde invalide: ${backupType}`);
    }
    
    // Construction du nom par défaut si non fourni
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const defaultName = `Sauvegarde_Rapide_${backupType}_${timestamp}`;
    
    const data = {
      backup_type: backupType,
      backup_name: options.backup_name || defaultName,
      include_files: options.include_files !== undefined ? options.include_files : true,
      compression_enabled: options.compression_enabled !== undefined ? options.compression_enabled : true,
      retention_days: options.retention_days || 7
    };
    
      const response = await api.post('/api/backup/quick-backup/', data);
      
      // Démarrer le suivi de l'opération
      const backupId = response?.backup?.id || response?.id;
      if (backupId) {
        this.startOperationPolling(backupId, 'backup');
      }
      
      return {
        success: true,
        message: 'Sauvegarde rapide lancée avec succès',
        data: response
      };
    } catch (error) {
      console.error('Erreur lors de la sauvegarde rapide:', error);
      throw this._formatError(error, 'Échec de la sauvegarde rapide');
    }
  }

  /**
   * Récupère l'historique des sauvegardes avec pagination
   */
  async getBackupHistory(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 20,
        ...params
      });
      
      const response = await api.get(`/api/backup/history/?${queryParams}`);
      return this._extractData(response, 'results');
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error);
      throw this._formatError(error, 'Impossible de récupérer l\'historique des sauvegardes');
    }
  }

  /**
   * Récupère les détails d'une sauvegarde
   */
  async getBackupDetails(backupId) {
    try {
      const response = await api.get(`/api/backup/history/${backupId}/`);
      return response;
    } catch (error) {
      console.error('Erreur lors de la récupération des détails:', error);
      throw this._formatError(error, 'Impossible de récupérer les détails de la sauvegarde');
    }
  }

  /**
   * Supprime une sauvegarde
   */
  async deleteBackup(id) {
    try {
      await api.delete(`/api/backup/history/${id}/`);
      return { success: true, message: 'Sauvegarde supprimée avec succès' };
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      throw this._formatError(error, 'Échec de la suppression de la sauvegarde');
    }
  }

  /**
   * Télécharge une sauvegarde
   */
  async downloadBackup(backupId) {
    try {
      // Pour le téléchargement, utiliser fetch directement pour éviter la conversion JSON automatique
      const response = await fetch(`/api/backup/history/${backupId}/download/`, {
      method: 'GET',
        credentials: 'include',
        headers: {
          'X-CSRFToken': document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1] || ''
        }
    });
    
    if (!response.ok) {
        // Essayer de lire le message d'erreur JSON si possible
        let errorMessage = `Erreur HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorData.detail || errorMessage;
        } catch {
          // Si on ne peut pas parser le JSON, utiliser le message par défaut
        }
        throw new Error(errorMessage);
      }
      
      // Convertir la réponse en blob
      const blob = await response.blob();
      
      // Extraire le nom de fichier depuis les headers ou utiliser un nom par défaut
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `backup_${backupId}.zip`;
      if (contentDisposition) {
        const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (matches && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'Téléchargement démarré' };
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      throw this._formatError(error, 'Échec du téléchargement de la sauvegarde');
    }
  }

  // ========================================
  // GESTION DES RESTAURATIONS
  // ========================================

  /**
   * Lance une restauration
   */
  async restoreBackup(backupId, options = {}) {
    try {
      // Nettoyer l'état des opérations avant de commencer
      this.cleanupOperationState();
      
      const data = { backup_id: backupId, ...options };
      const response = await api.post('/api/backup/restore/', data);
      
      // Démarrer le suivi de l'opération
      const restoreId = response?.restore?.id || response?.id;
      if (restoreId) {
        this.startOperationPolling(restoreId, 'restore');
      }
      
      return { success: true, data: response };
    } catch (error) {
      console.error('Erreur lors de la restauration:', error);
      throw this._formatError(error, 'Échec de la restauration');
    }
  }

  /**
   * Upload et restauration d'un fichier
   */
  async uploadAndRestore(formData, onUploadProgress) {
    try {
      // Nettoyer l'état des opérations avant de commencer
      this.cleanupOperationState();
      
      // Pour FormData, ne PAS définir Content-Type manuellement
      // Le navigateur doit définir automatiquement la boundary
      const response = await api.post('/api/backup/upload-restore/', formData, {
        onUploadProgress: onUploadProgress
      });
      
      // Démarrer le suivi de l'opération
      const restoreId = response?.restore_history?.id || response?.id;
      if (restoreId) {
        this.startOperationPolling(restoreId, 'restore');
      }
      
      // Retourner directement la réponse du serveur (qui contient déjà success: true)
      return response;
    } catch (error) {
      console.error('Erreur lors de l\'upload et restauration:', error);
      throw this._formatError(error, 'Échec de l\'upload et restauration');
    }
  }

  /**
   * Récupère l'historique des restaurations (combiné: classiques + externes)
   */
  async getRestoreHistory() {
    try {
      // Récupérer les deux types de restaurations en parallèle
      const [classicResponse, externalResponse] = await Promise.allSettled([
        api.get('/api/backup/restore-history/'),
        api.get('/api/backup/external-restorations/')
      ]);

      const classicRestores = [];
      const externalRestores = [];

      // Traiter les restaurations classiques
      if (classicResponse.status === 'fulfilled') {
        const classicData = this._extractData(classicResponse.value, 'results');
        if (Array.isArray(classicData)) {
          classicRestores.push(...classicData.map(restore => ({
            ...restore,
            source_type: 'classic', // Marquer le type de source
            display_name: restore.restore_name,
            created_date: restore.started_at || restore.created_at
          })));
        }
      } else {
        console.warn('🟡 Impossible de récupérer les restaurations classiques:', classicResponse.reason);
      }

      // Traiter les restaurations externes
      if (externalResponse.status === 'fulfilled') {
        const externalData = this._extractData(externalResponse.value, 'results');
        if (Array.isArray(externalData)) {
          externalRestores.push(...externalData.map(restore => ({
            ...restore,
            source_type: 'external', // Marquer le type de source
            display_name: restore.restoration_name,
            created_date: restore.started_at || restore.created_at,
            // Mapper les champs externes vers le format attendu par le frontend
            restore_name: restore.restoration_name,
            restore_type: restore.merge_strategy === 'preserve_system' ? 'merge' : 
                         restore.merge_strategy === 'merge' ? 'merge' : 'full',
            tables_restored: restore.external_tables_processed,
            records_restored: restore.external_records_processed,
            files_restored: restore.external_files_processed,
            // Ajouter des infos spécifiques aux restaurations externes
            merge_strategy: restore.merge_strategy,
            uploaded_backup_info: restore.uploaded_backup
          })));
        }
      } else {
        console.warn('🟡 Impossible de récupérer les restaurations externes:', externalResponse.reason);
      }

      // Combiner et trier par date de création (plus récent en premier)
      const allRestores = [...classicRestores, ...externalRestores];
      allRestores.sort((a, b) => {
        const dateA = new Date(a.created_date || 0);
        const dateB = new Date(b.created_date || 0);
        return dateB - dateA;
      });

      console.log(`📊 Historique des restaurations chargé: ${classicRestores.length} classiques + ${externalRestores.length} externes = ${allRestores.length} total`);

      return { results: allRestores };

    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique de restauration:', error);
      throw this._formatError(error, 'Impossible de récupérer l\'historique des restaurations');
    }
  }

  /**
   * Récupère les détails d'une restauration
   */
  async getRestoreDetails(restoreId) {
    try {
      const response = await api.get(`/api/backup/restore-history/${restoreId}/`);
      return response;
    } catch (error) {
      console.error('Erreur lors de la récupération des détails de restauration:', error);
      throw this._formatError(error, 'Impossible de récupérer les détails de la restauration');
    }
  }

  /**
   * 🆕 Supprime une restauration classique
   */
  async deleteRestoration(restoreId) {
    try {
      await api.delete(`/api/backup/restore-history/${restoreId}/`);
      return { success: true, message: 'Restauration supprimée avec succès' };
    } catch (error) {
      console.error('Erreur lors de la suppression de la restauration:', error);
      throw this._formatError(error, 'Échec de la suppression de la restauration');
    }
  }

  /**
   * 🆕 Supprime une restauration externe
   */
  async deleteExternalRestoration(restorationId) {
    try {
      await api.delete(`/api/backup/external-restorations/${restorationId}/`);
      return { success: true, message: 'Restauration externe supprimée avec succès' };
    } catch (error) {
      console.error('Erreur lors de la suppression de la restauration externe:', error);
      throw this._formatError(error, 'Échec de la suppression de la restauration externe');
    }
  }

  /**
   * 🆕 Supprime une restauration (détecte automatiquement le type)
   */
  async deleteRestorationAuto(restoration) {
    try {
      if (restoration.source_type === 'external') {
        return await this.deleteExternalRestoration(restoration.id);
      } else {
        return await this.deleteRestoration(restoration.id);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression automatique:', error);
      throw this._formatError(error, 'Échec de la suppression de la restauration');
    }
  }

  // ========================================
  // GESTION DES OPÉRATIONS EN TEMPS RÉEL
  // ========================================

  /**
   * Récupère le statut d'une opération
   */
  async getOperationStatus(operationId, operationType = 'backup') {
    try {
      const endpoint = operationType === 'backup' 
        ? `/api/backup/history/${operationId}/status/`
        : `/api/backup/restore-history/${operationId}/status/`;
        
      const response = await api.get(endpoint);
      
      // Vérifier si c'est une réponse indiquant que l'opération a été supprimée
      const status = response.data?.backup_status?.status || response.data?.restore_status?.status;
      if (status === 'deleted') {
        // Retourner la réponse pour déclencher l'arrêt du polling
        return response;
      }
      
      return response;
    } catch (error) {
      // Si l'opération a été supprimée (404 ou 500), retourner un statut spécial sans log d'erreur
      if (error.response?.status === 404 || error.response?.status === 500) {
        // Log silencieux pour ne pas polluer la console
        console.log(`ℹ️ Opération ${operationId} introuvable (${error.response.status}) - marquage comme supprimée`);
        return {
          success: false,
          data: {
            backup_status: {
              id: operationId,
              status: 'deleted',
              progress: 0,
              error_message: 'Cette opération a été supprimée ou est introuvable',
              duration_seconds: null
            },
            restore_status: {
              id: operationId,
              status: 'deleted',
              progress: 0,
              error_message: 'Cette opération a été supprimée ou est introuvable',
              duration_seconds: null
            }
          }
        };
      }
      
      // Pour les autres erreurs, log complet
      console.error('Erreur lors de la récupération du statut:', error);
      return null;
    }
  }

  /**
   * Démarre le polling d'une opération
   */
  startOperationPolling(operationId, operationType = 'backup', interval = 2000) {
    // Arrêter un polling existant pour cette opération
    this.stopOperationPolling(operationId);
    
    const pollInterval = setInterval(async () => {
      try {
        const status = await this.getOperationStatus(operationId, operationType);
        
        if (status) {
          // Extraire le statut réel selon la structure de réponse
          const actualStatus = status.data?.backup_status?.status || 
                             status.data?.restore_status?.status || 
                             status.status;
          
          // Vérifier si c'est une opération supprimée/terminée
          const isCompleted = ['completed', 'failed', 'cancelled', 'deleted'].includes(actualStatus);
          
          // Si l'opération est terminée, arrêter immédiatement le polling
          if (isCompleted) {
            console.log(`🛑 Arrêt du polling pour l'opération ${operationId} - statut: ${actualStatus}`);
            this.stopOperationPolling(operationId);
            this.emitEvent('operationComplete', {
              id: operationId,
              type: operationType,
              status: status
            });
            return; // Arrêter l'exécution pour ne pas émettre d'update
          }
          
          // Émettre l'événement de mise à jour du statut seulement si l'opération est en cours
          this.emitEvent('operationUpdate', {
            id: operationId,
            type: operationType,
            status: status
          });
        } else {
          // Si on ne peut pas récupérer le statut, arrêter le polling
          console.warn(`⚠️ Impossible de récupérer le statut pour l'opération ${operationId} - arrêt du polling`);
          this.stopOperationPolling(operationId);
        }
      } catch (error) {
        console.error('Erreur lors du polling:', error);
        // Arrêter le polling en cas d'erreur persistante
        this.stopOperationPolling(operationId);
      }
    }, interval);
    
    this.pollingIntervals.set(operationId, pollInterval);
  }

  /**
   * Arrête le polling d'une opération
   */
  stopOperationPolling(operationId) {
    const interval = this.pollingIntervals.get(operationId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(operationId);
    }
  }

  /**
   * Arrête tous les pollings
   */
  stopAllPolling() {
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals.clear();
  }

  /**
   * Nettoie complètement l'état des opérations en cours
   * Utile avant de démarrer une nouvelle opération importante comme une restauration
   */
  cleanupOperationState() {
    console.log('🧹 Nettoyage de l\'état des opérations en cours...');
    
    // Afficher les pollings actifs avant nettoyage
    if (this.pollingIntervals.size > 0) {
      console.log(`   🔍 ${this.pollingIntervals.size} pollings actifs trouvés:`, Array.from(this.pollingIntervals.keys()));
    }
    
    // Arrêter tous les pollings
    this.stopAllPolling();
    
    // Nettoyer le localStorage des opérations en cours
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('backup_operation_') || key.startsWith('restore_operation_'))) {
        keysToRemove.push(key);
      }
    }
    
    if (keysToRemove.length > 0) {
      console.log(`   🗄️ Suppression de ${keysToRemove.length} entrées du localStorage:`, keysToRemove);
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    
    console.log(`✅ Nettoyage terminé`);
  }

  /**
   * Affiche l'état actuel des opérations en cours (pour debugging)
   */
  debugOperationsState() {
    console.log('🔍 État des opérations:');
    console.log(`   📊 Pollings actifs: ${this.pollingIntervals.size}`);
    if (this.pollingIntervals.size > 0) {
      console.log(`   🔄 IDs en cours de polling:`, Array.from(this.pollingIntervals.keys()));
    }
    
    // Vérifier le localStorage
    const operationKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('backup_operation_') || key.startsWith('restore_operation_'))) {
        operationKeys.push(key);
      }
    }
    
    console.log(`   🗄️ Entrées localStorage: ${operationKeys.length}`);
    if (operationKeys.length > 0) {
      console.log(`   📋 Clés trouvées:`, operationKeys);
    }
  }

  // ========================================
  // 🆕 SYSTÈME EXTERNE SÉCURISÉ
  // ========================================

  /**
   * 🆕 Upload externe d'une sauvegarde avec validation et isolation complète
   */
  async uploadExternalBackup(file, uploadName, onUploadProgress) {
    try {
      this.cleanupOperationState();
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_name', uploadName);
      
      const response = await api.post('/api/backup/external-uploads/', formData, {
        onUploadProgress: onUploadProgress
      });
      
      return response;
    } catch (error) {
      console.error('Erreur lors de l\'upload externe:', error);
      throw this._formatError(error, 'Échec de l\'upload externe');
    }
  }

  /**
   * 🆕 Restauration externe depuis un upload avec stratégies de fusion sécurisées
   */
  async restoreFromExternalBackup(uploadedBackupId, mergeStrategy = 'preserve_system', options = {}) {
    try {
      this.cleanupOperationState();
      
      const data = {
        uploaded_backup_id: uploadedBackupId,
        merge_strategy: mergeStrategy,
        restoration_options: options
      };
      
      const response = await api.post('/api/backup/external-restorations/', data);
      
      // Démarrer le suivi de la restauration externe
      const restorationId = response?.id;
      if (restorationId) {
        this.startExternalRestorationPolling(restorationId);
      }
      
      return response;
    } catch (error) {
      console.error('Erreur lors de la restauration externe:', error);
      throw this._formatError(error, 'Échec de la restauration externe');
    }
  }

  /**
   * 🆕 Upload complet et restauration externe (nouvelle méthode recommandée)
   */
  async uploadAndRestoreExternal(file, uploadName, mergeStrategy = 'preserve_system', onUploadProgress) {
    try {
      // Phase 1: Upload avec validation
      const uploadResponse = await this.uploadExternalBackup(file, uploadName, onUploadProgress);
      
      if (!uploadResponse.success) {
        throw new Error(uploadResponse.message || 'Échec de l\'upload externe');
      }
      
      const uploadedBackupId = uploadResponse.id;
      
      // Attendre que l'upload soit validé (statut ready)
      await this.waitForExternalUploadReady(uploadedBackupId);
      
      // Phase 2: Restauration externe sécurisée
      const restoreResponse = await this.restoreFromExternalBackup(uploadedBackupId, mergeStrategy);
      
      return {
        success: true,
        upload: uploadResponse,
        restoration: restoreResponse,
        message: `🛡️ Upload et restauration externes réussis avec protection maximale`
      };
    } catch (error) {
      console.error('Erreur lors de l\'upload et restauration externes:', error);
      throw this._formatError(error, 'Échec de l\'upload et restauration externes');
    }
  }

  /**
   * 🆕 Attendre que l'upload externe soit prêt
   */
  async waitForExternalUploadReady(uploadedBackupId, maxWaitTime = 30000) {
    console.log(`⏳ Attente de validation pour l'upload externe ID: ${uploadedBackupId}`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const uploadDetails = await this.getExternalUploadDetails(uploadedBackupId);
        
        console.log(`📊 Statut upload ${uploadedBackupId}: ${uploadDetails.status}`);
        
        if (uploadDetails.status === 'ready') {
          console.log(`✅ Upload ${uploadedBackupId} validé et prêt`);
          return uploadDetails;
        }
        
        if (uploadDetails.status === 'failed_validation') {
          const errorMsg = uploadDetails.error_message || 'Validation échouée';
          console.error(`❌ Validation échouée pour upload ${uploadedBackupId}: ${errorMsg}`);
          
          // Messages d'erreur plus explicites selon le type d'échec
          if (errorMsg.includes('Contenu invalide ou non reconnu')) {
            throw new Error(
              'Le fichier uploadé n\'est pas reconnu comme une sauvegarde valide.\n\n' +
              'Vérifiez que :\n' +
              '• Le fichier est bien un backup de l\'application\n' +
              '• Le fichier n\'est pas corrompu\n' +
              '• Le format est supporté (.zip, .encrypted)\n\n' +
              'Consultez les logs pour plus de détails.'
            );
          } else if (errorMsg.includes('Checksum invalide')) {
            throw new Error(
              'Le fichier semble être corrompu (échec de vérification d\'intégrité).\n\n' +
              'Essayez de :\n' +
              '• Re-télécharger le fichier de sauvegarde\n' +
              '• Vérifier que le fichier n\'a pas été modifié\n' +
              '• Utiliser un autre fichier de sauvegarde'
            );
          } else {
            throw new Error(`Validation échouée: ${errorMsg}`);
          }
        }
        
        if (uploadDetails.status === 'corrupted') {
          throw new Error(
            'Le fichier de sauvegarde est corrompu ou illisible.\n\n' +
            'Possible causes :\n' +
            '• Fichier endommagé pendant le transfert\n' +
            '• Format de fichier non supporté\n' +
            '• Chiffrement incompatible\n\n' +
            'Essayez avec un autre fichier de sauvegarde.'
          );
        }
        
        // Attendre 2 secondes avant de vérifier à nouveau
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        if (error.status === 404) {
          console.error(`❌ Upload ${uploadedBackupId} introuvable`);
          throw new Error('Upload externe introuvable - il a peut-être été supprimé');
        }
        
        // Si c'est notre erreur personnalisée, la relancer telle quelle
        if (error.message.includes('Le fichier uploadé n\'est pas reconnu') || 
            error.message.includes('Le fichier semble être corrompu') ||
            error.message.includes('Le fichier de sauvegarde est corrompu')) {
          throw error;
        }
        
        // Pour les autres erreurs, les relancer aussi
        console.error(`❌ Erreur lors de l'attente de validation: ${error.message}`);
        throw error;
      }
    }
    
    console.error(`⏰ Timeout atteint pour l'upload ${uploadedBackupId}`);
    throw new Error(
      `Timeout atteint (${maxWaitTime/1000}s) - La validation prend trop de temps.\n\n` +
      'Possible causes :\n' +
      '• Fichier très volumineux nécessitant plus de temps\n' +
      '• Problème réseau ou serveur temporaire\n' +
      '• Fichier complexe nécessitant une analyse approfondie\n\n' +
      'Essayez de relancer l\'opération ou contactez l\'administrateur.'
    );
  }

  /**
   * 🆕 Récupère la liste des uploads externes
   */
  async getExternalUploads() {
    try {
      const response = await api.get('/api/backup/external-uploads/');
      return this._extractData(response, 'results');
    } catch (error) {
      console.error('Erreur lors de la récupération des uploads externes:', error);
      throw this._formatError(error, 'Impossible de récupérer les uploads externes');
    }
  }

  /**
   * 🆕 Récupère les détails d'un upload externe
   */
  async getExternalUploadDetails(uploadId) {
    try {
      const response = await api.get(`/api/backup/external-uploads/${uploadId}/`);
      return response;
    } catch (error) {
      console.error('Erreur lors de la récupération des détails d\'upload externe:', error);
      throw this._formatError(error, 'Impossible de récupérer les détails de l\'upload externe');
    }
  }

  /**
   * 🆕 Supprime un upload externe
   */
  async deleteExternalUpload(uploadId) {
    try {
      const response = await api.delete(`/api/backup/external-uploads/${uploadId}/`);
      return response;
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'upload externe:', error);
      throw this._formatError(error, 'Impossible de supprimer l\'upload externe');
    }
  }

  /**
   * 🆕 Récupère la liste des restaurations externes
   */
  async getExternalRestorations() {
    try {
      const response = await api.get('/api/backup/external-restorations/');
      return this._extractData(response, 'results');
    } catch (error) {
      console.error('Erreur lors de la récupération des restaurations externes:', error);
      throw this._formatError(error, 'Impossible de récupérer les restaurations externes');
    }
  }

  /**
   * 🆕 Récupère les détails d'une restauration externe
   */
  async getExternalRestorationDetails(restorationId) {
    try {
      const response = await api.get(`/api/backup/external-restorations/${restorationId}/`);
      return response;
    } catch (error) {
      console.error('Erreur lors de la récupération des détails de restauration externe:', error);
      throw this._formatError(error, 'Impossible de récupérer les détails de la restauration externe');
    }
  }

  /**
   * 🆕 Récupère la progression d'une restauration externe
   */
  async getExternalRestorationProgress(restorationId) {
    try {
      const response = await api.get(`/api/backup/external-restorations/${restorationId}/progress/`);
      return response;
    } catch (error) {
      // Logs silencieux pour le polling - erreur 404/500 normales pendant les opérations
      if (error.status !== 404 && error.status !== 500) {
        console.error('Erreur lors de la récupération de la progression:', error);
      }
      throw this._formatError(error, 'Impossible de récupérer la progression');
    }
  }

  /**
   * 🆕 Annule une restauration externe
   */
  async cancelExternalRestoration(restorationId) {
    try {
      const response = await api.post(`/api/backup/external-restorations/${restorationId}/cancel/`);
      return response;
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la restauration externe:', error);
      throw this._formatError(error, 'Impossible d\'annuler la restauration externe');
    }
  }

  /**
   * 🆕 Polling pour les restaurations externes
   */
  startExternalRestorationPolling(restorationId) {
    // Arrêter tout polling en cours
    this.stopAllPolling();
    
    const pollInterval = 3000; // 3 secondes
    let timeout = 300000; // 5 minutes
    
    const poll = async () => {
      try {
        const progress = await this.getExternalRestorationProgress(restorationId);
        
        // Sauvegarder dans localStorage pour persistance
        localStorage.setItem('externalRestorationProgress', JSON.stringify({
          id: restorationId,
          progress: progress,
          timestamp: Date.now()
        }));
        
        // Émettre l'événement de mise à jour
        this.emitEvent('externalRestorationUpdate', progress);
        
        // Arrêter le polling si terminé
        if (['completed', 'failed', 'cancelled'].includes(progress.status)) {
          this.stopAllPolling();
          localStorage.removeItem('externalRestorationProgress');
          this.emitEvent('externalRestorationComplete', progress);
          return;
        }
        
        // Diminuer le timeout et continuer
        timeout -= pollInterval;
        if (timeout > 0) {
          this.operationPollingId = setTimeout(poll, pollInterval);
        } else {
          console.warn('Timeout atteint pour le suivi de la restauration externe');
          this.stopAllPolling();
        }
        
      } catch (error) {
        // Gestion d'erreur améliorée
        if (error.status === 404) {
          console.warn('Restauration externe introuvable - arrêt du polling');
          this.stopAllPolling();
          localStorage.removeItem('externalRestorationProgress');
        } else if (timeout > 0) {
          // Réessayer après une erreur temporaire
          timeout -= pollInterval;
          this.operationPollingId = setTimeout(poll, pollInterval);
        } else {
          console.error('Erreur fatale lors du polling de la restauration externe:', error);
          this.stopAllPolling();
        }
      }
    };
    
    // Démarrer le polling
    poll();
  }

  /**
   * 🆕 Récupère le statut du système externe
   */
  async getExternalSystemStatus() {
    try {
      const response = await api.get('/api/backup/external-system-status/');
      return response;
    } catch (error) {
      console.error('Erreur lors de la récupération du statut système externe:', error);
      throw this._formatError(error, 'Impossible de récupérer le statut du système externe');
    }
  }

  /**
   * 🆕 Lance le nettoyage des uploads externes
   */
  async cleanupExternalUploads(maxAgeDays = 30) {
    try {
      const response = await api.post('/api/backup/cleanup-external-uploads/', {
        max_age_days: maxAgeDays
      });
      return response;
    } catch (error) {
      console.error('Erreur lors du nettoyage des uploads externes:', error);
      throw this._formatError(error, 'Impossible de nettoyer les uploads externes');
    }
  }

  // ========================================
  // UTILITAIRES ET SYSTÈME
  // ========================================

  /**
   * Récupère les statistiques de stockage
   */
  async getStorageStats() {
    try {
      const response = await api.get('/api/backup/storage-stats/');
      return response;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      return {};
    }
  }

  /**
   * Lance un nettoyage des anciennes sauvegardes
   */
  async cleanupOldBackups() {
    try {
      const response = await api.post('/api/backup/cleanup/');
      return { success: true, data: response };
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error);
      throw this._formatError(error, 'Échec du nettoyage');
    }
  }

  /**
   * Test la connexion au service de backup
   */
  async testConnection() {
    try {
      await api.get('/api/backup/configurations/');
      return { success: true, message: 'Connexion réussie' };
         } catch {
       return { success: false, message: 'Connexion échouée' };
     }
  }

  // ========================================
  // GESTION DES ÉVÉNEMENTS
  // ========================================

  /**
   * Ajoute un gestionnaire d'événement
   */
  addEventListener(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  /**
   * Supprime un gestionnaire d'événement
   */
  removeEventListener(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Émet un événement
   */
  emitEvent(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Erreur dans le gestionnaire d\'événement:', error);
        }
      });
    }
  }

  // ========================================
  // MÉTHODES UTILITAIRES PRIVÉES
  // ========================================

  /**
   * Extrait les données d'une réponse avec gestion des formats multiples
   */
  _extractData(response, dataKey = null) {
    if (!response) return [];
    
    // Si c'est déjà un tableau
    if (Array.isArray(response)) {
      return response;
    }
    
    // Si on a une clé spécifique
    if (dataKey && response[dataKey]) {
      return response[dataKey];
    }
    
    // Formats courants
    if (response.results && Array.isArray(response.results)) {
      return response.results;
    }
    
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
    
    // Retourner la réponse telle quelle
    return response;
  }

  /**
   * Formate une erreur pour l'affichage utilisateur
   */
  _formatError(error, defaultMessage) {
    const message = error.response?.data?.detail || 
                   error.response?.data?.message || 
                   error.message || 
                   defaultMessage;
    
    const formattedError = new Error(message);
    formattedError.status = error.status || error.response?.status;
    formattedError.originalError = error;
    
    return formattedError;
  }

  // ========================================
  // MÉTHODES UTILITAIRES PUBLIQUES
  // ========================================

  /**
   * Formate une taille de fichier
   */
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Formate une durée en secondes
   */
  formatDuration(seconds) {
    if (!seconds) return '—';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Formate une date
   */
  formatDate(dateString) {
    if (!dateString) return '—';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
        minute: '2-digit'
    });
         } catch {
       return 'Date invalide';
     }
  }

  /**
   * Retourne une icône pour un statut
   */
  getStatusIcon(status) {
    const icons = {
      pending: '⏳',
      running: '🔄',
      completed: '✅',
      failed: '❌',
      cancelled: '⏹️'
    };
    return icons[status] || '❓';
  }

  /**
   * Retourne une classe CSS pour un statut
   */
  getStatusClass(status) {
    const classes = {
      pending: 'badge-warning',
      running: 'badge-info',
      completed: 'badge-success',
      failed: 'badge-error',
      cancelled: 'badge-neutral'
    };
    return classes[status] || 'badge-neutral';
  }
}

// Exporter une instance unique
const backupService = new BackupService();
export default backupService; 