import React from 'react';

function DatabaseManager() {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Gestion de la base de données</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Sauvegardes</h3>
              <p>Gérez les sauvegardes de la base de données</p>
              <div className="card-actions justify-end">
                <button className="btn btn-primary">Créer une sauvegarde</button>
              </div>
            </div>
          </div>
  
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Gérer les tables</h3>
              <p>Créer, modifier, supprimer des tables, etc...</p>
              <div className="card-actions justify-end">
                <button className="btn btn-warning">Maintenance</button>
              </div>
            </div>
          </div>
  
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Logs</h3>
              <p>Consultez les logs système</p>
              <div className="card-actions justify-end">
                <button className="btn btn-info">Voir les logs</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
}

export default DatabaseManager;