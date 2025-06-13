// frontend/src/pages/DashboardAdmin.jsx
import React, { useState, useCallback, useMemo } from 'react';
import { Link, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { FiDatabase, FiSettings, FiTable, FiHardDrive, FiCheckSquare, FiFileText } from 'react-icons/fi';
import { DynamicTableProvider } from '../contexts/DynamicTableProvider';
import { Breadcrumb } from '../components/ui';
import TableManagement from './Admin/Database/TableManagement';
import CreateTablePage from './Admin/Database/CreateTablePage';
import EditTablePage from './Admin/Database/EditTablePage';
import ManageFieldsPage from './Admin/Database/ManageFieldsPage';
import RecordsPage from './Admin/Database/RecordsPage';
import CreateRecordPage from './Admin/Database/CreateRecordPage';
import EditRecordPage from './Admin/Database/EditRecordPage';
import LogsPage from './Admin/Logs/LogsPage';
import DataExplorer from './Admin/DataExplorer/DataExplorer';
import BackupManagement from './Admin/Backup/BackupManagement';

/**
 * Composant pour la vue d'ensemble de la base de données
 * @returns {JSX.Element} Le composant de vue d'ensemble
 */
const DatabaseOverview = React.memo(() => {
  const navigate = useNavigate();

  const goToTables = useCallback(() => {
    navigate('/admin/database/tables');
  }, [navigate]);

  const goToMaintenance = useCallback(() => {
    navigate('/admin/database/maintenance');
  }, [navigate]);

  const goToBackup = useCallback(() => {
    navigate('/admin/backup');
  }, [navigate]);

  const cards = useMemo(() => [
    {
      id: 'tables',
      icon: <FiTable />,
      title: 'Tables Dynamiques',
      description: 'Créer et gérer des tables personnalisées avec leurs champs et données',
      buttonText: 'Gérer les tables',
      onClick: goToTables,
      color: 'primary'
    },
    {
      id: 'backup',
      icon: <FiHardDrive />,
      title: '🗄️ Sauvegardes',
      description: 'Système complet de sauvegarde et restauration avec chiffrement et compression',
      buttonText: 'Gestion des sauvegardes',
      onClick: goToBackup,
      color: 'success'
    },
    {
      id: 'maintenance',
      icon: <FiCheckSquare />,
      title: 'Maintenance',
      description: 'Optimiser, réparer et vérifier l\'intégrité de la base de données',
      buttonText: 'Maintenance',
      onClick: goToMaintenance,
      color: 'warning'
    },
    {
      id: 'logs',
      icon: <FiFileText />,
      title: 'Logs',
      description: 'Consulter les logs système et les journaux d\'erreurs',
      buttonText: 'Voir les logs',
      to: '/admin/logs',
      color: 'info'
    },
    {
      id: 'explorer',
      icon: <FiDatabase />,
      title: 'Explorateur de Données',
      description: 'Explorer et naviguer dans toutes les tables et leurs données',
      buttonText: 'Explorer',
      to: '/admin/data-explorer',
      color: 'secondary'
    }
  ], [goToTables, goToBackup, goToMaintenance]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion de la base de données</h2>
        <div className="flex space-x-2">
          <Link to="/admin/database/tables" className="btn btn-primary">
            <FiTable className="mr-2" />
            Gérer les tables
          </Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div key={card.id} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="card-body">
              <div className={`flex items-center justify-center text-4xl mb-4 text-${card.color}`}>
                {card.icon}
              </div>
              <h3 className="card-title justify-center">{card.title}</h3>
              <p className="text-center">{card.description}</p>
              <div className="card-actions justify-center mt-4">
                {card.to ? (
                  <Link to={card.to} className={`btn btn-${card.color}`}>
                    {card.buttonText}
                  </Link>
                ) : (
                  <button 
                    className={`btn btn-${card.color}`} 
                    onClick={card.onClick}
                  >
                    {card.buttonText}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-base-200 p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-4">🚀 Raccourcis Rapides</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/admin/database/tables" className="btn btn-outline w-full justify-start">
            <FiTable className="mr-2" />
            Liste des tables
          </Link>
          <Link to="/admin/database/tables/create" className="btn btn-outline w-full justify-start">
            <FiTable className="mr-2" />
            Créer une table
          </Link>
          <Link to="/admin/backup" className="btn btn-outline w-full justify-start">
            <FiHardDrive className="mr-2" />
            Nouvelle sauvegarde
          </Link>
          <Link to="/admin/database/maintenance" className="btn btn-outline w-full justify-start">
            <FiSettings className="mr-2" />
            Maintenance DB
          </Link>
        </div>
      </div>
    </div>
  );
});

/**
 * Composant pour la page de maintenance
 * @returns {JSX.Element} Le composant de maintenance
 */
const MaintenancePage = React.memo(() => {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const runMaintenance = useCallback(async (type = 'light') => {
    setIsRunning(true);
    setError(null);
    try {
      const response = await fetch('/api/database/maintenance/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ type })
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const result = await response.json();
      setLastResult(result);
    } catch (err) {
      setError(err.message);
      setLastResult({ success: false, error: err.message });
    } finally {
      setIsRunning(false);
    }
  }, []);

  const maintenanceTypes = useMemo(() => [
    {
      id: 'light',
      title: '🧹 Maintenance légère',
      description: [
        '• Nettoie les clés étrangères orphelines',
        '• Supprime les références invalides',
        '• Rapide (1-2 minutes)'
      ],
      type: 'light',
      buttonColor: 'primary'
    },
    {
      id: 'full',
      title: '🔧 Maintenance complète',
      description: [
        '• Inclut la maintenance légère',
        '• Réorganise les IDs',
        '• Met à jour les références FK',
        '• Plus lente (5-15 minutes)'
      ],
      type: 'full',
      buttonColor: 'warning'
    }
  ], []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Maintenance de la base de données</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {maintenanceTypes.map((maintenance) => (
          <div key={maintenance.id} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">{maintenance.title}</h3>
              <ul className="text-sm space-y-1">
                {maintenance.description.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="card-actions justify-end mt-4">
                <button 
                  className={`btn btn-${maintenance.buttonColor}`}
                  onClick={() => runMaintenance(maintenance.type)}
                  disabled={isRunning}
                >
                  {isRunning ? 'En cours...' : 'Lancer'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="alert alert-error">
          <div>
            <h4 className="font-bold">❌ Erreur</h4>
            <p className="text-sm mt-2">{error}</p>
          </div>
        </div>
      )}

      {lastResult && !error && (
        <div className={`alert ${lastResult.success ? 'alert-success' : 'alert-error'}`}>
          <div>
            <h4 className="font-bold">
              {lastResult.success ? '✅ Maintenance terminée' : '❌ Erreur'}
            </h4>
            {lastResult.success ? (
              <ul className="text-sm mt-2">
                {lastResult.orphaned_fk_cleaned && (
                  <li>FK orphelines nettoyées: {lastResult.orphaned_fk_cleaned}</li>
                )}
                {lastResult.deleted_references_cleaned && (
                  <li>Références supprimées: {lastResult.deleted_references_cleaned}</li>
                )}
                {lastResult.tables_resequenced && (
                  <li>Tables réorganisées: {lastResult.tables_resequenced}</li>
                )}
              </ul>
            ) : (
              <p className="text-sm mt-2">{lastResult.error}</p>
            )}
          </div>
        </div>
      )}

      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title">⏰ Maintenance automatique</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold">Maintenance légère</h4>
              <p className="text-sm">Toutes les 6 heures</p>
            </div>
            <div>
              <h4 className="font-semibold">Maintenance complète</h4>
              <p className="text-sm">Tous les soirs à 2h00</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Composant principal du tableau de bord administrateur
 * @returns {JSX.Element} Le composant de tableau de bord
 */
const AdminDashboard = React.memo(() => {
  return (
    <DynamicTableProvider>
      <div className="pt-6">
        <Breadcrumb />
        
        <div className="container mx-auto mt-4">
          <h1 className="text-4xl font-bold text-center">Dashboard Admin</h1>
          <p className="text-center mt-4 pr-80 pl-80">Gérer les paramètres, les tables, les utilisateurs, etc.</p>
          
          <div className="flex w-full flex-col">
            <div className="divider pl-40 pr-40"></div>
          </div>

          <Routes>
            <Route path="/" element={<Navigate to="/admin/database" replace />} />
            <Route path="/database" element={<DatabaseOverview />} />
            <Route path="/database/tables" element={<TableManagement />} />
            <Route path="/database/tables/create" element={<CreateTablePage />} />
            <Route path="/database/tables/:tableId/edit" element={<EditTablePage />} />
            <Route path="/database/tables/:tableId/fields" element={<ManageFieldsPage />} />
            <Route path="/database/tables/:tableId/records" element={<RecordsPage />} />
            <Route path="/database/tables/:tableId/records/create" element={<CreateRecordPage />} />
            <Route path="/database/tables/:tableId/records/:recordId/edit" element={<EditRecordPage />} />
            <Route path="/database/maintenance" element={<MaintenancePage />} />
            <Route path="/backup" element={<BackupManagement />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/data-explorer" element={<DataExplorer />} />
          </Routes>
        </div>
      </div>
    </DynamicTableProvider>
  );
});

export default AdminDashboard;