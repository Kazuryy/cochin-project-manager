import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FiRefreshCw, FiDownload, FiFileText, FiShield, FiInfo, FiAlertTriangle, FiAlertCircle, FiZap, FiCode } from 'react-icons/fi';

// Constantes
const REFRESH_INTERVAL = 5000;
const DEFAULT_LINES = 100;
const LINE_OPTIONS = [50, 100, 200, 500, 1000];

function LogsPage() {
  const [activeTab, setActiveTab] = useState('app');
  const [logs, setLogs] = useState([]);
  const [fileInfo, setFileInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lines, setLines] = useState(DEFAULT_LINES);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);

  // Fonction pour récupérer les logs
  const fetchLogs = useCallback(async (logType = activeTab, numLines = lines) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/database/logs/?type=${logType}&lines=${numLines}`, {
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLogs(data.logs);
        setFileInfo(data.file_info);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(`Erreur lors du chargement des logs: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, lines]);

  // Chargement initial
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Gestion de l'auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchLogs();
      }, REFRESH_INTERVAL);
      setRefreshInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh, fetchLogs, refreshInterval]);

  // Fonction pour télécharger les logs
  const downloadLogs = useCallback(() => {
    try {
      const logContent = logs.join('\n');
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}_logs_${new Date().toISOString().split('T')[0]}.log`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Erreur lors du téléchargement des logs: ${err.message}`);
    }
  }, [logs, activeTab]);

  // Fonction pour déterminer le style selon le niveau de log
  const getLogBadge = useCallback((line) => {
    if (line.includes('ERROR') || line.includes('CRITICAL')) {
      return { badge: 'badge-error', icon: FiAlertCircle, level: 'ERROR' };
    } else if (line.includes('WARNING')) {
      return { badge: 'badge-warning', icon: FiAlertTriangle, level: 'WARN' };
    } else if (line.includes('INFO')) {
      return { badge: 'badge-info', icon: FiInfo, level: 'INFO' };
    } else if (line.includes('DEBUG')) {
      return { badge: 'badge-accent', icon: FiCode, level: 'DEBUG' };
    }
    return { badge: 'badge-neutral', icon: FiFileText, level: 'LOG' };
  }, []);

  // Fonction pour déterminer la classe d'alerte selon le niveau
  const getLogAlertClass = useCallback((line) => {
    if (line.includes('ERROR') || line.includes('CRITICAL')) {
      return 'alert-error';
    } else if (line.includes('WARNING')) {
      return 'alert-warning';
    } else if (line.includes('INFO')) {
      return 'alert-info';
    } else if (line.includes('DEBUG')) {
      return 'alert-accent';
    }
    return '';
  }, []);

  // Mémorisation des options de lignes
  const lineOptions = useMemo(() => 
    LINE_OPTIONS.map(value => (
      <option key={value} value={value}>{value}</option>
    )), []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="card-title text-3xl">
                📊 Logs du Système
              </h1>
              <p className="text-base-content/70">Surveillance en temps réel de votre application</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              {/* Auto-refresh toggle */}
              <div className="form-control">
                <label className="label cursor-pointer gap-3">
                  <span className="label-text">Auto-refresh (5s)</span>
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="toggle toggle-primary"
                  />
                </label>
              </div>
              
              {/* Boutons */}
              <button
                onClick={() => fetchLogs()}
                disabled={isLoading}
                className="btn btn-primary"
              >
                <FiRefreshCw className={`${isLoading ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
              
              <button
                onClick={downloadLogs}
                disabled={logs.length === 0}
                className="btn btn-outline btn-success"
              >
                <FiDownload />
                Télécharger
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Tabs */}
            <div className="tabs tabs-boxed">
              <button
                className={`tab gap-2 ${activeTab === 'app' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('app')}
              >
                <FiFileText />
                Logs Généraux
              </button>
              <button
                className={`tab gap-2 ${activeTab === 'security' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                <FiShield />
                Logs Sécurité
              </button>
            </div>

            {/* Selector */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Nombre de lignes:</span>
              </label>
              <select
                value={lines}
                onChange={(e) => setLines(Number(e.target.value))}
                className="select select-bordered"
              >
                {lineOptions}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {fileInfo && (
        <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
          <div className="stat">
            <div className="stat-figure text-primary">
              <FiInfo className="text-3xl" />
            </div>
            <div className="stat-title">Taille du fichier</div>
            <div className="stat-value text-primary">{fileInfo.size_mb} MB</div>
            <div className="stat-desc">{fileInfo.size} bytes</div>
          </div>
          
          <div className="stat">
            <div className="stat-figure text-secondary">
              <FiZap className="text-3xl" />
            </div>
            <div className="stat-title">Dernière modification</div>
            <div className="stat-value text-secondary text-lg">
              {new Date(fileInfo.modified).toLocaleDateString('fr-FR')}
            </div>
            <div className="stat-desc">
              {new Date(fileInfo.modified).toLocaleTimeString('fr-FR')}
            </div>
          </div>
          
          <div className="stat">
            <div className="stat-figure text-accent">
              <FiFileText className="text-3xl" />
            </div>
            <div className="stat-title">Lignes affichées</div>
            <div className="stat-value text-accent">{fileInfo.lines_returned}</div>
            <div className="stat-desc">sur {lines} demandées</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-error">
          <FiAlertCircle />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
          <span className="ml-4">Chargement des logs...</span>
        </div>
      )}

      {/* Logs Display */}
      {!isLoading && !error && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-0">
            {logs.length === 0 ? (
              <div className="p-12 text-center">
                <FiFileText className="mx-auto mb-4 text-6xl opacity-30" />
                <h3 className="text-xl font-semibold mb-2">Aucun log trouvé</h3>
                <p className="opacity-70">Les logs apparaîtront ici une fois générés</p>
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto">
                <div className="space-y-1 p-4">
                  {logs.map((line, index) => {
                    const logStyle = getLogBadge(line);
                    const IconComponent = logStyle.icon;
                    const alertClass = getLogAlertClass(line);
                    
                    return (
                      <div
                        key={`log-${index}-${line.substring(0, 20)}`}
                        className={`alert ${alertClass} py-3`}
                      >
                        <div className="flex items-start gap-3 w-full">
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="badge badge-outline text-xs font-mono">
                              {logs.length - index}
                            </div>
                            <div className={`badge ${logStyle.badge} gap-1`}>
                              <IconComponent className="text-xs" />
                              {logStyle.level}
                            </div>
                          </div>
                          <span className="font-mono text-sm leading-relaxed break-all flex-1">
                            {line}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Guide */}
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h3 className="card-title text-xl mb-4">
            🎯 Guide de lecture des logs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="alert alert-error">
              <FiAlertCircle />
              <div>
                <h4 className="font-bold">ERROR/CRITICAL</h4>
                <p className="text-xs">Erreurs graves nécessitant une attention immédiate</p>
              </div>
            </div>
            
            <div className="alert alert-warning">
              <FiAlertTriangle />
              <div>
                <h4 className="font-bold">WARNING</h4>
                <p className="text-xs">Avertissements à surveiller</p>
              </div>
            </div>
            
            <div className="alert alert-info">
              <FiInfo />
              <div>
                <h4 className="font-bold">INFO</h4>
                <p className="text-xs">Informations générales sur le fonctionnement</p>
              </div>
            </div>
            
            <div className="alert alert-accent">
              <FiCode />
              <div>
                <h4 className="font-bold">DEBUG</h4>
                <p className="text-xs">Informations détaillées pour le débogage</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogsPage; 