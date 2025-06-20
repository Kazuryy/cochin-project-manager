import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FiUpload, FiX, FiShield, FiAlertTriangle, FiCheckCircle, FiFileText, FiLock, FiDatabase, FiSave, FiInfo } from 'react-icons/fi';
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
  ANALYZING: '🔍 Analyse du fichier...',
  SECURITY: '✅ Validation du fichier...',
  RESTORING: '📦 Restauration des données...',
  FINALIZING: '🏁 Finalisation...',
  SUCCESS: '🎉 Restauration réussie !',
  FAILED: '❌ Échec de la restauration',
  AUTH_FAILED: '🔐 Échec d\'authentification',
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

// Options du système de restauration
const RESTORE_SYSTEMS = {
  EXTERNAL: {
    id: 'external',
    name: 'Système externe sécurisé',
    description: 'Système recommandé avec validation avancée',
    icon: '🛡️',
    security: 'HIGH',
    compatibility: 'Recommended'
  }
};

const SecureUploadModal = ({ isOpen, onClose, onUploadSuccess, externalRestorationResult }) => {
  // États regroupés logiquement
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadState, setUploadState] = useState(initialUploadState);
  const [mergeStrategy, setMergeStrategy] = useState('preserve_system');
  
  const fileInputRef = useRef(null);

  // 🆕 Ref pour sauvegarder la position de scroll
  const savedScrollPosition = useRef(0);

  // État local pour les résultats de restauration (indépendant de uploadState)
  const [restorationResult, setRestorationResult] = useState(null);
  
  // Reset du résultat quand le modal s'ouvre/ferme
  useEffect(() => {
    console.log('🔄 useEffect isOpen:', { isOpen, restorationResult });
    if (!isOpen) {
      console.log('🧹 Reset restorationResult car modal fermé');
      setRestorationResult(null);
    }
  }, [isOpen, restorationResult]);

  // 🆕 Gestion de la position de scroll quand le modal s'ouvre/ferme
  useEffect(() => {
    if (isOpen) {
      // Sauvegarder la position de scroll actuelle
      savedScrollPosition.current = window.pageYOffset;
      console.log('💾 Position de scroll sauvegardée:', savedScrollPosition.current);
      
      // Bloquer le scroll du body
      document.body.style.overflow = 'hidden';
    } else {
      // Restaurer le scroll du body
      document.body.style.overflow = '';
      
      // Restaurer la position de scroll avec un délai pour laisser le modal se fermer
      if (savedScrollPosition.current > 0) {
        setTimeout(() => {
          window.scrollTo({
            top: savedScrollPosition.current,
            behavior: 'instant'
          });
          console.log('🔄 Position de scroll restaurée:', savedScrollPosition.current);
        }, 0);
      }
    }

    // Cleanup au démontage du composant
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

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
      console.log('Type MIME suspect', file.type);
    }

    return true;
  }, []);

  // Réinitialisation complète du modal
  const resetModal = useCallback(() => {
    setSelectedFile(null);
    setUploadState(initialUploadState);
    setDragActive(false);
    setMergeStrategy('preserve_system');
    setRestorationResult(null);
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
      // 🆕 SYSTÈME EXTERNE SÉCURISÉ
      console.log('Démarrage upload externe sécurisé', { 
        fileName: selectedFile.name, 
        size: selectedFile.size,
        mergeStrategy: mergeStrategy
      });

      // Phase validation
      updateUploadState({
        currentPhase: '✅ Validation du fichier...',
        progress: 20,
      });

      // Générer un nom d'upload unique
      const uploadName = `Upload_${selectedFile.name.replace(/\.[^/.]+$/, "")}_${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '')}`;

      // Upload avec système externe
      const response = await backupService.uploadAndRestoreExternal(
        selectedFile,
        uploadName,
        mergeStrategy,
        (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 50) / progressEvent.total) + 20;
          updateUploadState({ progress: Math.min(progress, 70) });
        }
      );

      // Phase restauration externe
      updateUploadState({
        currentPhase: '📦 Restauration des données...',
        progress: 85,
      });

      // Finalisation commune
      updateUploadState({
        currentPhase: UPLOAD_PHASES.FINALIZING,
        progress: 95,
      });

      console.log('Réponse complète', {
        response,
        type: typeof response,
        success: response?.success
      });

      // Vérification de la réponse
      if (response?.success) {
        // Stocker le résultat immédiatement dans un state séparé
        console.log('🎯 setRestorationResult appelé avec:', response);
        setRestorationResult(response);
        
        updateUploadState({
          result: response,
          securityReport: response.security_report,
          currentPhase: '🎉 Restauration terminée !',
          progress: 100,
        });

        // Notification de succès via callback
        onUploadSuccess?.(response);

        // PAS de fermeture automatique - laisser l'utilisateur voir les résultats
        // Le modal reste ouvert pour afficher les statistiques
      } else {
        console.log('Réponse invalide détectée', {
          response,
          hasResponse: !!response,
          hasSuccess: response?.success,
          responseKeys: response ? Object.keys(response) : 'undefined'
        });
        throw new Error(response?.error || 'Réponse invalide du serveur');
      }

    } catch (err) {
      console.log('Erreur upload sécurisé', err);
      
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
  }, [selectedFile, mergeStrategy, updateUploadState, onUploadSuccess]);

  // Statistiques de restauration memoized - utilise la prop externe en priorité
  const restorationStats = useMemo(() => {
    const activeResult = externalRestorationResult || restorationResult;
    console.log('🔍 restorationStats calculé:', { 
      externalRestorationResult, 
      restorationResult, 
      activeResult, 
      hasResult: !!activeResult 
    });
    if (!activeResult) return null;
    
    const result = activeResult;
    
    // Pour le système externe, les statistiques sont dans result.restoration
    // Pour le système classique, elles sont au niveau racine
    let tablesRestored = 0, recordsRestored = 0, filesRestored = 0;
    
    if (result.restoration) {
      // Système externe : les stats peuvent être dans restoration directement ou dans restoration.data
      const restoration = result.restoration;
      tablesRestored = restoration.tables_restored || restoration.data?.tables_restored || 0;
      recordsRestored = restoration.records_restored || restoration.data?.records_restored || 0; 
      filesRestored = restoration.files_restored || restoration.data?.files_restored || 0;
    } else {
      // Système classique : les stats sont au niveau racine
      tablesRestored = result.tables_restored || 0;
      recordsRestored = result.records_restored || 0;
      filesRestored = result.files_restored || 0;
    }
    
    return [
      {
        value: tablesRestored,
        label: 'Tables restaurées',
        color: 'success',
      },
      {
        value: recordsRestored,
        label: 'Enregistrements',
        color: 'info',
      },
      {
        value: filesRestored,
        label: 'Fichiers restaurés',
        color: 'primary',
      },
    ];
  }, [externalRestorationResult, restorationResult]);

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
                📦 Restauration de Sauvegarde
              </h2>
              <p id="modal-description" className="text-base-content/70">
                Import et restauration de fichiers de sauvegarde
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

        {/* Zone d'upload - masquée si succès */}
        {!(externalRestorationResult || restorationResult) && (
          <div className="p-6 space-y-6">
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
                📂 Sélectionnez votre fichier de sauvegarde
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
            <>
              {/* Options de restauration */}
              <div className="p-6 bg-gradient-to-r from-success/5 to-info/5 rounded-xl border border-success/30">
              <h4 className="font-bold mb-4 flex items-center gap-2 text-lg">
                <FiDatabase className="text-info" />
                  🛡️ Stratégie de Fusion
              </h4>
              
                <div className="space-y-2">
                  {[
                    { value: 'preserve_system', label: 'Préserver système', desc: 'Recommandé' },
                    { value: 'merge', label: 'Fusion intelligente', desc: 'Fusion avec validation' }
                  ].map(strategy => (
                    <label key={strategy.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="radio"
                        name="mergeStrategy"
                        value={strategy.value}
                        checked={mergeStrategy === strategy.value}
                        onChange={(e) => setMergeStrategy(e.target.value)}
                        className="radio radio-success radio-sm"
                      />
                      <span className="text-sm font-medium">{strategy.label}</span>
                      <span className="text-xs text-base-content/60">- {strategy.desc}</span>
                  </label>
                  ))}
                </div>
              </div>
            </>
          )}
          </div>
        )}

        {/* Zone des statistiques de succès - toujours visible si résultat */}
        {(externalRestorationResult || restorationResult) && restorationStats && (
          <div className="p-6 space-y-6">
            <div className="bg-gradient-to-r from-success/10 to-primary/10 rounded-xl border border-success/30 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-success/20 rounded-full">
                  <FiCheckCircle className="w-6 h-6 text-success" />
                </div>
                    <div>
                  <h4 className="font-bold text-success text-xl">
                    🎉 Restauration terminée avec succès !
                  </h4>
                  <p className="text-sm text-base-content/70">
                    Vos données ont été importées avec succès
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {restorationStats.map((stat) => (
                  <div key={stat.label} className={`text-center p-4 bg-${stat.color}/10 rounded-lg border border-${stat.color}/20`}>
                    <div className={`text-2xl font-bold text-${stat.color} mb-1`}>
                      {stat.value}
                    </div>
                    <div className="text-sm font-medium text-base-content/70">{stat.label}</div>
                  </div>
                ))}
              </div>
              
              {(externalRestorationResult || restorationResult)?.message && (
                <div className="p-3 bg-info/10 rounded-lg border border-info/20">
                  <p className="text-sm text-info flex items-center gap-2">
                    <FiInfo className="w-4 h-4" />
                    <strong>Détails:</strong> {(externalRestorationResult || restorationResult)?.message}
                  </p>
                </div>
              )}
              
              <div className="mt-4 text-center">
                <button
                  onClick={handleClose}
                  className="btn btn-primary gap-2"
                >
                  <FiCheckCircle className="w-4 h-4" />
                  Terminer et fermer
                </button>
                </div>
              </div>
            </div>
          )}

          {/* Progression */}
        <div className="p-6 space-y-6">
          {uploadState.isUploading && (
            <div className="p-6 bg-gradient-to-r from-info/10 to-success/10 rounded-xl border border-info/30">
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

          {/* Erreurs */}
          {uploadState.error && (
            <div className="p-6 bg-gradient-to-r from-error/10 to-warning/10 rounded-xl border border-error/30">
              <h4 className="font-bold text-error mb-3 flex items-center gap-2 text-lg">
                <FiAlertTriangle />
                Erreur de Restauration
              </h4>
              <div className="bg-error/5 rounded-lg p-4">
                <div className="text-sm font-medium whitespace-pre-line">
                  {uploadState.error}
                </div>
              </div>
              
              {uploadState.error.includes('Session expirée') && (
                <div className="mt-3 p-3 bg-info/10 rounded-lg">
                  <p className="text-sm text-info">
                    💡 <strong>Solution:</strong> Rafraîchissez la page et reconnectez-vous pour continuer.
                  </p>
                </div>
              )}
              
              {uploadState.error.includes('fichier uploadé n\'est pas reconnu') && (
                <div className="mt-3 p-3 bg-warning/10 rounded-lg">
                  <p className="text-sm text-warning">
                    💡 <strong>Conseil:</strong> Utilisez un fichier de sauvegarde généré par cette application ou vérifiez le format du fichier.
                  </p>
                </div>
              )}
              
              {uploadState.error.includes('Timeout atteint') && (
                <div className="mt-3 p-3 bg-info/10 rounded-lg">
                  <p className="text-sm text-info">
                    💡 <strong>Solution:</strong> Essayez de relancer l'opération. Les gros fichiers peuvent nécessiter plus de temps.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Rapport de sécurité */}
          {uploadState.securityReport && (
            <div>
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
  externalRestorationResult: PropTypes.object,
}; 