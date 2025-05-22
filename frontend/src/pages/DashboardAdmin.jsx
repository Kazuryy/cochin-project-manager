// frontend/src/pages/DashboardAdmin.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';
import { FiDatabase, FiSettings } from 'react-icons/fi';

function AdminDashboard() {
  return (
    <div className="pt-6">
      {/* Sidebar */}
      <div className="container mx-auto mt-4">
        <h1 className="text-4xl font-bold text-center">Dashboard Admin</h1>
        <p className="text-center mt-4 pr-80 pl-80">Gérer les paramètres, les tables, les utilisateurs, etc.</p>
        <div className="flex w-full flex-col">
            <div className="divider pl-40 pr-40"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            <Card 
              title="Paramètres"
              subtitle="Utilisateurs, groupes, permissions."
              className="w-full"
              withShadow={true}
            >
                <div className="flex items-center justify-center text-5xl mb-4 text-primary">
                  <FiSettings />
                </div>
                <Link to="/admin/settings">
                    <button className="btn btn-accent w-full">Modifier</button>
                </Link>
            </Card>
            
            <Card 
              title="Base de données"
              subtitle="Modifier, supprimer, créer des tables."
              className="w-full"
              withShadow={true}
            >
                <div className="flex items-center justify-center text-5xl mb-4 text-primary">
                  <FiDatabase />
                </div>
                <Link to="/admin/database">
                    <button className="btn btn-accent w-full">Gérer</button>
                </Link>
            </Card>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;