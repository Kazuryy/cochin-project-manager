// frontend/src/pages/Admin/AdminDashboard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/ui/Card';


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
        <div className="flex justify-center gap-4 mt-8">
            <Card 
            title="Paramètres"
            subtitle="Utilisateurs, groupes, permissions."
            className="w-96"
            withShadow={true}
            >
                <Link to="/admin/settings">
                    <button className="btn btn-accent w-full">Modifier</button>
                </Link>
            </Card>
            <Card 
            title="Base de données"
            subtitle="Modifier, supprimer, créer des tables."
            className="w-96"
            withShadow={true}
            >
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