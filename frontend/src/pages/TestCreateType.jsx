import React, { useState } from 'react';
import CreateTypeModal from '../components/modals/CreateTypeModal';
import { typeService } from '../services/typeService';

function TestCreateType() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const handleCreateType = async (typeName, columns) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await typeService.createNewType(typeName, columns);
      
      if (result.success) {
        setSuccessMessage(result.message);
        setIsModalOpen(false);
        
        // Effacer le message de succès après 5 secondes
        setTimeout(() => {
          setSuccessMessage('');
        }, 5000);
      } else {
        setError(result.error);
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError(error.message || 'Erreur lors de la création du type');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-100 p-6">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Test de création de types</h1>
          <p className="text-lg text-base-content/70">
            Testez la nouvelle fonctionnalité de création de types avec leurs tables associées
          </p>
        </div>

        {successMessage && (
          <div className="alert alert-success mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <h2 className="card-title justify-center text-2xl mb-4">
              🚀 Créer un nouveau type
            </h2>
            
            <p className="mb-6 text-base-content/70">
              Cliquez sur le bouton ci-dessous pour ouvrir le modal de création de type.
              <br />
              Le processus créera automatiquement :
            </p>
            
            <ul className="list-disc list-inside text-left max-w-md mx-auto mb-6 space-y-1">
              <li>Une entrée dans la table <strong>TableNames</strong></li>
              <li>Une nouvelle table <strong>[Nom]Details</strong></li>
              <li>Les colonnes personnalisées que vous définissez</li>
              <li>Les liens vers la table <strong>Choix</strong> si nécessaire</li>
            </ul>
            
            <div className="card-actions justify-center">
              <button 
                className="btn btn-primary btn-lg"
                onClick={() => setIsModalOpen(true)}
                disabled={isLoading}
              >
                ➕ Créer un nouveau type
              </button>
            </div>
            
            {isLoading && (
              <div className="mt-4">
                <span className="loading loading-spinner loading-md"></span>
                <p className="mt-2">Création en cours...</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8">
          <div className="card bg-base-200">
            <div className="card-body">
              <h3 className="card-title text-lg">ℹ️ Comment ça fonctionne</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <strong>Étape 1 :</strong> Vous saisissez le nom du type (ex: "Prestation")
                </div>
                <div>
                  <strong>Étape 2 :</strong> Vous définissez les colonnes pour la table PrestationDetails
                </div>
                <div>
                  <strong>Étape 3 :</strong> Le système crée automatiquement :
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>L'entrée "Prestation" dans TableNames</li>
                    <li>La table "PrestationDetails" avec vos colonnes</li>
                    <li>Les colonnes dans "Choix" si vous avez spécifié des liens</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <CreateTypeModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setError(null);
          }}
          onCreateType={handleCreateType}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
}

export default TestCreateType; 