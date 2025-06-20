import React, { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
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
// Import du service de sauvegarde
import backupService from '../../../services/backupService';
import BackupConfigurationForm from './BackupConfigurationForm';
import { useToast } from '../../../hooks/useToast';
import { ToastContainer } from '../../../components/common/Toast';
import useOperations from '../../../hooks/useOperations';
import { useAuth } from '../../../hooks/useAuth';

// Création d'un service de secours si nécessaire
const createFallbackService = () => ({
  getConfigurations: async () => {
    console.warn('backupService non disponible - utilisation de données de test');
    return [];
  },
  updateConfiguration: async () => ({}),
  createConfiguration: async () => ({}),
  deleteConfiguration: async () => ({}),
  createBackup: async () => ({}),
  formatDate: (date) => {
    try {
      return new Date(date).toLocaleString('fr-FR');
    } catch {
      return 'Date invalide';
    }
  }
});

// Utiliser le service importé ou le fallback
const backupServiceInstance = backupService || createFallbackService();

// Constantes pour les mappings
const BACKUP_TYPES = Object.freeze({
  'full': 'Complète',
  'metadata': 'Métadonnées',
  'data': 'Données'
});

const FREQUENCIES = Object.freeze({
  'manual': 'Manuelle',
  'daily': 'Quotidienne',
  'weekly': 'Hebdomadaire',
  'monthly': 'Mensuelle'
});

// Configuration des icônes d'encryption
const ENCRYPTION_ICON_CONFIG = Object.freeze({ 
  icon: FiShield, 
  title: 'Chiffrement AES-256 automatique', 
  className: 'text-success' 
});

// Hook personnalisé pour la gestion des configurations
const useConfigurations = () => {
  const [configurations, setConfigurations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const loadConfigurations = useCallback(async () => {
    try {
      // Annuler la requête précédente si elle existe
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);
      
      const response = await backupServiceInstance.getConfigurations();
      
      // Extraction robuste des données selon différents formats de réponse API
      let configList = [];
      
      if (Array.isArray(response)) {
        configList = response;
      } else if (response && typeof response === 'object') {
        if (Array.isArray(response.results)) {
          configList = response.results;
        } else if (Array.isArray(response.data)) {
          configList = response.data;
        } else if (response.configurations && Array.isArray(response.configurations)) {
          configList = response.configurations;
        } else {
          // Dernière tentative : chercher n'importe quel tableau dans la réponse
          const arrayProps = Object.keys(response).find(key => Array.isArray(response[key]));
          if (arrayProps) {
            configList = response[arrayProps];
          }
        }
      }
      
      setConfigurations(configList);
    } catch (err) {
      // Ne pas traiter les erreurs d'annulation
      if (err.name === 'AbortError') return;
      
      console.error('Erreur lors du chargement des configurations:', err);
      setError(err.message || 'Erreur lors du chargement des configurations');
      setConfigurations([]);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  // Nettoyage lors du démontage
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    configurations,
    loading,
    error,
    loadConfigurations,
    setConfigurations
  };
};

// Composant mémorisé pour les icônes d'options
const OptionsIcons = React.memo(({ config }) => {
  const icons = useMemo(() => {
    const iconList = [];
    
    if (config.include_files) {
      iconList.push({ 
        icon: FiDatabase, 
        title: 'Inclut les fichiers',
        key: 'include_files'
      });
    }
    
    if (config.compression_enabled) {
      iconList.push({ 
        icon: FiSettings, 
        title: 'Compression activée',
        key: 'compression'
      });
    }
    
    // Toujours ajouter l'icône de chiffrement
    iconList.push({
      ...ENCRYPTION_ICON_CONFIG,
      key: 'encryption'
    });
    
    return iconList;
  }, [config.include_files, config.compression_enabled]);

  return (
    <div className="flex items-center space-x-4" role="group" aria-label="Options de configuration">
      {icons.map((option) => (
        <div 
          key={option.key}
          className="tooltip" 
          data-tip={option.title}
        >
          <option.icon 
            className={option.className || 'text-success'} 
            aria-label={option.title}
          />
        </div>
      ))}
    </div>
  );
});

OptionsIcons.propTypes = {
  config: PropTypes.shape({
    include_files: PropTypes.bool,
    compression_enabled: PropTypes.bool
  }).isRequired
};

OptionsIcons.displayName = 'OptionsIcons';

// Composant mémorisé pour les actions
const ActionButtons = React.memo(({ 
  config, 
  actionLoading, 
  onRunBackup, 
  onToggleStatus, 
  onEdit, 
  onDuplicate, 
  onDelete 
}) => {
  const isLoading = actionLoading === config.id;
  const isActive = config.is_active;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Effet pour fermer le menu quand on clique ailleurs
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    // Ajouter l'écouteur d'événement seulement si le menu est ouvert
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Handlers pour les actions
  const handleRunBackup = useCallback(() => {
    console.log('🔘 [BUTTON] Clic sur le bouton "Lancer sauvegarde"');
    onRunBackup();
  }, [onRunBackup]);

  const handleToggleStatus = useCallback(() => {
    console.log('🔘 [BUTTON] Clic sur le bouton "Activer/Désactiver"');
    onToggleStatus();
  }, [onToggleStatus]);

  const handleMenuToggle = useCallback(() => {
    console.log('🔘 [BUTTON] Clic sur le bouton "Menu"');
    setIsMenuOpen(prev => !prev);
  }, []);

  const handleEditClick = useCallback(() => {
    console.log('🔘 [BUTTON] Clic sur "Modifier"');
    setIsMenuOpen(false);
    onEdit();
  }, [onEdit]);

  const handleDuplicateClick = useCallback(() => {
    console.log('🔘 [BUTTON] Clic sur "Dupliquer"');
    setIsMenuOpen(false);
    onDuplicate();
  }, [onDuplicate]);

  const handleDeleteClick = useCallback(() => {
    console.log('🔘 [BUTTON] Clic sur "Supprimer"');
    setIsMenuOpen(false);
    onDelete();
  }, [onDelete]);

  // Icône de statut
  let statusIcon;
  if (isLoading) {
    statusIcon = <span className="loading loading-spinner loading-xs" aria-label="Chargement" />;
  } else {
    statusIcon = isActive ? <FiPause aria-hidden="true" /> : <FiPlay aria-hidden="true" />;
  }

  return (
    <div className="flex items-center space-x-2">
      {/* Bouton de sauvegarde */}
      <div className="tooltip" data-tip="Lancer sauvegarde">
        <button
          onClick={handleRunBackup}
          className="btn btn-sm btn-success"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <FiPlay />
          )}
        </button>
      </div>

      {/* Bouton d'activation/désactivation */}
      <div className="tooltip" data-tip={isActive ? "Désactiver" : "Activer"}>
        <button
          onClick={handleToggleStatus}
          className={`btn btn-sm ${isActive ? 'btn-warning' : 'btn-info'}`}
          disabled={isLoading}
        >
          {statusIcon}
        </button>
      </div>

      {/* Menu d'actions personnalisé */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={handleMenuToggle}
          className="btn btn-sm btn-ghost"
          aria-haspopup="true"
          aria-expanded={isMenuOpen}
        >
          <FiMoreHorizontal />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-base-100 rounded-md shadow-lg z-50">
            <div className="py-1">
              <button
                onClick={handleEditClick}
                className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-base-200"
              >
                <FiEdit2 className="mr-2" /> Modifier
              </button>
              <button
                onClick={handleDuplicateClick}
                className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-base-200"
              >
                <FiCopy className="mr-2" /> Dupliquer
              </button>
              <button
                onClick={handleDeleteClick}
                className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-base-200 text-error"
              >
                <FiTrash2 className="mr-2" /> Supprimer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ActionButtons.propTypes = {
  config: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    is_active: PropTypes.bool.isRequired
  }).isRequired,
  actionLoading: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onRunBackup: PropTypes.func.isRequired,
  onToggleStatus: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDuplicate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired
};

ActionButtons.displayName = 'ActionButtons';

// Modal de suppression simplifiée
const DeleteModal = React.memo(({ config, onClose, onConfirm, isLoading }) => {
  if (!config) return null;

  const handleConfirm = () => {
    onConfirm(config.id);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-base-300 bg-opacity-60" onClick={onClose}></div>
      <div className="bg-base-100 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl relative">
        <div className="flex items-center mb-4">
          <div className="text-error text-2xl mr-3">⚠️</div>
          <h3 className="text-lg font-bold">Supprimer la configuration</h3>
        </div>
        
        <p className="mb-6">
          Êtes-vous sûr de vouloir supprimer <strong>{config.name}</strong> ?
          <br />
          <span className="text-sm text-base-content/70 mt-2 block">
            Cette action est irréversible.
          </span>
        </p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn btn-ghost"
            disabled={isLoading}
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            className="btn btn-error"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              "Supprimer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

DeleteModal.propTypes = {
  config: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string.isRequired
  }),
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired
};

DeleteModal.displayName = 'DeleteModal';

// Composant principal - optimisé
const BackupConfigurationList = ({ onUpdate }) => {
  const { configurations, loading, error, loadConfigurations, setConfigurations } = useConfigurations();
  const { actionLoading, executeOperation, success, error: showError, cleanup, setActionLoading } = useOperations(loadConfigurations);
  const { isAuthenticated } = useAuth();
  
  // Utilisation de useReducer pour gérer l'état du formulaire et des modales
  const [uiState, dispatch] = useReducer((state, action) => {
    switch (action.type) {
      case 'SHOW_FORM':
        return { 
          ...state, 
          showForm: true, 
          editingConfiguration: action.payload 
        };
      case 'HIDE_FORM':
        return { 
          ...state, 
          showForm: false, 
          editingConfiguration: null 
        };
      case 'SHOW_DELETE_MODAL':
        return { 
          ...state, 
          showDeleteModal: action.payload 
        };
      case 'HIDE_DELETE_MODAL':
        return { 
          ...state, 
          showDeleteModal: null 
        };
      default:
        return state;
    }
  }, {
    showForm: false,
    editingConfiguration: null,
    showDeleteModal: null
  });
  
  const { toasts, removeToast } = useToast();
  
  // REF POUR ÉVITER LA BOUCLE INFINIE
  const onUpdateRef = useRef(onUpdate);
  const previousConfigurationsRef = useRef([]);
  
  // Mettre à jour la référence quand onUpdate change
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Fonctions de formatage mémorisées
  const getTypeLabel = useCallback((type) => BACKUP_TYPES[type] || type, []);
  const getFrequencyLabel = useCallback((frequency) => FREQUENCIES[frequency] || frequency, []);
  const getStatusBadge = useCallback((isActive) => (
    <span 
      className={`badge ${isActive ? 'badge-success' : 'badge-error'}`}
      aria-label={`Statut: ${isActive ? 'Actif' : 'Inactif'}`}
    >
      {isActive ? 'Actif' : 'Inactif'}
    </span>
  ), []);

  // Chargement initial
  useEffect(() => {
    loadConfigurations();
  }, [loadConfigurations]);

  // CORRECTION DE LA BOUCLE INFINIE : 
  // Notifier uniquement quand les configurations changent réellement
  useEffect(() => {
    // Utilisation d'une comparaison plus efficace que JSON.stringify
    if (loading) return;

    // Vérifier si les configurations ont réellement changé (longueur différente)
    const prevConfigs = previousConfigurationsRef.current;
    const currentConfigs = configurations;
    
    // Comparaison rapide par longueur d'abord
    if (prevConfigs.length !== currentConfigs.length) {
      previousConfigurationsRef.current = [...configurations];
      
      // Utiliser un timeout pour éviter les appels synchrones
      const timeoutId = setTimeout(() => {
        if (onUpdateRef.current) {
          onUpdateRef.current();
        }
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
    
    // Si même longueur, vérifier si les IDs ont changé
    const hasChanged = prevConfigs.some((prevConfig, index) => 
      !currentConfigs[index] || prevConfig.id !== currentConfigs[index].id
    );
    
    if (hasChanged) {
      previousConfigurationsRef.current = [...configurations];
      
      // Utiliser un timeout pour éviter les appels synchrones
      const timeoutId = setTimeout(() => {
        if (onUpdateRef.current) {
          onUpdateRef.current();
        }
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [configurations, loading]);

  // Gestionnaires d'événements mémorisés
  const handleNewConfiguration = useCallback(() => {
    dispatch({ type: 'SHOW_FORM', payload: null });
  }, []);

  const handleEditConfiguration = useCallback((config) => {
    dispatch({ type: 'SHOW_FORM', payload: config });
  }, []);

  const handleSaveConfiguration = useCallback(async () => {
    dispatch({ type: 'HIDE_FORM' });
    await loadConfigurations();
    success(uiState.editingConfiguration ? 'Configuration mise à jour avec succès' : 'Configuration créée avec succès');
  }, [uiState.editingConfiguration, loadConfigurations, success]);

  const handleCancelForm = useCallback(() => {
    dispatch({ type: 'HIDE_FORM' });
  }, []);

  const toggleConfigurationStatus = useCallback((config) => {
    const operation = async () => {
      try {
        console.log(`Changement de statut de la configuration ${config.id} à ${!config.is_active}`);
        
        // Préparer les données à mettre à jour
        const updatedConfig = { ...config, is_active: !config.is_active };
        
        // Appel API
        const result = await backupServiceInstance.updateConfiguration(config.id, updatedConfig);
        console.log('Résultat de la mise à jour:', result);
        
        // Mise à jour optimiste de l'état local
        setConfigurations(prev => 
          prev.map(c => c.id === config.id ? { ...c, is_active: !c.is_active } : c)
        );
        
        return result;
      } catch (error) {
        console.error('Erreur lors du changement de statut:', error);
        throw error;
      }
    };
    
    const message = `Configuration ${config.is_active ? 'désactivée' : 'activée'} avec succès`;
    executeOperation(config.id, operation, message);
  }, [executeOperation, setConfigurations]);

  const duplicateConfiguration = useCallback((config) => {
    const operation = async () => {
      const { id: _, created_at: __, updated_at: ___, ...configToDuplicate } = {
        ...config,
        name: `${config.name} (Copie)`,
        is_active: false
      };
      await backupServiceInstance.createConfiguration(configToDuplicate);
    };
    executeOperation(config.id, operation, 'Configuration dupliquée avec succès');
  }, [executeOperation]);

  // FONCTION DE SUPPRESSION CORRIGÉE
  const handleDeleteConfiguration = useCallback(async (configId) => {
    if (!configId) {
      showError('ID de configuration manquant');
      dispatch({ type: 'HIDE_DELETE_MODAL' });
      return;
    }
    
    console.log('🗑️ Tentative de suppression de la configuration:', configId);
    
    try {
      // Indiquer le chargement
      const configName = configurations.find(c => c.id === configId)?.name || 'Configuration';
      
      // Appel direct au service de suppression
      await backupServiceInstance.deleteConfiguration(configId);
      
      console.log('🗑️ Suppression réussie de la configuration:', configId);
      
      // Fermer la modal après succès
      dispatch({ type: 'HIDE_DELETE_MODAL' });
      
      // Mise à jour optimiste de l'état local
      setConfigurations(prev => prev.filter(config => config.id !== configId));
      
      // Afficher un message de succès
      success(`${configName} supprimée avec succès`);
      
      // Recharger les configurations après un court délai
      setTimeout(() => {
        loadConfigurations();
      }, 500);
      
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
      showError(error.message || 'Échec de la suppression de la configuration');
      
      // Fermer la modal en cas d'erreur
      dispatch({ type: 'HIDE_DELETE_MODAL' });
    }
  }, [configurations, dispatch, loadConfigurations, setConfigurations, showError, success]);

  const runManualBackup = useCallback((config) => {
    // Version de débogage - appel direct sans passer par executeOperation
    console.log('🔍 [DEBUG] Tentative de lancement direct de la sauvegarde pour:', config.name);
    
    // Vérifier que la configuration est valide
    if (!config || !config.id) {
      console.error('❌ [DEBUG] Configuration invalide:', config);
      showError('Configuration de sauvegarde invalide');
      return;
    }
    
    // Vérifier l'état d'authentification
    if (!isAuthenticated) {
      console.error('❌ [DEBUG] Utilisateur non authentifié');
      showError('Vous devez être connecté pour effectuer cette action');
      return;
    }
    
    // Préparer les données pour la sauvegarde
    const backupData = {
      backup_type: config.backup_type || 'full',
      include_files: config.include_files === undefined ? true : config.include_files,
      compression_enabled: config.compression_enabled === undefined ? true : config.compression_enabled,
      configuration_id: parseInt(config.id, 10)
    };
    
    console.log('🔍 [DEBUG] Données de sauvegarde préparées:', JSON.stringify(backupData, null, 2));
    
    // Indiquer le chargement
    setActionLoading(config.id);
    
    // Appel direct au service sans passer par executeOperation
    backupServiceInstance.createBackup(backupData)
      .then(result => {
        console.log('✅ [DEBUG] Sauvegarde lancée avec succès, résultat:', result);
        success(`Sauvegarde "${config.name}" lancée avec succès (chiffrement automatique)`);
        
        // Recharger les données après un court délai
        setTimeout(() => {
          loadConfigurations();
        }, 1000);
      })
      .catch(error => {
        console.error('❌ [DEBUG] Erreur lors du lancement de la sauvegarde:', error);
        console.error('❌ [DEBUG] Détails de l\'erreur:', {
          message: error.message,
          status: error.status || error.response?.status,
          responseData: error.response?.data
        });
        
        // Message d'erreur personnalisé selon le type d'erreur
        let errorMessage = error.message || 'Erreur lors du lancement de la sauvegarde';
        
        // Erreur 403 - Problème de permission
        if (error.status === 403 || error.response?.status === 403) {
          errorMessage = "Vous n'avez pas les permissions nécessaires pour effectuer cette action.";
        }
        // Erreur 401 - Non authentifié
        else if (error.status === 401 || error.response?.status === 401) {
          errorMessage = "Vous devez être connecté pour effectuer cette action.";
          
          // Rediriger vers la page de connexion
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
        // Erreur 500 - Erreur serveur
        else if (error.status === 500 || error.response?.status === 500) {
          errorMessage = "Une erreur est survenue sur le serveur. Veuillez réessayer plus tard.";
        }
        
        // Afficher un message d'erreur
        showError(errorMessage);
      })
      .finally(() => {
        // Terminer le chargement
        setActionLoading(null);
      });
  }, [loadConfigurations, setActionLoading, showError, success, isAuthenticated]);

  // Gestionnaires pour les actions des configurations individuelles - optimisé
  const configHandlers = useMemo(() => {
    const handlers = {};
    configurations.forEach(config => {
      handlers[config.id] = {
        onRunBackup: () => runManualBackup(config),
        onToggleStatus: () => toggleConfigurationStatus(config),
        onEdit: () => handleEditConfiguration(config),
        onDuplicate: () => duplicateConfiguration(config),
        onDelete: () => {
          dispatch({ type: 'SHOW_DELETE_MODAL', payload: config });
        }
      };
    });
    return handlers;
  }, [
    configurations, 
    runManualBackup, 
    toggleConfigurationStatus, 
    handleEditConfiguration, 
    duplicateConfiguration,
    dispatch
  ]);

  // Gestion des erreurs
  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error, showError]);

  // Ajouter un useEffect pour le nettoyage
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Rendu optimisé pour les configurations
  const renderConfigurationList = useMemo(() => {
    if (configurations.length === 0) {
      return (
        <div className="text-center py-12" role="region" aria-label="Aucune configuration">
          <FiSettings className="mx-auto text-6xl text-base-content/30 mb-4" aria-hidden="true" />
          <h3 className="text-xl font-semibold mb-2">Aucune configuration</h3>
          <p className="text-base-content/70 mb-6">
            Créez votre première configuration de sauvegarde automatique
          </p>
          <button
            onClick={handleNewConfiguration}
            className="btn btn-primary"
            aria-label="Créer votre première configuration de sauvegarde"
          >
            <FiPlus className="mr-2" aria-hidden="true" />
            Créer une configuration
          </button>
        </div>
      );
    }

    return (
      <div className="grid gap-4" role="list" aria-label="Liste des configurations">
        {configurations.map((config) => (
          <article 
            key={config.id} 
            className="card bg-base-100 shadow-sm border border-base-200"
            role="listitem"
          >
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
                      <FiDatabase className="text-primary" aria-hidden="true" />
                      <span className="text-sm">
                        <span className="font-medium">Type:</span> {getTypeLabel(config.backup_type)}
                      </span>
                    </div>
                    
                    {/* Fréquence */}
                    <div className="flex items-center space-x-2">
                      <FiClock className="text-primary" aria-hidden="true" />
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
                  <OptionsIcons config={config} />
                </div>

                {/* Actions */}
                <ActionButtons
                  config={config}
                  actionLoading={actionLoading}
                  {...configHandlers[config.id]}
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  }, [
    configurations, 
    getStatusBadge, 
    getTypeLabel, 
    getFrequencyLabel, 
    actionLoading, 
    configHandlers, 
    handleNewConfiguration
  ]);

  // État de chargement
  if (loading) {
    return (
      <div 
        className="flex justify-center items-center py-12" 
        role="status" 
        aria-label="Chargement des configurations"
      >
        <span className="loading loading-spinner loading-lg" aria-hidden="true" />
        <span className="sr-only">Chargement des configurations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conteneur de toasts */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      
      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Configurations de sauvegarde</h2>
          <p className="text-base-content/70 mt-1">
            Gérez vos paramètres de sauvegarde automatique
          </p>
        </div>
        <button
          onClick={handleNewConfiguration}
          className="btn btn-primary"
          aria-label="Créer une nouvelle configuration de sauvegarde"
        >
          <FiPlus className="mr-2" aria-hidden="true" />
          Nouvelle configuration
        </button>
      </header>

      {/* Contenu principal */}
      <main>
        {renderConfigurationList}
      </main>

      {/* Formulaire de configuration */}
      <BackupConfigurationForm
        configuration={uiState.editingConfiguration}
        onSave={handleSaveConfiguration}
        onCancel={handleCancelForm}
        isOpen={uiState.showForm}
      />

      {/* Modal de suppression */}
      <DeleteModal
        config={uiState.showDeleteModal}
        onClose={() => dispatch({ type: 'HIDE_DELETE_MODAL' })}
        onConfirm={handleDeleteConfiguration}
        isLoading={actionLoading === uiState.showDeleteModal?.id}
      />
    </div>
  );
};

BackupConfigurationList.propTypes = {
  onUpdate: PropTypes.func
};

BackupConfigurationList.defaultProps = {
  onUpdate: null
};

export default React.memo(BackupConfigurationList);