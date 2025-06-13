import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FiHardDrive, 
  FiSave, 
  FiDatabase, 
  FiClock, 
  FiSettings,
  FiList,
  FiBarChart,
  FiRotateCcw,
  FiAlertTriangle,
  FiRefreshCw
} from 'react-icons/fi';
import PropTypes from 'prop-types';

// Services - fallback si pas disponible
const createFallbackService = () => ({
  getConfigurations: async () => {
    console.warn('backupService non disponible - utilisation de données de test');
    return [];
  },
  getBackupHistory: async () => [],
  getRestoreHistory: async () => [],
  getStorageStats: async () => ({}),
  createQuickBackup: async (type) => {
    console.log('Simulation sauvegarde:', type);
    return { success: true };
  },
  formatDate: (date) => {
    try {
      return new Date(date).toLocaleString('fr-FR');
    } catch {
      return 'Date invalide';
    }
  }
});

// Import conditionnel du service
let backupService;
try {
  backupService = require('../../../services/backupService').default;
} catch {
  backupService = createFallbackService();
}

// Hook pour la gestion des opérations en cours
const useOperations = () => {
  const [runningOperations, setRunningOperations] = useState(new Set());

  const startOperation = useCallback((operationId) => {
    setRunningOperations(prev => new Set([...prev, operationId]));
  }, []);

  const endOperation = useCallback((operationId) => {
    setRunningOperations(prev => {
      const newSet = new Set(prev);
      newSet.delete(operationId);
      return newSet;
    });
  }, []);

  const isOperationRunning = useCallback((operationId) => {
    return runningOperations.has(operationId);
  }, [runningOperations]);

  return { 
    runningOperations, 
    startOperation, 
    endOperation, 
    isOperationRunning 
  };
};

// Hook pour la gestion des données
const useBackupData = () => {
  const [state, setState] = useState({
    configurations: [],
    backupHistory: [],
    restoreHistory: [],
    storageStats: {},
    loading: true,
    error: null
  });

  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const loadData = useCallback(async () => {
    try {
      updateState({ loading: true, error: null });
      
      // Chargement sécurisé des données
      const results = await Promise.allSettled([
        backupService.getConfigurations(),
        backupService.getBackupHistory({ page: 1, limit: 10 }),
        backupService.getRestoreHistory(),
        backupService.getStorageStats()
      ]);

      // Traitement des résultats
      const [configsResult, historyResult, restoresResult, storageResult] = results;

      // Configurations
      let configurations = [];
      if (configsResult.status === 'fulfilled') {
        const data = configsResult.value;
        if (Array.isArray(data)) {
          configurations = data;
        } else if (data?.results && Array.isArray(data.results)) {
          configurations = data.results;
        } else if (data?.data && Array.isArray(data.data)) {
          configurations = data.data;
        }
      }

      // Historique des sauvegardes
      let backupHistory = [];
      if (historyResult.status === 'fulfilled') {
        const data = historyResult.value;
        if (Array.isArray(data)) {
          backupHistory = data;
        } else if (data?.results && Array.isArray(data.results)) {
          backupHistory = data.results;
        }
      }

      // Historique des restaurations
      let restoreHistory = [];
      if (restoresResult.status === 'fulfilled') {
        const data = restoresResult.value;
        if (Array.isArray(data)) {
          restoreHistory = data;
        } else if (data?.results && Array.isArray(data.results)) {
          restoreHistory = data.results;
        }
      }

      // Statistiques de stockage
      let storageStats = {};
      if (storageResult.status === 'fulfilled') {
        storageStats = storageResult.value || {};
      }

      updateState({
        configurations,
        backupHistory,
        restoreHistory,
        storageStats,
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      updateState({
        loading: false,
        error: `Erreur de chargement: ${error.message || 'Erreur inconnue'}`,
        configurations: [],
        backupHistory: [],
        restoreHistory: [],
        storageStats: {}
      });
    }
  }, [updateState]);

  return {
    ...state,
    loadData,
    updateState
  };
};

// Utilitaires
const getStatusBadgeClass = (status) => {
  const statusMap = {
    'completed': 'badge-success',
    'success': 'badge-success',
    'failed': 'badge-error',
    'error': 'badge-error',
    'running': 'badge-warning',
    'pending': 'badge-info'
  };
  return statusMap[status] || 'badge-neutral';
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Composant StatCard
const StatCard = ({ icon: Icon, title, value, subtitle, color = 'primary' }) => (
  <div className="stat bg-base-100 rounded-xl shadow-md hover:shadow-lg transition-shadow">
    <div className={`stat-figure text-${color}`}>
      <Icon className="text-3xl" />
    </div>
    <div className="stat-title text-sm font-medium opacity-70">{title}</div>
    <div className={`stat-value text-${color} text-3xl font-bold`}>{value}</div>
    {subtitle && <div className="stat-desc text-xs opacity-60">{subtitle}</div>}
  </div>
);

StatCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  subtitle: PropTypes.string,
  color: PropTypes.string
};

// Composant HistoryCard
const HistoryCard = ({ title, icon: Icon, items, emptyMessage, color = 'primary' }) => (
  <div className="card bg-base-100 shadow-md rounded-xl hover:shadow-lg transition-shadow">
    <div className="card-body p-6">
      <h3 className="card-title text-xl flex items-center mb-6">
        <Icon className={`mr-3 text-${color}`} size={24} />
        {title}
      </h3>
      
      {items.length === 0 ? (
        <div className="text-center py-8">
          <div className="opacity-50 mb-3">
            <Icon size={48} className="mx-auto" />
          </div>
          <p className="text-base-content/60 text-sm">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {items.slice(0, 10).map((item, index) => (
            <div key={item.id || index} className="flex items-center justify-between p-4 bg-base-200/50 rounded-lg hover:bg-base-200/80 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate text-base-content">
                  {item.backup_name || item.restore_name || item.name || `Item ${index + 1}`}
                </div>
                <div className="text-xs text-base-content/60 mt-1 flex items-center space-x-2">
                  <span>{backupService.formatDate(item.created_at || item.started_at)}</span>
                  {item.file_size && <span>• {formatFileSize(item.file_size)}</span>}
                  {item.tables_restored && <span>• {item.tables_restored} tables</span>}
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-4">
                <span className={`badge badge-sm ${getStatusBadgeClass(item.status)}`}>
                  {item.status || 'unknown'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

HistoryCard.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  items: PropTypes.array.isRequired,
  emptyMessage: PropTypes.string.isRequired,
  color: PropTypes.string
};

// Composant AlertCard
const AlertCard = ({ type, icon: Icon, title, message, actionLabel, onAction }) => {
  const alertClasses = {
    warning: 'alert-warning',
    info: 'alert-info',
    error: 'alert-error',
    success: 'alert-success'
  };

  return (
    <div className={`alert ${alertClasses[type]} shadow-lg rounded-xl border-0`}>
      <Icon className={`text-${type} flex-shrink-0`} size={20} />
      <div className="flex-1">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs mt-1 opacity-90">{message}</div>
      </div>
      {onAction && (
        <button 
          onClick={onAction}
          className={`btn btn-${type} btn-sm rounded-lg`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

AlertCard.propTypes = {
  type: PropTypes.oneOf(['warning', 'info', 'error', 'success']).isRequired,
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  actionLabel: PropTypes.string,
  onAction: PropTypes.func
};

// Composant Dashboard principal
const DashboardView = ({ 
  loading, 
  error, 
  configurations, 
  backupHistory, 
  restoreHistory, 
  storageStats,
  onQuickBackup,
  onRefresh,
  runningOperations 
}) => {
  // Détection des opérations bloquées
  const stuckOperations = useMemo(() => {
    const now = new Date();
    const thresholdMinutes = 30;
    
    const stuckBackups = backupHistory.filter(backup => {
      if (backup.status !== 'running') return false;
      const startTime = new Date(backup.started_at || backup.created_at);
      return (now - startTime) / (1000 * 60) > thresholdMinutes;
    });
    
    const stuckRestores = restoreHistory.filter(restore => {
      if (restore.status !== 'running') return false;
      const startTime = new Date(restore.started_at || restore.created_at);
      return (now - startTime) / (1000 * 60) > thresholdMinutes;
    });
    
    return { 
      stuckBackups, 
      stuckRestores, 
      total: stuckBackups.length + stuckRestores.length 
    };
  }, [backupHistory, restoreHistory]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="text-base-content/70">Chargement des données...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Message d'erreur */}
      {error && (
        <AlertCard
          type="error"
          icon={FiAlertTriangle}
          title="Erreur de chargement"
          message={error}
          actionLabel="Réessayer"
          onAction={onRefresh}
        />
      )}

      {/* Alertes pour opérations bloquées */}
      {stuckOperations.total > 0 && (
        <AlertCard
          type="warning"
          icon={FiAlertTriangle}
          title={`${stuckOperations.total} opération(s) potentiellement bloquée(s)`}
          message={`${stuckOperations.stuckBackups.length} sauvegarde(s) et ${stuckOperations.stuckRestores.length} restauration(s) en cours depuis plus de 30 minutes.`}
          actionLabel="Aide"
          onAction={() => console.log('Aide pour opérations bloquées')}
        />
      )}

      {/* Alerte espace disque */}
      {storageStats.temp_files && storageStats.temp_files.size > 50 * 1024 * 1024 && (
        <AlertCard
          type="info"
          icon={FiHardDrive}
          title="Fichiers temporaires volumineux"
          message={`${formatFileSize(storageStats.temp_files.size)} de fichiers temporaires accumulés.`}
          actionLabel="Nettoyer"
          onAction={() => console.log('Nettoyage des fichiers temporaires')}
        />
      )}

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FiSettings}
          title="Configurations"
          value={configurations.length}
          subtitle={`${configurations.filter(c => c.is_active).length} actives`}
          color="primary"
        />
        
        <StatCard
          icon={FiSave}
          title="Sauvegardes"
          value={backupHistory.length}
          subtitle={`${backupHistory.filter(b => b.status === 'completed').length} réussies`}
          color="success"
        />
        
        <StatCard
          icon={FiRotateCcw}
          title="Restaurations"
          value={restoreHistory.length}
          subtitle={`${restoreHistory.filter(r => r.status === 'completed').length} réussies`}
          color="info"
        />
        
        <StatCard
          icon={FiClock}
          title="Dernière activité"
          value={backupHistory.length > 0 ? "Récente" : "Aucune"}
          subtitle={backupHistory.length > 0 ? backupHistory[0].status : 'N/A'}
          color="warning"
        />
      </div>

      {/* Actions rapides */}
      <div className="card bg-base-100 shadow-md rounded-xl hover:shadow-lg transition-shadow">
        <div className="card-body p-6">
          <h2 className="card-title text-xl mb-6 flex items-center">
            <FiDatabase className="mr-3 text-primary" size={24} />
            Actions rapides
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => onQuickBackup('full')}
              className="btn btn-primary btn-lg rounded-xl hover:scale-105 transition-transform"
              disabled={runningOperations.size > 0}
            >
              <FiDatabase className="mr-2" size={20} />
              {runningOperations.size > 0 ? 'En cours...' : 'Sauvegarde complète'}
            </button>
            
            <button 
              onClick={() => onQuickBackup('metadata')}
              className="btn btn-secondary btn-lg rounded-xl hover:scale-105 transition-transform"
              disabled={runningOperations.size > 0}
            >
              <FiList className="mr-2" size={20} />
              Métadonnées uniquement
            </button>
            
            <button 
              onClick={onRefresh}
              className="btn btn-outline btn-lg rounded-xl hover:scale-105 transition-transform"
              disabled={loading}
            >
              <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} size={20} />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Statistiques d'espace disque */}
      {storageStats.disk_space && (
        <div className="card bg-base-100 shadow-md rounded-xl hover:shadow-lg transition-shadow">
          <div className="card-body p-6">
            <h2 className="card-title text-xl mb-6 flex items-center">
              <FiHardDrive className="mr-3 text-info" size={24} />
              Espace disque
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="stat">
                <div className="stat-title text-xs font-medium opacity-70">Total</div>
                <div className="stat-value text-lg font-bold">
                  {storageStats.disk_space.total_formatted || formatFileSize(storageStats.disk_space.total)}
                </div>
              </div>
              <div className="stat">
                <div className="stat-title text-xs font-medium opacity-70">Utilisé</div>
                <div className="stat-value text-lg font-bold">
                  {storageStats.disk_space.used_formatted || formatFileSize(storageStats.disk_space.used)}
                </div>
              </div>
              <div className="stat">
                <div className="stat-title text-xs font-medium opacity-70">Libre</div>
                <div className="stat-value text-lg font-bold text-success">
                  {storageStats.disk_space.free_formatted || formatFileSize(storageStats.disk_space.free)}
                </div>
              </div>
            </div>
            
            <div className="w-full">
              <progress 
                className="progress progress-primary w-full h-3 rounded-full" 
                value={storageStats.disk_space.usage_percent || 0} 
                max="100"
              />
              <div className="text-sm text-center mt-3 font-medium">
                {storageStats.disk_space.usage_percent || 0}% utilisé
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HistoryCard
          title="Dernières sauvegardes"
          icon={FiSave}
          items={backupHistory}
          emptyMessage="Aucune sauvegarde récente"
          color="primary"
        />
        
        <HistoryCard
          title="Dernières restaurations"
          icon={FiRotateCcw}
          items={restoreHistory}
          emptyMessage="Aucune restauration récente"
          color="info"
        />
      </div>
    </div>
  );
};

DashboardView.propTypes = {
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  configurations: PropTypes.array.isRequired,
  backupHistory: PropTypes.array.isRequired,
  restoreHistory: PropTypes.array.isRequired,
  storageStats: PropTypes.object.isRequired,
  onQuickBackup: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  runningOperations: PropTypes.instanceOf(Set).isRequired
};

// Composant principal
const BackupManagement = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { 
    runningOperations, 
    startOperation, 
    endOperation, 
    isOperationRunning 
  } = useOperations();
  
  const {
    configurations,
    backupHistory,
    restoreHistory,
    storageStats,
    loading,
    error,
    loadData
  } = useBackupData();

  // Définition des onglets
  const tabs = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: FiBarChart },
    { id: 'configurations', label: 'Configurations', icon: FiSettings },
    { id: 'history', label: 'Historique', icon: FiList },
    { id: 'restore', label: 'Restaurations', icon: FiRotateCcw }
  ], []);

  // Chargement initial des données
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fonction pour créer une sauvegarde rapide
  const createQuickBackup = useCallback(async (backupType) => {
    const operationId = `quick_${backupType}_${Date.now()}`;
    
    try {
      startOperation(operationId);
      await backupService.createQuickBackup(backupType);
      
      // Recharger les données après la sauvegarde
      setTimeout(() => {
        loadData();
      }, 1000);
      
    } catch (err) {
      console.error('Erreur lors de la sauvegarde rapide:', err);
    } finally {
      endOperation(operationId);
    }
  }, [startOperation, endOperation, loadData]);

  // Rendu du contenu selon l'onglet actif
  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            loading={loading}
            error={error}
            configurations={configurations}
            backupHistory={backupHistory}
            restoreHistory={restoreHistory}
            storageStats={storageStats}
            onQuickBackup={createQuickBackup}
            onRefresh={loadData}
            runningOperations={runningOperations}
          />
        );
      
      case 'configurations':
        return (
          <div className="text-center py-12">
            <FiSettings className="mx-auto text-4xl text-base-content/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Configurations de sauvegarde</h3>
            <p className="text-base-content/70">Cette section sera implémentée prochainement</p>
          </div>
        );
      
      case 'history':
        return (
          <div className="text-center py-12">
            <FiList className="mx-auto text-4xl text-base-content/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Historique des sauvegardes</h3>
            <p className="text-base-content/70">Cette section sera implémentée prochainement</p>
          </div>
        );
      
      case 'restore':
        return (
          <div className="text-center py-12">
            <FiRotateCcw className="mx-auto text-4xl text-base-content/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Restaurations</h3>
            <p className="text-base-content/70">Cette section sera implémentée prochainement</p>
          </div>
        );
      
      default:
        return null;
    }
  }, [
    activeTab,
    loading,
    error,
    configurations,
    backupHistory,
    restoreHistory,
    storageStats,
    createQuickBackup,
    loadData,
    runningOperations
  ]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center">
          <FiHardDrive className="mr-3 text-primary" />
          Gestion des sauvegardes
        </h1>
        <p className="text-base-content/70">
          Configurez et surveillez vos sauvegardes automatiques
        </p>
      </div>

      {/* Navigation par onglets */}
      <div className="tabs tabs-bordered mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab tab-lg whitespace-nowrap ${
              activeTab === tab.id ? 'tab-active' : ''
            }`}
          >
            <tab.icon className="mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="min-h-[500px]">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default React.memo(BackupManagement);