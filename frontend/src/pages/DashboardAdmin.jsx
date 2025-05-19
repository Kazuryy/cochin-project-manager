// frontend/src/pages/Admin/AdminDashboard.jsx
import React from 'react';
import { FiUsers, FiDatabase, FiSettings, FiShield } from 'react-icons/fi';
import { Link, Outlet } from 'react-router-dom';
import DatabaseManager from './Admin/DatabaseManager';

function AdminDashboard() {
  return (
    <div className="drawer lg:drawer-open">
      <input id="admin-drawer" type="checkbox" className="drawer-toggle" />
      
      <div className="drawer-content flex flex-col">
        {/* Navbar */}
        <div className="navbar bg-base-100 lg:hidden">
          <div className="flex-none">
            <label htmlFor="admin-drawer" className="btn btn-square btn-ghost drawer-button">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-5 h-5 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </label>
          </div>
          <div className="flex-1">
            <span className="text-xl font-bold">Administration</span>
          </div>
        </div>

        {/* Page content */}
        <div className="p-4">
          <Outlet />
        </div>
      </div>
      
      {/* Sidebar */}
      <div className="drawer-side">
        <label htmlFor="admin-drawer" className="drawer-overlay">Forulaire</label>
        <aside className="bg-base-200 w-80 min-h-screen">
          <div className="p-4">
            <h1 className="text-2xl font-bold mb-6">Administration</h1>
            
            <ul className="menu menu-lg gap-2">
              <li>
                <Link to="/admin/users" className="flex items-center">
                  <FiUsers className="w-5 h-5" />
                  Gestion des utilisateurs
                </Link>
              </li>
              <li>
                <Link to="/admin/roles" className="flex items-center">
                  <FiShield className="w-5 h-5" />
                  Rôles et permissions
                </Link>
              </li>
              <li>
                <Link to="/admin/database" className="flex items-center">
                  <FiDatabase className="w-5 h-5" />
                  Base de données
                </Link>
              </li>
              <li>
                <Link to="/admin/settings" className="flex items-center">
                  <FiSettings className="w-5 h-5" />
                  Paramètres
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default AdminDashboard;

// frontend/src/pages/Admin/Users/UsersList.jsx
function UsersList() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des utilisateurs</h2>
        <button className="btn btn-primary">Ajouter un utilisateur</button>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nom d'utilisateur</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>admin</td>
                  <td>admin@example.com</td>
                  <td>
                    <div className="badge badge-primary">Administrateur</div>
                  </td>
                  <td>
                    <div className="badge badge-success">Actif</div>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-info">Éditer</button>
                      <button className="btn btn-sm btn-error">Supprimer</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}