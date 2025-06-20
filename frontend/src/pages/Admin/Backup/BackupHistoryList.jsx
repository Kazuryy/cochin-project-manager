import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { 
  FiDownload,
  FiTrash2,
  FiRotateCcw,
  FiEye,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiClock,
  FiHardDrive,
  FiAlertTriangle,
  FiCheckCircle,
  FiX,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import backupService from '../../../services/backupService';
import { useToast, ToastContainer } from '../../../components/common/Toast';
import BackupStatsWidget from './BackupStatsWidget';

// Hook personnalisé pour la gestion des filtres
const useFilters = (initialFilters) => {
  const [filters, setFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  return {
    filters,
    showFilters,
    setShowFilters,
    handleFilterChange,
    resetFilters
  };
};

// Hook personnalisé pour la gestion des sauvegardes
const useBackups = (pageSize) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const loadBackups = useCallback(async (page = 1, filters = {}) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: pageSize,
        ...filters
      };
      
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] == null) {
          delete params[key];
        }
      });

      const data = await backupService.getBackupHistory(params);
      
      if (data.results) {
        setBackups(data.results);
        setTotalItems(data.count || 0);
        setTotalPages(Math.ceil((data.count || 0) / pageSize));
      } else {
        setBackups(data || []);
        setTotalItems(data.length || 0);
        setTotalPages(1);
      }
      
      setCurrentPage(page);
    } catch (err) {
      console.error('Erreur lors du chargement:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  return {
    backups,
    loading,
    actionLoading,
    setActionLoading,
    currentPage,
    totalPages,
    totalItems,
    loadBackups
  };
};

// Composant pour le modal de détails
const DetailsModal = React.memo(({ backup, onClose }) => {
  if (!backup) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-base-300">
          <h2 className="text-2xl font-bold flex items-center">
            <FiEye className="mr-3 text-primary" />
            Détails de la sauvegarde
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            <FiX className="text-xl" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="backup-name" className="label-text font-semibold">Nom</label>
              <p id="backup-name">{backup.backup_name}</p>
            </div>
            <div>
              <label htmlFor="backup-type" className="label-text font-semibold">Type</label>
              <p id="backup-type">{getTypeLabel(backup.backup_type)}</p>
            </div>
            <div>
              <label htmlFor="backup-status" className="label-text font-semibold">Statut</label>
              <p id="backup-status">{getStatusBadge(backup.status)}</p>
            </div>
            <div>
              <label htmlFor="backup-size" className="label-text font-semibold">Taille</label>
              <p id="backup-size">{backup.file_size ? backupService.formatFileSize(backup.file_size) : 'N/A'}</p>
            </div>
            <div>
              <label htmlFor="backup-date" className="label-text font-semibold">Date de création</label>
              <p id="backup-date">{backupService.formatDate(backup.created_at)}</p>
            </div>
            <div>
              <label htmlFor="backup-duration" className="label-text font-semibold">Durée</label>
              <p id="backup-duration">{backup.duration_seconds ? backupService.formatDuration(backup.duration_seconds) : 'N/A'}</p>
            </div>
          </div>
          
          {backup.error_message && (
            <div className="alert alert-error">
              <FiAlertTriangle />
              <span>{backup.error_message}</span>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-base-300">
            <button onClick={onClose} className="btn btn-outline">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

DetailsModal.propTypes = {
  backup: PropTypes.shape({
    id: PropTypes.string.isRequired,
    backup_name: PropTypes.string.isRequired,
    backup_type: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    file_size: PropTypes.number,
    created_at: PropTypes.string.isRequired,
    duration_seconds: PropTypes.number,
    error_message: PropTypes.string
  }),
  onClose: PropTypes.func.isRequired
};

// Composant pour le modal de suppression
const DeleteModal = React.memo(({ backup, onClose, onConfirm, loading }) => {
  if (!backup) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <FiAlertTriangle className="text-warning text-2xl mr-3" />
          <h3 className="text-lg font-bold">Confirmer la suppression</h3>
        </div>
        <p className="mb-6">
          Êtes-vous sûr de vouloir supprimer la sauvegarde{' '}
          <span className="font-semibold">"{backup.backup_name}"</span> ?
          Cette action est irréversible.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn btn-outline"
            disabled={loading}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="btn btn-error"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm mr-2" />{' '}
                Suppression...
              </>
            ) : (
              <>
                <FiTrash2 className="mr-2" />
                Supprimer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

DeleteModal.propTypes = {
  backup: PropTypes.shape({
    id: PropTypes.string.isRequired,
    backup_name: PropTypes.string.isRequired
  }),
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired
};

// Fonctions utilitaires
const getStatusIcon = (status) => {
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
};

const getStatusBadge = (status) => {
  const statusConfig = {
    'completed': { class: 'badge-success', label: 'Terminé' },
    'failed': { class: 'badge-error', label: 'Échec' },
    'running': { class: 'badge-info', label: 'En cours' },
    'pending': { class: 'badge-warning', label: 'En attente' }
  };
  
  const config = statusConfig[status] || { class: 'badge-ghost', label: status };
  return <span className={`badge ${config.class}`}>{config.label}</span>;
};

const getTypeLabel = (type) => {
  const types = {
    'full': 'Complète',
    'metadata': 'Métadonnées', 
    'data': 'Données'
  };
  return types[type] || type;
};

const BackupHistoryList = () => {
  const { toasts, addToast, removeToast } = useToast();
  const pageSize = 10;
  
  // Mémorisation des fonctions utilitaires
  const memoizedGetStatusIcon = useMemo(() => getStatusIcon, []);
  const memoizedGetStatusBadge = useMemo(() => getStatusBadge, []);
  const memoizedGetTypeLabel = useMemo(() => getTypeLabel, []);

  const {
    filters,
    showFilters,
    setShowFilters,
    handleFilterChange,
    resetFilters
  } = useFilters({
    search: '',
    backup_type: '',
    status: '',
    date_from: '',
    date_to: ''
  });

  const {
    backups,
    loading,
    actionLoading,
    setActionLoading,
    currentPage,
    totalPages,
    totalItems,
    loadBackups
  } = useBackups(pageSize);

  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(null);

  // Fonctions helper pour les toasts
  const success = useCallback((message) => {
    addToast(message, 'success');
  }, [addToast]);

  const error = useCallback((message) => {
    addToast(message, 'error');
  }, [addToast]);

  useEffect(() => {
    loadBackups(1).catch(() => {
      error('Erreur lors du chargement de l\'historique');
    });
  }, [loadBackups, error]);

  const applyFilters = useCallback(() => {
    loadBackups(1, filters).catch(() => {
      error('Erreur lors du chargement de l\'historique');
    });
  }, [filters, loadBackups, error]);

  const handlePageChange = useCallback((page) => {
    if (page >= 1 && page <= totalPages) {
      loadBackups(page).catch(() => {
        error('Erreur lors du chargement de l\'historique');
      });
    }
  }, [totalPages, loadBackups, error]);

  const downloadBackup = useCallback(async (backup) => {
    try {
      setActionLoading(backup.id);
      
      // Le service downloadBackup gère déjà tout le processus de téléchargement
      const result = await backupService.downloadBackup(backup.id);
      
      if (result.success) {
        success(`Téléchargement de "${backup.backup_name}" démarré (déchiffrement automatique)`);
      } else {
        throw new Error(result.message || 'Erreur lors du téléchargement');
      }
      
    } catch (err) {
      console.error('Erreur lors du téléchargement:', err);
      error('Erreur lors du téléchargement: ' + (err.message || 'Erreur inconnue'));
    } finally {
      setActionLoading(null);
    }
  }, [setActionLoading, success, error]);

  const deleteBackup = useCallback(async (backupId) => {
    try {
      setActionLoading(backupId);
      await backupService.deleteBackup(backupId);
      await loadBackups(currentPage);
      setShowDeleteModal(null);
      success('Sauvegarde supprimée avec succès');
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      error('Erreur lors de la suppression');
    } finally {
      setActionLoading(null);
    }
  }, [currentPage, loadBackups, setActionLoading, success, error]);

  const restoreBackup = useCallback(async (backup) => {
    try {
      setActionLoading(backup.id);
      
      // Récupérer le token CSRF des cookies
      const getCsrfToken = () => {
        return document.cookie
          .split('; ')
          .find(row => row.startsWith('csrftoken='))
          ?.split('=')[1] || '';
      };
      
      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        console.warn('Aucun token CSRF trouvé dans les cookies');
      }
      
      // Appel direct avec fetch au lieu d'utiliser api.post
      const response = await fetch('/api/backup/restore/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          backup_id: backup.id
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Erreur lors de la restauration (${response.status}):`, errorData);
        throw new Error(errorData.message || errorData.error || `Erreur ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('Réponse de restauration:', responseData);
      
      success(`Restauration de "${backup.backup_name}" lancée`);
      
      // Configurer un rafraîchissement automatique pour s'assurer que les statuts sont à jour
      const checkInterval = setInterval(async () => {
        console.log("🔄 Rafraîchissement automatique après restauration");
        await loadBackups(currentPage);
        
        // Vérifier si la restauration est terminée via l'API
        try {
          const restoreId = responseData?.data?.restore?.id;
          if (restoreId) {
            const statusResponse = await backupService.getOperationStatus(restoreId, 'restore');
            const restoreStatus = statusResponse?.restore_status?.status;
            console.log(`🔍 Statut de la restauration ${restoreId}: ${restoreStatus}`);
            
            // Arrêter le rafraîchissement une fois la restauration terminée
            if (restoreStatus === 'completed' || restoreStatus === 'failed') {
              console.log("⏹️ Arrêt du rafraîchissement automatique - restauration terminée");
              clearInterval(checkInterval);
            }
          }
        } catch (statusErr) {
          console.error("Erreur lors de la vérification du statut:", statusErr);
        }
      }, 5000); // Rafraîchir toutes les 5 secondes (moins agressif)
      
      // Arrêter le rafraîchissement après 2 minutes dans tous les cas
      setTimeout(() => {
        if (checkInterval) {
          console.log("⏹️ Arrêt du rafraîchissement automatique après timeout");
          clearInterval(checkInterval);
          loadBackups(currentPage); // Rafraîchir une dernière fois
        }
      }, 120000); // 2 minutes au lieu de 1
      
    } catch (err) {
      console.error('Erreur lors de la restauration:', err);
      error('Erreur lors de la restauration: ' + (err.message || 'Erreur inconnue'));
    } finally {
      setActionLoading(null);
    }
  }, [setActionLoading, success, error, loadBackups, currentPage]);

  if (loading && backups.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      
      {backups.length > 0 && <BackupStatsWidget backups={backups} />}
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Historique des sauvegardes</h2>
            <p className="text-base-content/70 mt-1">
              {totalItems} sauvegarde{totalItems !== 1 ? 's' : ''} trouvée{totalItems !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn btn-outline ${showFilters ? 'btn-active' : ''}`}
            >
              <FiFilter className="mr-2" />
              Filtres
            </button>
            <button
              onClick={() => loadBackups(currentPage)}
              className="btn btn-outline"
              disabled={loading}
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="card bg-base-200">
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="form-control">
                  <label htmlFor="search" className="label">
                    <span className="label-text">Recherche</span>
                  </label>
                  <input
                    id="search"
                    type="text"
                    placeholder="Nom de sauvegarde..."
                    className="input input-bordered input-sm"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                  />
                </div>

                <div className="form-control">
                  <label htmlFor="backup-type" className="label">
                    <span className="label-text">Type</span>
                  </label>
                  <select
                    id="backup-type"
                    className="select select-bordered select-sm"
                    value={filters.backup_type}
                    onChange={(e) => handleFilterChange('backup_type', e.target.value)}
                  >
                    <option value="">Tous</option>
                    <option value="full">Complète</option>
                    <option value="metadata">Métadonnées</option>
                    <option value="data">Données</option>
                  </select>
                </div>

                <div className="form-control">
                  <label htmlFor="status" className="label">
                    <span className="label-text">Statut</span>
                  </label>
                  <select
                    id="status"
                    className="select select-bordered select-sm"
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    <option value="">Tous</option>
                    <option value="completed">Terminé</option>
                    <option value="failed">Échec</option>
                    <option value="running">En cours</option>
                    <option value="pending">En attente</option>
                  </select>
                </div>

                <div className="form-control">
                  <label htmlFor="date-from" className="label">
                    <span className="label-text">Date début</span>
                  </label>
                  <input
                    id="date-from"
                    type="date"
                    className="input input-bordered input-sm"
                    value={filters.date_from}
                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                  />
                </div>

                <div className="form-control">
                  <label htmlFor="date-to" className="label">
                    <span className="label-text">Date fin</span>
                  </label>
                  <input
                    id="date-to"
                    type="date"
                    className="input input-bordered input-sm"
                    value={filters.date_to}
                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <button onClick={resetFilters} className="btn btn-ghost btn-sm">
                  Réinitialiser
                </button>
                <button onClick={applyFilters} className="btn btn-primary btn-sm">
                  <FiSearch className="mr-2" />
                  Rechercher
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {backups.length === 0 ? (
        <div className="text-center py-12">
          <FiHardDrive className="mx-auto text-6xl text-base-content/30 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Aucune sauvegarde trouvée</h3>
          <p className="text-base-content/70">
            {Object.values(filters).some(v => v) ? 
              'Aucune sauvegarde ne correspond aux filtres sélectionnés' :
              'Aucune sauvegarde n\'a encore été créée'
            }
          </p>
        </div>
      ) : (
        <>
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body p-0">
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Type</th>
                      <th>Statut</th>
                      <th>Taille</th>
                      <th>Date</th>
                      <th>Durée</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup) => (
                      <tr key={backup.id}>
                        <td>
                          <div className="font-medium">{backup.backup_name}</div>
                        </td>
                        <td>
                          <span className="badge badge-outline">
                            {memoizedGetTypeLabel(backup.backup_type)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center space-x-2">
                            {memoizedGetStatusIcon(backup.status)}
                            {memoizedGetStatusBadge(backup.status)}
                          </div>
                        </td>
                        <td>
                          {backup.file_size ? backupService.formatFileSize(backup.file_size) : '-'}
                        </td>
                        <td className="font-mono text-sm">
                          {backupService.formatDate(backup.created_at)}
                        </td>
                        <td>
                          {backup.duration_seconds ? backupService.formatDuration(backup.duration_seconds) : '-'}
                        </td>
                        <td>
                          <div className="flex space-x-1">
                            <div className="tooltip" data-tip="Voir détails">
                              <button
                                onClick={() => setShowDetailsModal(backup)}
                                className="btn btn-ghost btn-xs"
                              >
                                <FiEye />
                              </button>
                            </div>

                            {backup.status === 'completed' && (
                              <>
                                <div className="tooltip" data-tip="Télécharger">
                                  <button
                                    onClick={() => downloadBackup(backup)}
                                    className="btn btn-ghost btn-xs text-info"
                                    disabled={actionLoading === backup.id}
                                  >
                                    {actionLoading === backup.id ? (
                                      <span className="loading loading-spinner loading-xs"></span>
                                    ) : (
                                      <FiDownload />
                                    )}
                                  </button>
                                </div>

                                <div className="tooltip" data-tip="Restaurer">
                                  <button
                                    onClick={() => restoreBackup(backup)}
                                    className="btn btn-ghost btn-xs text-success"
                                    disabled={actionLoading === backup.id}
                                  >
                                    {actionLoading === backup.id ? (
                                      <span className="loading loading-spinner loading-xs"></span>
                                    ) : (
                                      <FiRotateCcw />
                                    )}
                                  </button>
                                </div>
                              </>
                            )}

                            <div className="tooltip" data-tip="Supprimer">
                              <button
                                onClick={() => setShowDeleteModal(backup)}
                                className="btn btn-ghost btn-xs text-error"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center">
              <div className="join">
                <button
                  className="join-item btn btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  <FiChevronLeft />
                </button>
                
                {[...Array(totalPages)].map((_, index) => {
                  const page = index + 1;
                  const isActive = page === currentPage;
                  
                  if (
                    page === 1 || 
                    page === totalPages || 
                    (page >= currentPage - 2 && page <= currentPage + 2)
                  ) {
                    return (
                      <button
                        key={page}
                        className={`join-item btn btn-sm ${isActive ? 'btn-active' : ''}`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    );
                  }
                  
                  if (page === currentPage - 3 || page === currentPage + 3) {
                    return (
                      <span key={page} className="join-item btn btn-sm btn-disabled">
                        ...
                      </span>
                    );
                  }
                  
                  return null;
                })}
                
                <button
                  className="join-item btn btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <DetailsModal 
        backup={showDetailsModal} 
        onClose={() => setShowDetailsModal(null)} 
      />

      <DeleteModal
        backup={showDeleteModal}
        onClose={() => setShowDeleteModal(null)}
        onConfirm={() => deleteBackup(showDeleteModal?.id)}
        loading={actionLoading === showDeleteModal?.id}
      />
    </div>
  );
};

export default BackupHistoryList; 