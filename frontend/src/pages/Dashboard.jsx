import React from 'react';
import Page from "../components/global/Page";
import { Card } from '../components/ui';
import { useAuth } from '../hooks/useAuth';

function Dashboard() {
  const { user } = useAuth();

  return (
    <Page>
      <div className="pt-8 pb-12">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">Tableau de bord</h1>
          <p className="text-center text-base-content/70 mb-8">
            Bienvenue, {user?.username || 'utilisateur'} ! Voici votre espace de gestion de projets.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <Card 
              title="Projets actifs" 
              subtitle="Consultez les projets en cours"
              width="full"
            >
              <p className="text-center py-8 text-base-content/60">
                Aucun projet actif pour le moment
              </p>
              
              <div className="card-actions justify-end mt-4">
                <button className="btn btn-primary">Créer un projet</button>
              </div>
            </Card>

            <Card 
              title="Activité récente" 
              subtitle="Les dernières mises à jour"
              width="full"
            >
              <div className="py-2">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <span className="text-sm">Aucune activité récente</span>
                  </li>
                </ul>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Page>
  );
}

export default Dashboard;