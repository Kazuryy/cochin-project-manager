import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { 
  FiRotateCcw,
  FiEye,
  FiRefreshCw,
  FiClock,
  FiHardDrive,
  FiAlertTriangle,
  FiCheckCircle,
  FiX,
  FiDatabase,
  FiFile,
  FiShield,
  FiTrash2
} from 'react-icons/fi';
import backupService from '../../../services/backupService';
import { useToast } from '../../../hooks/useToast';
import { ToastContainer } from '../../../components/common/Toast';
import SecureUploadModal from '../../../components/backup/SecureUploadModal';

const DetailsModal = React.memo(({ restore, onClose, getTypeLabel, getStatusBadge }) => {
  if (!restore) return null;

  const isExternal = restore.source_type === 'external';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-base-300">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {isExternal ? '📁' : '🔄'}
            </span>
            <div>
              <h3 id="modal-title" className="text-lg font-bold">
            Détails de la restauration
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-sm font-medium ${isExternal ? 'text-success' : 'text-primary'}`}>
                  {isExternal ? 'Upload externe' : 'Sauvegarde interne'}
                </span>
                {getStatusBadge(restore.status)}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="btn btn-ghost btn-sm"
            aria-label="Fermer"
          >
            <FiX />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Informations générales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-base-content/70">Nom de la restauration</label>
              <p className="font-medium break-words">{restore.restore_name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-base-content/70">Type</label>
              <p>{getTypeLabel(restore.restore_type)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-base-content/70">Date de début</label>
              <p>{restore.started_at ? new Date(restore.started_at).toLocaleString('fr-FR') : 'Non démarrée'}</p>
            </div>
            {restore.completed_at && (
              <div>
                <label className="text-sm font-medium text-base-content/70">Date de fin</label>
                <p>{new Date(restore.completed_at).toLocaleString('fr-FR')}</p>
              </div>
            )}
            {restore.duration_seconds && (
              <div>
                <label className="text-sm font-medium text-base-content/70">Durée</label>
                <p>{Math.floor(restore.duration_seconds / 60)}m {restore.duration_seconds % 60}s</p>
              </div>
            )}
          </div>

          {/* Informations spécifiques selon le type */}
          {isExternal ? (
            /* Restauration externe */
            <div className="bg-success/10 border border-success/30 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <FiShield className="text-success" />
                Informations de l'upload externe
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-base-content/70">Stratégie de fusion</label>
                  <p className="text-sm">
                    {restore.merge_strategy === 'preserve_system' ? '🛡️ Préservation système (recommandé)' : 
                     restore.merge_strategy === 'merge' ? '🔄 Fusion intelligente' : 
                     '⚠️ Remplacement complet'}
                  </p>
                </div>
                {restore.uploaded_backup_info && (
                  <div>
                    <label className="text-sm font-medium text-base-content/70">Fichier source</label>
                    <p className="text-sm break-words">{restore.uploaded_backup_info.original_filename || 'N/A'}</p>
                  </div>
                )}
                {restore.system_tables_preserved !== null && (
                  <div>
                    <label className="text-sm font-medium text-base-content/70">Tables système préservées</label>
                    <p className="text-sm text-success">{restore.system_tables_preserved || 0} tables protégées</p>
                  </div>
                )}
                {restore.conflicts_resolved !== null && (
            <div>
                    <label className="text-sm font-medium text-base-content/70">Conflits résolus</label>
                    <p className="text-sm text-info">{restore.conflicts_resolved || 0} conflits</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Restauration classique */
            restore.backup_source && (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <FiDatabase className="text-primary" />
                  Sauvegarde source
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
                    <label className="text-sm font-medium text-base-content/70">Nom de la sauvegarde</label>
                    <p className="text-sm break-words">{restore.backup_source.backup_name}</p>
            </div>
            <div>
                    <label className="text-sm font-medium text-base-content/70">Type de sauvegarde</label>
                    <p className="text-sm">{restore.backup_source.backup_type}</p>
                  </div>
            </div>
          </div>
            )
          )}

          {/* Statistiques */}
          <div className="bg-base-200 rounded-lg p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <FiAlertTriangle className="text-info" />
              Statistiques de restauration
            </h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-base-100 rounded-lg p-3">
                <div className="text-2xl font-bold text-info">{restore.tables_restored || 0}</div>
                <div className="text-sm text-base-content/70">Tables</div>
              </div>
              <div className="bg-base-100 rounded-lg p-3">
                <div className="text-2xl font-bold text-primary">{restore.records_restored || 0}</div>
                <div className="text-sm text-base-content/70">Enregistrements</div>
              </div>
              <div className="bg-base-100 rounded-lg p-3">
                <div className="text-2xl font-bold text-secondary">{restore.files_restored || 0}</div>
                <div className="text-sm text-base-content/70">Fichiers</div>
              </div>
            </div>
          </div>
          
          {/* Message d'erreur si applicable */}
          {restore.error_message && (
            <div className="bg-error/10 border border-error/30 rounded-lg p-4">
              <h4 className="font-semibold text-error mb-2 flex items-center gap-2">
                <FiX className="text-error" />
                Erreur
              </h4>
              <p className="text-sm text-error break-words">{restore.error_message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

DetailsModal.propTypes = {
  restore: PropTypes.shape({
    restore_name: PropTypes.string,
    restore_type: PropTypes.string,
    status: PropTypes.string,
    backup_source: PropTypes.shape({
      backup_name: PropTypes.string
    }),
    started_at: PropTypes.string,
    duration_seconds: PropTypes.number,
    tables_restored: PropTypes.number,
    records_restored: PropTypes.number,
    files_restored: PropTypes.number,
    error_message: PropTypes.string
  }),
  onClose: PropTypes.func.isRequired,
  getTypeLabel: PropTypes.func.isRequired,
  getStatusBadge: PropTypes.func.isRequired
};

DetailsModal.displayName = 'DetailsModal';

const RestoreHistoryList = () => {
  const [restores, setRestores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailsModal, setShowDetailsModal] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [modalRestorationResult, setModalRestorationResult] = useState(null);
  const [preventRefresh, setPreventRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  
  // 🆕 États pour la suppression
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Hook pour les toasts
  const { toasts, error, success, removeToast } = useToast();

  const loadRestores = useCallback(async () => {
    // Empêcher le refresh si on a des résultats de restauration affichés dans le modal
    if (preventRefresh && modalRestorationResult) {
      console.log('🚫 Refresh empêché pour préserver l\'UX du modal');
      return;
    }
    
    try {
      setLoading(true);
      const data = await backupService.getRestoreHistory();
      if (!data || !Array.isArray(data.results || data)) {
        throw new Error('Format de données invalide');
      }
      setRestores(data.results || data);
      
      // Vérifier s'il y a des restaurations en cours
      const hasRunningRestores = (data.results || data).some(restore => 
        restore.status === 'running' || restore.status === 'pending'
      );
      
      // Configurer le rafraîchissement automatique si nécessaire
      if (hasRunningRestores) {
        if (!refreshInterval) {
          console.log("🔄 Configuration du rafraîchissement automatique pour les restaurations en cours");
          const intervalId = setInterval(() => {
            console.log("🔄 Rafraîchissement automatique des restaurations");
            loadRestores();
          }, 5000); // Rafraîchir toutes les 5 secondes
          setRefreshInterval(intervalId);
        }
      } else if (refreshInterval) {
        // Arrêter le rafraîchissement automatique s'il n'y a plus de restaurations en cours
        console.log("⏹️ Arrêt du rafraîchissement automatique");
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    } catch (err) {
      console.error('Erreur lors du chargement:', err);
      error('Erreur lors du chargement de l\'historique des restaurations');
    } finally {
      setLoading(false);
    }
  }, [error, refreshInterval, preventRefresh, modalRestorationResult]);

  // Nettoyer l'intervalle lors du démontage du composant
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        console.log("⏹️ Nettoyage du rafraîchissement automatique");
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  useEffect(() => {
    loadRestores();
  }, [loadRestores]);

  const handleUploadSuccess = useCallback((result) => {
    try {
      console.log('📊 Résultat upload reçu:', result);
      
      // Stocker le résultat dans le state du parent pour éviter qu'il soit perdu lors des re-renders
      setModalRestorationResult(result);
      
      // Activer la protection anti-refresh pour préserver l'UX
      setPreventRefresh(true);
      
      // Gérer les deux formats : système externe vs classique
      let tablesRestored = 0, recordsRestored = 0, filesRestored = 0;
      
      if (result.restoration) {
        // Système externe : les stats sont dans result.restoration
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
      
      console.log('📈 Statistiques extraites:', { tablesRestored, recordsRestored, filesRestored });
      
      // Toast de succès simple et propre
      const successMessage = `Restauration terminée avec succès ! ${tablesRestored} tables, ${recordsRestored} enregistrements, ${filesRestored} fichiers restaurés.`;
      success(successMessage, 5000);
      
      // Rafraîchir la liste des restaurations SEULEMENT si le modal est fermé
      // Évite le "flash" désagréable pendant que l'utilisateur voit les résultats
      setTimeout(() => {
        if (!showUploadModal) {
    loadRestores();
        }
      }, 2000); // 2 secondes de délai
      
    } catch (err) {
      console.error('❌ Erreur dans handleUploadSuccess:', err);
      error('Erreur lors du traitement du résultat d\'upload', 5000);
    }
  }, [success, error, loadRestores, showUploadModal]);

  // 🆕 Fonction pour supprimer une restauration
  const handleDeleteRestoration = useCallback(async (restoration) => {
    try {
      setDeleteLoading(true);
      
      await backupService.deleteRestorationAuto(restoration);
      
      // Mettre à jour la liste locale
      setRestores(prev => prev.filter(r => r.id !== restoration.id));
      
      // Toast de succès
      success(`Restauration "${restoration.restore_name}" supprimée avec succès`, 3000);
      
      // Fermer le modal
      setShowDeleteModal(null);
      
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      error('Erreur lors de la suppression de la restauration', 5000);
    } finally {
      setDeleteLoading(false);
    }
  }, [success, error]);

  const statusConfig = useMemo(() => ({
    'completed': { class: 'badge-success', label: 'Terminée' },
    'failed': { class: 'badge-error', label: 'Échec' },
    'running': { class: 'badge-info', label: 'En cours' },
    'pending': { class: 'badge-warning', label: 'En attente' }
  }), []);

  const typeLabels = useMemo(() => ({
    'full': 'Complète',
    'selective': 'Sélective',
    'merge': 'Fusion'
  }), []);

  // 🆕 Labels pour les sources de restauration
  const sourceLabels = useMemo(() => ({
    'classic': { icon: '🔄', label: 'Sauvegarde interne', color: 'text-primary' },
    'external': { icon: '📁', label: 'Upload externe', color: 'text-success' }
  }), []);

  const getStatusIcon = useCallback((status) => {
    switch (status) {
      case 'completed':
        return <FiCheckCircle className="text-success" />;
      case 'failed':
        return <FiX className="text-error" />;
      case 'running':
        return <span className="loading loading-spinner loading-xs text-info"></span>;
      default:
        return <FiClock className="text-warning" />;
    }
  }, []);

  const getStatusBadge = useCallback((status) => {
    const config = statusConfig[status] || { class: 'badge-ghost', label: status };
    return <span className={`badge ${config.class}`}>{config.label}</span>;
  }, [statusConfig]);

  const getTypeLabel = useCallback((type) => {
    return typeLabels[type] || type;
  }, [typeLabels]);

  // 🆕 Fonction pour obtenir les infos de source avec icône
  const getSourceInfo = useCallback((restore) => {
    const sourceType = restore.source_type || 'classic';
    const sourceConfig = sourceLabels[sourceType] || sourceLabels['classic'];
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg">{sourceConfig.icon}</span>
        <div className="flex flex-col">
          <span className={`text-xs font-medium ${sourceConfig.color}`}>
            {sourceConfig.label}
          </span>
          {restore.source_type === 'external' && restore.merge_strategy && (
            <span className="text-xs text-base-content/60">
              {restore.merge_strategy === 'preserve_system' ? 'Préservation système' : 
               restore.merge_strategy === 'merge' ? 'Fusion intelligente' : 
               'Remplacement'}
            </span>
          )}
        </div>
      </div>
    );
  }, [sourceLabels]);

  if (loading && !restores.length) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conteneur de toasts */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Historique des restaurations</h2>
          <p className="text-base-content/70 mt-1">
            {restores.length} restauration{restores.length !== 1 ? 's' : ''} trouvée{restores.length !== 1 ? 's' : ''}
            {refreshInterval && <span className="ml-2 text-info">(Rafraîchissement automatique actif)</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn btn-success gap-2"
            aria-label="Upload sécurisé"
          >
            <FiShield className="w-4 h-4" />
            Upload Sécurisé
          </button>
          <button
            onClick={loadRestores}
            className="btn btn-outline"
            disabled={loading}
            aria-label="Actualiser"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Liste des restaurations */}
      {restores.length === 0 ? (
        <div className="text-center py-12">
          <FiRotateCcw className="mx-auto text-6xl text-base-content/30 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Aucune restauration trouvée</h3>
          <p className="text-base-content/70">
            Aucune restauration n'a encore été effectuée
          </p>
        </div>
      ) : (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Statut</th>
                    <th>Nom de la restauration</th>
                    <th>Source</th>
                    <th>Type</th>
                    <th>Statistiques</th>
                    <th>Durée</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {restores.map((restore) => (
                    <tr key={`${restore.source_type || 'classic'}-${restore.id}`}>
                      <td>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(restore.status)}
                          {getStatusBadge(restore.status)}
                        </div>
                      </td>
                      <td>
                        <div className="font-medium truncate max-w-xs" title={restore.restore_name}>
                          {restore.restore_name}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          {getSourceInfo(restore)}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-outline">
                          {getTypeLabel(restore.restore_type)}
                        </span>
                      </td>
                      <td>
                        <div className="text-sm space-y-1">
                          {restore.tables_restored !== null && (
                            <div className="flex items-center gap-1">
                              <FiDatabase className="w-3 h-3 text-info" />
                              <span>{restore.tables_restored || 0} tables</span>
                            </div>
                          )}
                          {restore.records_restored !== null && (
                            <div className="flex items-center gap-1">
                              <FiFile className="w-3 h-3 text-primary" />
                              <span>{restore.records_restored || 0} enreg.</span>
                            </div>
                          )}
                          {restore.files_restored !== null && restore.files_restored > 0 && (
                            <div className="flex items-center gap-1">
                              <FiHardDrive className="w-3 h-3 text-secondary" />
                              <span>{restore.files_restored} fichiers</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          {restore.duration_seconds ? (
                            <div className="flex items-center gap-1">
                              <FiClock className="w-3 h-3 text-base-content/60" />
                              {Math.floor(restore.duration_seconds / 60)}m {restore.duration_seconds % 60}s
                            </div>
                          ) : (
                            <span className="text-base-content/50">-</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          {restore.started_at ? (
                            new Date(restore.started_at).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          ) : (
                            <span className="text-base-content/50">-</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowDetailsModal(restore)}
                            className="btn btn-ghost btn-sm"
                            aria-label={`Voir les détails de ${restore.restore_name}`}
                          >
                            <FiEye />
                          </button>
                          {/* 🆕 Bouton de suppression */}
                          <button
                            onClick={() => setShowDeleteModal(restore)}
                            className="btn btn-ghost btn-sm text-error hover:bg-error/20"
                            aria-label={`Supprimer ${restore.restore_name}`}
                            disabled={restore.status === 'running' || restore.status === 'pending'}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de détails */}
      <DetailsModal 
        restore={showDetailsModal} 
        onClose={() => setShowDetailsModal(null)}
        getTypeLabel={getTypeLabel}
        getStatusBadge={getStatusBadge}
      />

      {/* Modal d'upload sécurisé */}
      <SecureUploadModal 
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setModalRestorationResult(null); // Reset quand on ferme
          setPreventRefresh(false); // Réactiver les refreshs
          // Rafraîchir la liste maintenant que le modal est fermé
          loadRestores();
        }}
        onUploadSuccess={handleUploadSuccess}
        externalRestorationResult={modalRestorationResult}
      />

      {/* 🆕 Modal de confirmation de suppression */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-lg shadow-xl max-w-sm w-full">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-error/20 rounded-full">
                  <FiTrash2 className="text-error text-lg" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Supprimer la restauration</h3>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm mb-3 text-base-content/80">
                  Confirmer la suppression de l'entrée d'historique ?
                </p>
                <div className="bg-base-200 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">
                      {showDeleteModal.source_type === 'external' ? '📁' : '🔄'}
                    </span>
                    <span className="text-xs text-base-content/60">
                      {showDeleteModal.source_type === 'external' ? 'Upload externe' : 'Sauvegarde interne'}
                    </span>
                  </div>
                  <div className="text-xs font-mono bg-base-300 rounded px-2 py-1 break-all">
                    {showDeleteModal.restore_name}
                  </div>
                  <div className="text-xs text-base-content/50 mt-1">
                    {showDeleteModal.started_at && new Date(showDeleteModal.started_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  className="btn btn-outline btn-sm"
                  disabled={deleteLoading}
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDeleteRestoration(showDeleteModal)}
                  className="btn btn-error btn-sm"
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      Suppression...
                    </>
                  ) : (
                    <>
                      <FiTrash2 />
                      Supprimer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(RestoreHistoryList); 