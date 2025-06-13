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
  FiShield
} from 'react-icons/fi';
import backupService from '../../../services/backupService';
import { useToast, ToastContainer } from '../../../components/common/Toast';
import SecureUploadModal from '../../../components/backup/SecureUploadModal';

const DetailsModal = React.memo(({ restore, onClose, getTypeLabel, getStatusBadge }) => {
  if (!restore) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-base-300">
          <h2 id="modal-title" className="text-2xl font-bold flex items-center">
            <FiEye className="mr-3 text-primary" />
            Détails de la restauration
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Fermer">
            <FiX className="text-xl" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="restore-name" className="label-text font-semibold">Nom</label>
              <p id="restore-name">{restore.restore_name}</p>
            </div>
            <div>
              <label htmlFor="restore-type" className="label-text font-semibold">Type</label>
              <p id="restore-type">{getTypeLabel(restore.restore_type)}</p>
            </div>
            <div>
              <label htmlFor="restore-status" className="label-text font-semibold">Statut</label>
              <p id="restore-status">{getStatusBadge(restore.status)}</p>
            </div>
            <div>
              <label htmlFor="backup-source" className="label-text font-semibold">Sauvegarde source</label>
              <p id="backup-source">{restore.backup_source?.backup_name || 'N/A'}</p>
            </div>
            <div>
              <label htmlFor="start-date" className="label-text font-semibold">Date de début</label>
              <p id="start-date">{backupService.formatDate(restore.started_at)}</p>
            </div>
            <div>
              <label htmlFor="duration" className="label-text font-semibold">Durée</label>
              <p id="duration">{restore.duration_seconds ? backupService.formatDuration(restore.duration_seconds) : 'N/A'}</p>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h3 className="font-semibold text-lg mb-2">Statistiques</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <FiDatabase className="mx-auto text-2xl text-primary mb-2" />
                <p className="text-sm text-base-content/70">Tables</p>
                <p className="font-bold">{restore.tables_restored || 0}</p>
              </div>
              <div className="text-center">
                <FiHardDrive className="mx-auto text-2xl text-info mb-2" />
                <p className="text-sm text-base-content/70">Enregistrements</p>
                <p className="font-bold">{restore.records_restored || 0}</p>
              </div>
              <div className="text-center">
                <FiFile className="mx-auto text-2xl text-success mb-2" />
                <p className="text-sm text-base-content/70">Fichiers</p>
                <p className="font-bold">{restore.files_restored || 0}</p>
              </div>
            </div>
          </div>
          
          {restore.error_message && (
            <div className="alert alert-error">
              <FiAlertTriangle />
              <span>{restore.error_message}</span>
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
  
  // Hook pour les toasts
  const { toasts, error, success, removeToast } = useToast();

  const loadRestores = useCallback(async () => {
    try {
      setLoading(true);
      const data = await backupService.getRestoreHistory();
      if (!data || !Array.isArray(data.results || data)) {
        throw new Error('Format de données invalide');
      }
      setRestores(data.results || data);
    } catch (err) {
      console.error('Erreur lors du chargement:', err);
      error('Erreur lors du chargement de l\'historique des restaurations');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadRestores();
  }, [loadRestores]);

  const handleUploadSuccess = useCallback((result) => {
    success(`Upload et restauration réussis ! ${result.tables_restored} tables, ${result.records_restored} enregistrements restaurés.`);
    loadRestores();
  }, [success, loadRestores]);

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

  if (loading) {
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
                    <th>Nom</th>
                    <th>Type</th>
                    <th>Statut</th>
                    <th>Sauvegarde source</th>
                    <th>Date</th>
                    <th>Durée</th>
                    <th>Statistiques</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {restores.map((restore) => (
                    <tr key={restore.id}>
                      <td>
                        <div className="font-medium">{restore.restore_name}</div>
                      </td>
                      <td>
                        <span className="badge badge-outline">
                          {getTypeLabel(restore.restore_type)}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(restore.status)}
                          {getStatusBadge(restore.status)}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          {restore.backup_source?.backup_name || 'N/A'}
                        </div>
                      </td>
                      <td className="font-mono text-sm">
                        {backupService.formatDate(restore.started_at)}
                      </td>
                      <td>
                        {restore.duration_seconds ? backupService.formatDuration(restore.duration_seconds) : '-'}
                      </td>
                      <td>
                        <div className="text-xs space-y-1">
                          <div>📊 {restore.tables_restored || 0} tables</div>
                          <div>📄 {restore.records_restored || 0} enreg.</div>
                          <div>📁 {restore.files_restored || 0} fichiers</div>
                        </div>
                      </td>
                      <td>
                        <div className="tooltip" data-tip="Voir détails">
                          <button
                            onClick={() => setShowDetailsModal(restore)}
                            className="btn btn-ghost btn-xs"
                          >
                            <FiEye />
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
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
};

export default React.memo(RestoreHistoryList); 