// frontend/src/pages/Admin/DatabaseManager.jsx
import React from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { FiDatabase, FiTable, FiHardDrive, FiCheckSquare, FiFileText, FiSettings } from 'react-icons/fi';
import { DynamicTableProvider } from '../../contexts/DynamicTableProvider';
import Breadcrumb from '../../components/ui/Breadcrumb';
import TableManagement from './Database/TableManagement';
import CreateTablePage from './Database/CreateTablePage';
import EditTablePage from './Database/EditTablePage';
import ManageFieldsPage from './Database/ManageFieldsPage';
import RecordsPage from './Database/RecordsPage';
import CreateRecordPage from './Database/CreateRecordPage';
import EditRecordPage from './Database/EditRecordPage';

function DatabaseManager() {
    return (
      <DynamicTableProvider>
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb dynamique */}
          <Breadcrumb />
          
          <Routes>
            <Route path="/" element={<DatabaseOverview />} />
            <Route path="/tables" element={<TableManagement />} />
            <Route path="/tables/create" element={<CreateTablePage />} />
            <Route path="/tables/:tableId/edit" element={<EditTablePage />} />
            <Route path="/tables/:tableId/fields" element={<ManageFieldsPage />} />
            <Route path="/tables/:tableId/records" element={<RecordsPage />} />
            <Route path="/tables/:tableId/records/create" element={<CreateRecordPage />} />
            <Route path="/tables/:tableId/records/:recordId/edit" element={<EditRecordPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
          </Routes>
        </div>
      </DynamicTableProvider>
    );
}

// Composant pour la vue d'ensemble de la base de données
function DatabaseOverview() {
    const navigate = useNavigate();

    // Fonction pour naviguer
    const goToTables = () => {
        navigate('/admin/database/tables');
    };

    const goToMaintenance = () => {
        navigate('/admin/database/maintenance');
    };

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
          <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="card-body">
              <div className="flex items-center justify-center text-4xl mb-4 text-primary">
                <FiTable />
              </div>
              <h3 className="card-title justify-center">Tables Dynamiques</h3>
              <p className="text-center">Créer et gérer des tables personnalisées avec leurs champs et données</p>
              <div className="card-actions justify-center mt-4">
                <button className="btn btn-primary" onClick={goToTables}>Gérer les tables</button>
              </div>
            </div>
          </div>
  
          <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="card-body">
              <div className="flex items-center justify-center text-4xl mb-4 text-primary">
                <FiHardDrive />
              </div>
              <h3 className="card-title justify-center">Sauvegardes</h3>
              <p className="text-center">Gérer les sauvegardes de la base de données et restaurer si nécessaire</p>
              <div className="card-actions justify-center mt-4">
                <button className="btn btn-outline">Créer une sauvegarde</button>
              </div>
            </div>
          </div>
  
          <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="card-body">
              <div className="flex items-center justify-center text-4xl mb-4 text-primary">
                <FiCheckSquare />
              </div>
              <h3 className="card-title justify-center">Maintenance</h3>
              <p className="text-center">Optimiser, réparer et vérifier l'intégrité de la base de données</p>
              <div className="card-actions justify-center mt-4">
                <button className="btn btn-outline" onClick={goToMaintenance}>
                  Maintenance
                </button>
              </div>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="card-body">
              <div className="flex items-center justify-center text-4xl mb-4 text-primary">
                <FiFileText />
              </div>
              <h3 className="card-title justify-center">Logs</h3>
              <p className="text-center">Consulter les logs système et les journaux d'erreurs</p>
              <div className="card-actions justify-center mt-4">
                <button className="btn btn-outline">Voir les logs</button>
              </div>
            </div>
          </div>
          
          <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className="card-body">
              <div className="flex items-center justify-center text-4xl mb-4 text-primary">
                <FiDatabase />
              </div>
              <h3 className="card-title justify-center">Structure de la DB</h3>
              <p className="text-center">Visualiser et gérer la structure de la base de données</p>
              <div className="card-actions justify-center mt-4">
                <button className="btn btn-outline">Explorer</button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-base-200 p-6 rounded-lg">
          <h3 className="text-xl font-bold mb-4">Raccourcis Tables Dynamiques</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/admin/database/tables" className="btn btn-outline w-full justify-start">
              <FiTable className="mr-2" />
              Liste des tables
            </Link>
            <Link to="/admin/database/tables/create" className="btn btn-outline w-full justify-start">
              <FiTable className="mr-2" />
              Créer une table
            </Link>
            <Link to="/admin/database/maintenance" className="btn btn-outline w-full justify-start">
              <FiSettings className="mr-2" />
              Maintenance DB
            </Link>
          </div>
        </div>
      </div>
    );
}

// Nouveau composant pour la page de maintenance
function MaintenancePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const runMaintenance = async (type = 'light') => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/database/maintenance/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ type })
      });
      
      if (response.ok) {
        const result = await response.json();
        setLastResult(result);
      } else {
        setLastResult({ success: false, error: 'Erreur lors de la maintenance' });
      }
    } catch (err) {
      setLastResult({ success: false, error: err.message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Maintenance de la base de données</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h3 className="card-title">🧹 Maintenance légère</h3>
            <ul className="text-sm space-y-1">
              <li>• Nettoie les clés étrangères orphelines</li>
              <li>• Supprime les références invalides</li>
              <li>• Rapide (1-2 minutes)</li>
            </ul>
            <div className="card-actions justify-end mt-4">
              <button 
                className="btn btn-primary"
                onClick={() => runMaintenance('light')}
                disabled={isRunning}
              >
                {isRunning ? 'En cours...' : 'Lancer'}
              </button>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h3 className="card-title">🔧 Maintenance complète</h3>
            <ul className="text-sm space-y-1">
              <li>• Inclut la maintenance légère</li>
              <li>• Réorganise les IDs</li>
              <li>• Met à jour les références FK</li>
              <li>• Plus lente (5-15 minutes)</li>
            </ul>
            <div className="card-actions justify-end mt-4">
              <button 
                className="btn btn-warning"
                onClick={() => runMaintenance('full')}
                disabled={isRunning}
              >
                {isRunning ? 'En cours...' : 'Lancer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Résultats de la dernière maintenance */}
      {lastResult && (
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

      {/* Planning automatique */}
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
}

export default DatabaseManager;