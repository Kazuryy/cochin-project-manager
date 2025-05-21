// frontend/src/pages/Admin/DatabaseManager.jsx
import React from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { FiDatabase, FiTable, FiHardDrive, FiCheckSquare, FiFileText } from 'react-icons/fi';
import { DynamicTableProvider } from '../../contexts/DynamicTableProvider';
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
        <Routes>
          <Route path="/" element={<Navigate to="tables" replace />} />
          <Route path="/tables" element={<TableManagement />} />
          <Route path="/tables/create" element={<CreateTablePage />} />
          <Route path="/tables/:tableId/edit" element={<EditTablePage />} />
          <Route path="/tables/:tableId/fields" element={<ManageFieldsPage />} />
          <Route path="/tables/:tableId/records" element={<RecordsPage />} />
          <Route path="/tables/:tableId/records/create" element={<CreateRecordPage />} />
          <Route path="/tables/:tableId/records/:recordId/edit" element={<EditRecordPage />} />
        </Routes>
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
                <button className="btn btn-outline">Maintenance</button>
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
            {/* Si vous avez une table récente, vous pourriez ajouter un lien direct */}
            {/* 
            <Link to="/admin/tables/1/records" className="btn btn-outline w-full justify-start">
              <FiTable className="mr-2" />
              Table "Projets"
            </Link>
            */}
          </div>
        </div>
      </div>
    );
}

export default DatabaseManager;