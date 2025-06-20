// frontend/src/pages/DashboardAdmin.jsx
import React, { useCallback, useMemo } from 'react';
import { Link, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { FiDatabase, FiSettings, FiTable, FiHardDrive, FiFileText } from 'react-icons/fi';
import { DynamicTableProvider } from '../contexts/DynamicTableProvider';
import { Breadcrumb } from '../components/ui';
import TableManagement from './Admin/Database/TableManagement';
import CreateTablePage from './Admin/Database/CreateTablePage';
import EditTablePage from './Admin/Database/EditTablePage';
import ManageFieldsPage from './Admin/Database/ManageFieldsPage';
import RecordsPage from './Admin/Database/RecordsPage';
import CreateRecordPage from './Admin/Database/CreateRecordPage';
import EditRecordPage from './Admin/Database/EditRecordPage';
import { LogsPage } from './Admin/Logs';
import DataExplorer from './Admin/DataExplorer/DataExplorer';
import BackupManagement from './Admin/Backup/BackupManagement';
import { UserManagement } from './Admin/Users';

/**
 * Composant pour la vue d'ensemble de la base de données
 * @returns {JSX.Element} Le composant de vue d'ensemble
 */
const DatabaseOverview = React.memo(() => {
  const navigate = useNavigate();

  const goToTables = useCallback(() => {
    navigate('/admin/database/tables');
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
    },
    {
      id: 'users',
      icon: '👥',
      title: 'Gestion des Utilisateurs',
      description: 'Gérer les comptes utilisateur, permissions et groupes',
      buttonText: 'Gérer les utilisateurs',
      to: '/admin/users',
      color: 'accent'
    }
  ], [goToTables, goToBackup]);

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

            <Route path="/backup" element={<BackupManagement />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/data-explorer" element={<DataExplorer />} />
            <Route path="/users" element={
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">Gestion des Utilisateurs</h2>
                <p>Test - cette page fonctionne !</p>
                <UserManagement />
              </div>
            } />
          </Routes>
        </div>
      </div>
    </DynamicTableProvider>
  );
});

export default AdminDashboard;