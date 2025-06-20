import React, { useState } from 'react';
import { Button } from '../../../components/ui/index.js';

const UserBulkActions = ({ selectedCount, onAction, onCancel }) => {
  const [selectedAction, setSelectedAction] = useState('');
  const [lockDuration, setLockDuration] = useState(15);
  const [loading, setLoading] = useState(false);

  /**
   * Actions disponibles avec leurs descriptions
   */
  const actions = [
    {
      value: 'unlock',
      label: 'Déverrouiller les comptes',
      description: 'Déverrouille les comptes utilisateur verrouillés',
      variant: 'success',
      icon: '🔓'
    },
    {
      value: 'lock',
      label: 'Verrouiller les comptes',
      description: 'Verrouille temporairement les comptes utilisateur',
      variant: 'warning',
      icon: '🔒',
      hasOptions: true
    },
    {
      value: 'reset_attempts',
      label: 'Réinitialiser les tentatives',
      description: 'Remet à zéro le compteur de tentatives de connexion échouées',
      variant: 'info',
      icon: '🔄'
    },
    {
      value: 'force_password_change',
      label: 'Forcer changement mot de passe',
      description: 'Oblige les utilisateurs à changer leur mot de passe',
      variant: 'warning',
      icon: '🔑'
    },
    {
      value: 'activate',
      label: 'Activer les comptes',
      description: 'Active les comptes utilisateur désactivés',
      variant: 'success',
      icon: '✅'
    },
    {
      value: 'deactivate',
      label: 'Désactiver les comptes',
      description: 'Désactive les comptes utilisateur',
      variant: 'error',
      icon: '❌'
    },
    {
      value: 'make_staff',
      label: 'Donner droits admin',
      description: 'Accorde les droits d\'administrateur',
      variant: 'info',
      icon: '👑'
    },
    {
      value: 'remove_staff',
      label: 'Retirer droits admin',
      description: 'Retire les droits d\'administrateur',
      variant: 'warning',
      icon: '👤'
    }
  ];

  /**
   * Gère l'exécution de l'action
   */
  const handleExecuteAction = async () => {
    if (!selectedAction) return;

    const action = actions.find(a => a.value === selectedAction);
    
    // Demander confirmation pour les actions importantes
    const confirmMessage = `Êtes-vous sûr de vouloir ${action.label.toLowerCase()} pour ${selectedCount} utilisateur(s) ?`;
    if (!confirm(confirmMessage)) return;

    setLoading(true);
    
    try {
      const options = {};
      
      // Ajouter des options spécifiques selon l'action
      if (selectedAction === 'lock') {
        options.duration = lockDuration;
      }

      await onAction(selectedAction, options);
    } catch (error) {
      console.error('Erreur lors de l\'exécution de l\'action:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Obtient la classe CSS pour le variant
   */
  const getVariantClass = (variant) => {
    const variants = {
      success: 'border-success text-success',
      warning: 'border-warning text-warning',
      error: 'border-error text-error',
      info: 'border-info text-info'
    };
    return variants[variant] || '';
  };

  return (
    <div className="space-y-6">
      {/* Informations sur la sélection */}
      <div className="text-center p-4 bg-blue-50 rounded-lg">
        <p className="text-blue-700 font-medium">
          {selectedCount} utilisateur(s) sélectionné(s)
        </p>
      </div>

      {/* Sélection de l'action */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Choisissez une action :</h3>
        
        <div className="grid gap-3">
          {actions.map(action => (
            <label
              key={action.value}
              className={`
                cursor-pointer p-4 border-2 rounded-lg transition-all
                ${selectedAction === action.value 
                  ? `${getVariantClass(action.variant)} bg-opacity-10` 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <input
                type="radio"
                name="action"
                value={action.value}
                checked={selectedAction === action.value}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="sr-only"
              />
              
              <div className="flex items-start space-x-3">
                <span className="text-2xl">{action.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{action.label}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {action.description}
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Options spécifiques */}
      {selectedAction === 'lock' && (
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h4 className="font-medium text-yellow-800 mb-3">Options de verrouillage</h4>
          
          <div className="form-control w-full max-w-xs">
            <label className="label">
              <span className="label-text">Durée (en minutes)</span>
            </label>
            <select
              className="select select-bordered"
              value={lockDuration}
              onChange={(e) => setLockDuration(parseInt(e.target.value))}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 heure</option>
              <option value={120}>2 heures</option>
              <option value={240}>4 heures</option>
              <option value={1440}>24 heures</option>
            </select>
          </div>
        </div>
      )}

      {/* Avertissements pour certaines actions */}
      {['deactivate', 'remove_staff', 'force_password_change'].includes(selectedAction) && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start space-x-2">
            <span className="text-red-500 text-xl">⚠️</span>
            <div className="text-red-700">
              <p className="font-medium">Attention !</p>
              <p className="text-sm mt-1">
                {selectedAction === 'deactivate' && 
                  'Les utilisateurs désactivés ne pourront plus se connecter.'
                }
                {selectedAction === 'remove_staff' && 
                  'Les utilisateurs perdront leurs droits d\'administration.'
                }
                {selectedAction === 'force_password_change' && 
                  'Les utilisateurs devront changer leur mot de passe à la prochaine connexion.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-4">
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={loading}
        >
          Annuler
        </Button>
        
        <Button
          className="btn-primary"
          onClick={handleExecuteAction}
          disabled={!selectedAction || loading}
        >
          {loading ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              Exécution...
            </>
          ) : (
            `Exécuter l'action`
          )}
        </Button>
      </div>
    </div>
  );
};

export default UserBulkActions; 