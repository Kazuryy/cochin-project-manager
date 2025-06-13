import React, { useState, useEffect, useCallback } from 'react';
import { 
  FiPlus, 
  FiEdit2, 
  FiTrash2, 
  FiPlay, 
  FiPause, 
  FiCopy, 
  FiSettings,
  FiClock,
  FiDatabase,
  FiShield,
  FiMoreHorizontal,
  FiAlertTriangle
} from 'react-icons/fi';
import PropTypes from 'prop-types';
import backupService from '../../../services/backupService';
import BackupConfigurationForm from './BackupConfigurationForm';
import { useToast, ToastContainer } from '../../../components/common/Toast';

// Constantes pour les mappings
const BACKUP_TYPES = {
  'full': 'Complète',
  'metadata': 'Métadonnées',
  'data': 'Données'
};

const FREQUENCIES = {
  'manual': 'Manuelle',
  'daily': 'Quotidienne',
  'weekly': 'Hebdomadaire',
  'monthly': 'Mensuelle'
};

// PropTypes pour la validation
BackupConfigurationForm.propTypes = {
  configuration: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string.isRequired,
    backup_type: PropTypes.string.isRequired,
    frequency: PropTypes.string.isRequired,
    retention_days: PropTypes.number.isRequired,
    is_active: PropTypes.bool,
    include_files: PropTypes.bool,
    compression_enabled: PropTypes.bool
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired
};

const BackupConfigurationList = () => {
  const [configurations, setConfigurations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingConfiguration, setEditingConfiguration] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  
  // Hook pour les toasts
  const { toasts, addToast, removeToast } = useToast();

  // Fonctions helper pour les toasts
  const success = useCallback((message) => {
    addToast(message, 'success');
  }, [addToast]);

  const error = useCallback((message) => {
    addToast(message, 'error');
  }, [addToast]);

  // Mémoisation des fonctions de formatage
  const getTypeLabel = useCallback((type) => BACKUP_TYPES[type] || type, []);
  const getFrequencyLabel = useCallback((frequency) => FREQUENCIES[frequency] || frequency, []);

  // Charger les configurations
  const loadConfigurations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await backupService.getConfigurations();
      setConfigurations(data.results || data);
    } catch (err) {
      console.error('Erreur lors du chargement des configurations:', err);
      error('Erreur lors du chargement des configurations');
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadConfigurations();
  }, [loadConfigurations]);

  // Nouvelle configuration
  const handleNewConfiguration = useCallback(() => {
    setEditingConfiguration(null);
    setShowForm(true);
  }, []);

  // Éditer configuration
  const handleEditConfiguration = useCallback((config) => {
    setEditingConfiguration(config);
    setShowForm(true);
  }, []);

  // Sauvegarder configuration
  const handleSaveConfiguration = useCallback(async () => {
    setShowForm(false);
    setEditingConfiguration(null);
    await loadConfigurations();
    success(editingConfiguration ? 'Configuration mise à jour avec succès' : 'Configuration créée avec succès');
  }, [editingConfiguration, loadConfigurations, success]);

  // Annuler formulaire
  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingConfiguration(null);
  }, []);

  // Activer/désactiver configuration
  const toggleConfigurationStatus = useCallback(async (config) => {
    try {
      setActionLoading(config.id);
      const updatedConfig = {
        ...config,
        is_active: !config.is_active
      };
      await backupService.updateConfiguration(config.id, updatedConfig);
      await loadConfigurations();
      success(`Configuration ${config.is_active ? 'désactivée' : 'activée'} avec succès`);
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
      error('Erreur lors de la mise à jour du statut');
    } finally {
      setActionLoading(null);
    }
  }, [loadConfigurations, success, error]);

  // Dupliquer configuration
  const duplicateConfiguration = useCallback(async (config) => {
    try {
      setActionLoading(config.id);
      const duplicatedConfig = {
        ...config,
        name: `${config.name} (Copie)`,
        is_active: false
      };
      delete duplicatedConfig.id;
      delete duplicatedConfig.created_at;
      delete duplicatedConfig.updated_at;
      
      await backupService.createConfiguration(duplicatedConfig);
      await loadConfigurations();
      success('Configuration dupliquée avec succès');
    } catch (err) {
      console.error('Erreur lors de la duplication:', err);
      error('Erreur lors de la duplication');
    } finally {
      setActionLoading(null);
    }
  }, [loadConfigurations, success, error]);

  // Supprimer configuration
  const handleDeleteConfiguration = useCallback(async (configId) => {
    try {
      setActionLoading(configId);
      await backupService.deleteConfiguration(configId);
      await loadConfigurations();
      setShowDeleteModal(null);
      success('Configuration supprimée avec succès');
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      error('Erreur lors de la suppression');
    } finally {
      setActionLoading(null);
    }
  }, [loadConfigurations, success, error]);

  // Lancer sauvegarde manuelle avec cette configuration
  const runManualBackup = useCallback(async (config) => {
    try {
      setActionLoading(config.id);
      await backupService.createBackup({
        backup_type: config.backup_type,
        include_files: config.include_files,
        compression_enabled: config.compression_enabled,
        configuration_id: config.id
      });
      success(`Sauvegarde "${config.name}" lancée avec succès (chiffrement automatique)`);
    } catch (err) {
      console.error('Erreur lors du lancement de la sauvegarde:', err);
      error('Erreur lors du lancement de la sauvegarde');
    } finally {
      setActionLoading(null);
    }
  }, [success, error]);

  // Formatage des données d'affichage
  const getStatusBadge = useCallback((isActive) => (
    isActive ? (
      <span className="badge badge-success">Actif</span>
    ) : (
      <span className="badge badge-error">Inactif</span>
    )
  ), []);

  const getOptionsIcons = useCallback((config) => {
    const icons = [];
    if (config.include_files) icons.push({ icon: FiDatabase, title: 'Inclut les fichiers' });
    if (config.compression_enabled) icons.push({ icon: FiSettings, title: 'Compression activée' });
    icons.push({ icon: FiShield, title: 'Chiffrement AES-256 automatique', className: 'text-success' });
    return icons;
  }, []);

  const getActionIcon = useCallback((config) => {
    if (actionLoading === config.id) {
      return <span className="loading loading-spinner loading-xs"></span>;
    }
    return config.is_active ? <FiPause /> : <FiPlay />;
  }, [actionLoading]);

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
          <h2 className="text-2xl font-bold">Configurations de sauvegarde</h2>
          <p className="text-base-content/70 mt-1">
            Gérez vos paramètres de sauvegarde automatique
          </p>
        </div>
        <button
          onClick={handleNewConfiguration}
          className="btn btn-primary"
        >
          <FiPlus className="mr-2" />
          Nouvelle configuration
        </button>
      </div>

      {/* Liste des configurations */}
      {configurations.length === 0 ? (
        <div className="text-center py-12">
          <FiSettings className="mx-auto text-6xl text-base-content/30 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Aucune configuration</h3>
          <p className="text-base-content/70 mb-6">
            Créez votre première configuration de sauvegarde automatique
          </p>
          <button
            onClick={handleNewConfiguration}
            className="btn btn-primary"
          >
            <FiPlus className="mr-2" />
            Créer une configuration
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {configurations.map((config) => (
            <div key={config.id} className="card bg-base-100 shadow-sm border border-base-200">
              <div className="card-body">
                <div className="flex justify-between items-start">
                  {/* Informations principales */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="card-title text-lg">{config.name}</h3>
                      {getStatusBadge(config.is_active)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {/* Type */}
                      <div className="flex items-center space-x-2">
                        <FiDatabase className="text-primary" />
                        <span className="text-sm">
                          <span className="font-medium">Type:</span> {getTypeLabel(config.backup_type)}
                        </span>
                      </div>
                      
                      {/* Fréquence */}
                      <div className="flex items-center space-x-2">
                        <FiClock className="text-primary" />
                        <span className="text-sm">
                          <span className="font-medium">Fréquence:</span> {getFrequencyLabel(config.frequency)}
                        </span>
                      </div>
                      
                      {/* Rétention */}
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">
                          <span className="font-medium">Rétention:</span> {config.retention_days} jours
                        </span>
                      </div>
                    </div>

                    {/* Options actives */}
                    <div className="flex items-center space-x-4">
                      {getOptionsIcons(config).map((option) => (
                        <div 
                          key={`${option.title}-${option.icon.name}`}
                          className="tooltip" 
                          data-tip={option.title}
                        >
                          <option.icon className={option.className || 'text-success'} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    {/* Lancer sauvegarde */}
                    <div className="tooltip" data-tip="Lancer sauvegarde">
                      <button
                        onClick={() => runManualBackup(config)}
                        className="btn btn-sm btn-success"
                        disabled={actionLoading === config.id}
                      >
                        {actionLoading === config.id ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          <FiPlay />
                        )}
                      </button>
                    </div>

                    {/* Activer/Désactiver */}
                    <div className="tooltip" data-tip={config.is_active ? "Désactiver" : "Activer"}>
                      <button
                        onClick={() => toggleConfigurationStatus(config)}
                        className={`btn btn-sm ${config.is_active ? 'btn-warning' : 'btn-info'}`}
                        disabled={actionLoading === config.id}
                      >
                        {getActionIcon(config)}
                      </button>
                    </div>

                    {/* Menu actions */}
                    <div className="dropdown dropdown-end">
                      <div tabIndex={0} role="button" className="btn btn-sm btn-ghost">
                        <FiMoreHorizontal />
                      </div>
                      <div 
                        tabIndex={0} 
                        role="menu"
                        className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
                      >
                        <div className="menu-item">
                          <button onClick={() => handleEditConfiguration(config)}>
                            <FiEdit2 /> Modifier
                          </button>
                        </div>
                        <div className="menu-item">
                          <button onClick={() => duplicateConfiguration(config)}>
                            <FiCopy /> Dupliquer
                          </button>
                        </div>
                        <div className="menu-item">
                          <button 
                            onClick={() => setShowDeleteModal(config)}
                            className="text-error"
                          >
                            <FiTrash2 /> Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire de configuration */}
      <BackupConfigurationForm
        configuration={editingConfiguration}
        onSave={handleSaveConfiguration}
        onCancel={handleCancelForm}
        isOpen={showForm}
      />

      {/* Modal de suppression */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-base-100 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <FiAlertTriangle className="text-warning text-2xl mr-3" />
              <h3 className="text-lg font-bold">Confirmer la suppression</h3>
            </div>
            <p className="mb-6">
              Êtes-vous sûr de vouloir supprimer la configuration <span className="font-semibold">"{showDeleteModal.name}"</span> ?
              Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="btn btn-outline"
                disabled={actionLoading === showDeleteModal.id}
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteConfiguration(showDeleteModal.id)}
                className="btn btn-error"
                disabled={actionLoading === showDeleteModal.id}
              >
                {actionLoading === showDeleteModal.id ? (
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
      )}
    </div>
  );
};

export default BackupConfigurationList; 