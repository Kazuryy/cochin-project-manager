import React, { useState, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FiUpload, FiX, FiShield, FiAlertTriangle, FiCheckCircle, FiFileText, FiLock, FiDatabase, FiSave } from 'react-icons/fi';
import backupService from '../../services/backupService';

// Constants pour éviter les magic numbers
const FILE_CONSTANTS = {
  MAX_SIZE: 500 * 1024 * 1024, // 500 MB
  ALLOWED_EXTENSIONS: ['.zip', '.encrypted'],
  ALLOWED_TYPES: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
  AUTO_CLOSE_DELAY: 4000, // 4 secondes
};

// Debug activé seulement en développement (à configurer selon l'environnement)
const DEBUG_ENABLED = false; // Mettre à true pour activer les logs de debug

const UPLOAD_PHASES = {
  ANALYZING: '🔍 Analyse et validation du fichier...',
  SECURITY: '🛡️ Validation de sécurité multi-couches...',
  RESTORING: '📦 Restauration des données en cours...',
  FINALIZING: '✅ Finalisation et vérification...',
  SUCCESS: '🎉 Restauration réussie !',
  FAILED: 'Échec de la restauration',
  AUTH_FAILED: 'Échec d\'authentification',
};

// État initial pour l'upload
const initialUploadState = {
  isUploading: false,
  progress: 0,
  currentPhase: '',
  result: null,
  securityReport: null,
  error: null,
};

// Options de restauration par défaut
const defaultRestoreOptions = {
  backup_current: true,
  restore_type: 'full',
};

const SecureUploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  // États regroupés logiquement
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadState, setUploadState] = useState(initialUploadState);
  const [restoreOptions, setRestoreOptions] = useState(defaultRestoreOptions);
  
  const fileInputRef = useRef(null);

  // Debug conditionnel (seulement en développement)
  const debugLog = useCallback((message, data) => {
    if (DEBUG_ENABLED) {
      console.log(`🔍 DEBUG - ${message}:`, data);
    }
  }, []);

  // Validation côté client optimisée
  const validateFile = useCallback((file) => {
    if (!file) {
      throw new Error('Aucun fichier sélectionné');
    }

    if (file.size > FILE_CONSTANTS.MAX_SIZE) {
      throw new Error(
        `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
        `Taille maximale: ${FILE_CONSTANTS.MAX_SIZE / 1024 / 1024} MB`
      );
    }

    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!FILE_CONSTANTS.ALLOWED_EXTENSIONS.includes(extension)) {
      throw new Error(
        `Extension non autorisée: ${extension}. ` +
        `Extensions acceptées: ${FILE_CONSTANTS.ALLOWED_EXTENSIONS.join(', ')}`
      );
    }

    if (!FILE_CONSTANTS.ALLOWED_TYPES.includes(file.type)) {
      debugLog('Type MIME suspect', file.type);
    }

    return true;
  }, [debugLog]);

  // Réinitialisation complète du modal
  const resetModal = useCallback(() => {
    setSelectedFile(null);
    setUploadState(initialUploadState);
    setDragActive(false);
  }, []);

  // Gestion de la fermeture
  const handleClose = useCallback(() => {
    if (!uploadState.isUploading) {
      resetModal();
      onClose();
    }
  }, [uploadState.isUploading, resetModal, onClose]);

  // Sélection de fichier optimisée
  const handleFileSelect = useCallback((file) => {
    try {
      validateFile(file);
      setSelectedFile(file);
      setUploadState(prev => ({ ...prev, error: null }));
    } catch (err) {
      setUploadState(prev => ({ ...prev, error: err.message }));
      setSelectedFile(null);
    }
  }, [validateFile]);

  // Gestion du drag & drop optimisée
  const handleDragEvents = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isDragEnterOrOver = e.type === "dragenter" || e.type === "dragover";
    setDragActive(isDragEnterOrOver);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  // Mise à jour de l'état d'upload
  const updateUploadState = useCallback((updates) => {
    setUploadState(prev => ({ ...prev, ...updates }));
  }, []);

  // Upload et restauration sécurisés optimisés
  const handleSecureUpload = useCallback(async () => {
    if (!selectedFile) {
      updateUploadState({ error: 'Aucun fichier sélectionné' });
      return;
    }

    // Réinitialisation et démarrage
    updateUploadState({
      ...initialUploadState,
      isUploading: true,
      currentPhase: UPLOAD_PHASES.ANALYZING,
      progress: 10,
    });

    try {
      // Préparation du FormData
      const formData = new FormData();
      formData.append('backup_file', selectedFile);
      formData.append('restore_options', JSON.stringify(restoreOptions));

      // Phase sécurité
      updateUploadState({
        currentPhase: UPLOAD_PHASES.SECURITY,
        progress: 25,
      });

      debugLog('Démarrage upload sécurisé', { fileName: selectedFile.name, size: selectedFile.size });

      // Upload avec callback de progression
      const response = await backupService.uploadAndRestore(formData, (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 50) / progressEvent.total) + 25;
        updateUploadState({ progress: Math.min(progress, 75) });
      });

      // Phase restauration
      updateUploadState({
        currentPhase: UPLOAD_PHASES.RESTORING,
        progress: 80,
      });

      // Finalisation
      updateUploadState({
        currentPhase: UPLOAD_PHASES.FINALIZING,
        progress: 95,
      });

      debugLog('Réponse complète', {
        response,
        type: typeof response,
        success: response?.success,
      });

      // Vérification de la réponse
      if (response?.success) {
        updateUploadState({
          result: response,
          securityReport: response.security_report,
          currentPhase: UPLOAD_PHASES.SUCCESS,
          progress: 100,
        });

        // Notification de succès
        onUploadSuccess?.(response);

        // Auto-fermeture différée
        setTimeout(() => {
          if (!uploadState.isUploading) {
            handleClose();
          }
        }, FILE_CONSTANTS.AUTO_CLOSE_DELAY);
      } else {
        debugLog('Réponse invalide détectée', {
          response,
          hasResponse: !!response,
          hasSuccess: response?.success,
          responseKeys: response ? Object.keys(response) : 'undefined'
        });
        throw new Error(response?.error || 'Réponse invalide du serveur');
      }

    } catch (err) {
      debugLog('Erreur upload sécurisé', err);
      
      let errorMessage = '❌ Erreur lors de l\'upload - Veuillez réessayer';
      let currentPhase = UPLOAD_PHASES.FAILED;

      // Gestion spécifique des erreurs d'authentification
      if (err.status === 401 || err.isSessionExpired) {
        errorMessage = '🔐 Session expirée. Veuillez vous reconnecter pour continuer.';
        currentPhase = UPLOAD_PHASES.AUTH_FAILED;
      } else if (err.response?.data?.security_errors) {
        errorMessage = '🚨 FICHIER REJETÉ - Problème de sécurité détecté';
      } else if (err.response?.data?.error) {
        errorMessage = `❌ ${err.response.data.error}`;
      } else if (err.message) {
        errorMessage = `❌ ${err.message}`;
      }
      
      updateUploadState({
        error: errorMessage,
        currentPhase,
        progress: 0,
        securityReport: err.response?.data?.security_report || null,
      });
    } finally {
      updateUploadState({ isUploading: false });
    }
  }, [selectedFile, restoreOptions, updateUploadState, debugLog, onUploadSuccess, uploadState.isUploading, handleClose]);

  // Mise à jour des options de restauration
  const handleRestoreOptionChange = useCallback((key, value) => {
    setRestoreOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  // Mesures de sécurité memoized pour éviter les re-renders
  const securityMeasures = useMemo(() => [
    { icon: FiCheckCircle, text: 'Signatures de fichiers' },
    { icon: FiCheckCircle, text: 'Analyse ZIP approfondie' },
    { icon: FiCheckCircle, text: 'Détection malwares' },
    { icon: FiCheckCircle, text: 'Protection zip bombs' },
    { icon: FiCheckCircle, text: 'Gestion contraintes FK' },
    { icon: FiCheckCircle, text: 'Préprocessing intelligent' },
  ], []);

  // Statistiques de restauration memoized
  const restorationStats = useMemo(() => {
    if (!uploadState.result) return null;
    
    const result = uploadState.result;
    const history = result.restore_history || {};
    
    return [
      {
        value: history.tables_restored || result.tables_restored || 0,
        label: 'Tables restaurées',
        color: 'success',
      },
      {
        value: history.records_restored || result.records_restored || 0,
        label: 'Enregistrements',
        color: 'info',
      },
      {
        value: history.files_restored || result.files_restored || 0,
        label: 'Fichiers restaurés',
        color: 'primary',
      },
    ];
  }, [uploadState.result]);

  // Ne pas rendre si le modal n'est pas ouvert
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-base-100 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-base-300 bg-gradient-to-r from-success/10 to-info/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/20 rounded-full">
              <FiShield className="text-2xl text-success" />
            </div>
            <div>
              <h2 id="modal-title" className="text-2xl font-bold text-base-content">
                Restauration de Sauvegarde
              </h2>
              <p id="modal-description" className="text-base-content/70">
                Import sécurisé avec validation multi-couches
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="btn btn-ghost btn-sm hover:bg-error/20"
            disabled={uploadState.isUploading}
            aria-label="Fermer le modal"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Mesures de sécurité */}
        <div className="p-6 bg-success/5 border-b border-base-300">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg">
            <FiLock className="text-success" />
            Protections Actives
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {securityMeasures.map((measure) => (
              <div key={measure.text} className="flex items-center gap-2 p-2 bg-base-100 rounded-lg">
                <measure.icon className="text-success w-4 h-4" />
                <span>{measure.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Zone d'upload */}
        <div className="p-6">
          {!selectedFile ? (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                dragActive 
                  ? 'border-primary bg-primary/10 scale-105' 
                  : 'border-base-300 hover:border-primary/50 hover:bg-base-50'
              }`}
              onDragEnter={handleDragEvents}
              onDragLeave={handleDragEvents}
              onDragOver={handleDragEvents}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              aria-label="Zone de dépôt de fichier"
            >
              <FiUpload className="w-16 h-16 mx-auto mb-4 text-primary/70" />
              <h3 className="text-xl font-semibold mb-2">
                Sélectionnez votre fichier de sauvegarde
              </h3>
              <p className="text-base-content/70 mb-6">
                Glissez-déposez ou cliquez pour parcourir
              </p>
              <div className="bg-info/10 rounded-lg p-4 mb-6">
                <p className="text-sm text-info">
                  <strong>Formats acceptés:</strong> {FILE_CONSTANTS.ALLOWED_EXTENSIONS.join(', ')}<br/>
                  <strong>Taille maximale:</strong> {FILE_CONSTANTS.MAX_SIZE / 1024 / 1024} MB
                </p>
              </div>
              <button
                className="btn btn-primary btn-lg gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <FiFileText />
                Parcourir les fichiers
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={FILE_CONSTANTS.ALLOWED_EXTENSIONS.join(',')}
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
                aria-label="Sélecteur de fichier"
              />
            </div>
          ) : (
            <div className="bg-gradient-to-r from-primary/10 to-success/10 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/20 rounded-full">
                    <FiFileText className="text-2xl text-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-lg">{selectedFile.name}</div>
                    <div className="text-sm text-base-content/70 flex items-center gap-4">
                      <span>📦 {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                      <span>🔐 Fichier validé</span>
                    </div>
                  </div>
                </div>
                {!uploadState.isUploading && (
                  <button
                    className="btn btn-ghost btn-sm hover:bg-error/20"
                    onClick={() => setSelectedFile(null)}
                    aria-label="Supprimer le fichier sélectionné"
                  >
                    <FiX />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options de restauration */}
          {selectedFile && !uploadState.isUploading && (
            <div className="mt-6 p-6 bg-base-200/50 rounded-xl border border-base-300">
              <h4 className="font-bold mb-4 flex items-center gap-2 text-lg">
                <FiDatabase className="text-info" />
                Options de Restauration
              </h4>
              
              <div className="space-y-4">
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer" aria-label="Sauvegarder l'état actuel avant restauration">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-warning mt-1"
                      checked={restoreOptions.backup_current}
                      onChange={(e) => handleRestoreOptionChange('backup_current', e.target.checked)}
                    />
                    <div>
                      <span className="font-semibold flex items-center gap-2">
                        <FiSave className="text-warning" />
                        Sauvegarder l'état actuel avant restauration
                      </span>
                      <p className="text-sm text-base-content/70 mt-1">
                        <strong>Recommandé:</strong> Crée une sauvegarde de sécurité de vos données actuelles avant d'importer la nouvelle sauvegarde.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="bg-info/10 border border-info/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FiDatabase className="text-info mt-1" />
                    <div>
                      <span className="font-semibold">Mode de restauration: Remplacement complet</span>
                      <p className="text-sm text-base-content/70 mt-1">
                        Les données existantes seront remplacées par celles de la sauvegarde. 
                        Aucun doublon ne sera créé grâce à notre système de préprocessing intelligent.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progression */}
          {uploadState.isUploading && (
            <div className="mt-6 p-6 bg-gradient-to-r from-info/10 to-success/10 rounded-xl border border-info/30">
              <div className="flex items-center gap-3 mb-4">
                <span className="loading loading-spinner loading-sm text-info"></span>
                <span className="font-semibold text-lg">{uploadState.currentPhase}</span>
              </div>
              <div className="w-full bg-base-300 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-info to-success h-4 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${uploadState.progress}%` }}
                  role="progressbar"
                  aria-valuenow={uploadState.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                ></div>
              </div>
              <div className="text-sm text-base-content/70 mt-2 text-center">
                <strong>{uploadState.progress}%</strong> terminé
              </div>
            </div>
          )}

          {/* Résultat de l'upload */}
          {uploadState.result && restorationStats && (
            <div className="mt-6 p-6 bg-gradient-to-r from-success/10 to-primary/10 rounded-xl border border-success/30">
              <h4 className="font-bold text-success mb-4 flex items-center gap-2 text-xl">
                <FiCheckCircle />
                Restauration Réussie ! 🎉
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {restorationStats.map((stat) => (
                  <div key={stat.label} className={`text-center p-4 bg-${stat.color}/10 rounded-lg`}>
                    <div className={`text-3xl font-bold text-${stat.color} mb-1`}>
                      {stat.value}
                    </div>
                    <div className="text-sm font-medium">{stat.label}</div>
                  </div>
                ))}
              </div>
              
              {uploadState.result.message && (
                <div className="mt-4 p-3 bg-success/5 rounded-lg">
                  <p className="text-sm text-success">
                    <strong>Détails:</strong> {uploadState.result.message}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Erreurs */}
          {uploadState.error && (
            <div className="mt-6 p-6 bg-gradient-to-r from-error/10 to-warning/10 rounded-xl border border-error/30">
              <h4 className="font-bold text-error mb-3 flex items-center gap-2 text-lg">
                <FiAlertTriangle />
                Erreur de Restauration
              </h4>
              <div className="bg-error/5 rounded-lg p-4">
                <p className="text-sm font-medium">{uploadState.error}</p>
              </div>
              
              {uploadState.error.includes('Session expirée') && (
                <div className="mt-3 p-3 bg-info/10 rounded-lg">
                  <p className="text-sm text-info">
                    💡 <strong>Solution:</strong> Rafraîchissez la page et reconnectez-vous pour continuer.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Rapport de sécurité */}
          {uploadState.securityReport && (
            <div className="mt-6">
              <details className="collapse bg-base-200 border border-base-300">
                <summary className="collapse-title font-medium hover:bg-base-300 transition-colors">
                  🔍 Rapport de sécurité détaillé
                </summary>
                <div className="collapse-content bg-base-100">
                  <pre className="text-xs bg-base-300 p-4 rounded overflow-x-auto font-mono">
                    {uploadState.securityReport}
                  </pre>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-base-300 bg-base-50">
          <div className="text-sm text-base-content/60 flex items-center gap-2">
            <FiLock className="text-success" />
            Chiffrement AES-256 • Protection multi-couches
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className="btn btn-outline"
              disabled={uploadState.isUploading}
            >
              {uploadState.isUploading ? 'Restauration en cours...' : 'Fermer'}
            </button>
            {selectedFile && !uploadState.isUploading && !uploadState.result && (
              <button
                onClick={handleSecureUpload}
                className="btn btn-success btn-lg gap-2"
              >
                <FiShield className="w-5 h-5" />
                Démarrer la Restauration
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecureUploadModal;

SecureUploadModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onUploadSuccess: PropTypes.func,
}; 