import { useCallback } from 'react';
import { useAuth } from './useAuth';

/**
 * Hook utilitaire pour la gestion de session utilisateur
 * Permet aux composants de renouveler facilement leur session
 * 
 * @returns {Object} Objet contenant les fonctions de gestion de session
 * @property {Function} renewSession - Fonction pour renouveler la session
 * @property {Function} withSessionRenewal - Wrapper pour les gestionnaires d'événements
 */
export const useSessionManager = () => {
  const { initializeSession } = useAuth();
  
  /**
   * Renouvelle la session utilisateur
   * @param {string} [action='user_action'] - Description de l'action qui déclenche le renouvellement
   * @returns {Promise<void>}
   */
  const renewSession = useCallback(async (action = 'user_action') => {
    try {
      console.debug(`🔄 Renouvellement de session: ${action}`);
      await initializeSession();
    } catch (error) {
      console.error(`❌ Erreur lors du renouvellement de session: ${error.message}`);
      throw error;
    }
  }, [initializeSession]);
  
  /**
   * Wrapper pour les gestionnaires d'événements qui renouvelle la session
   * @param {Function} handler - Gestionnaire d'événement original
   * @param {string} [actionName='event'] - Nom de l'action pour le logging
   * @returns {Function} Nouveau gestionnaire d'événement
   */
  const withSessionRenewal = useCallback((handler, actionName = 'event') => {
    return async (...args) => {
      await renewSession(actionName);
      return handler(...args);
    };
  }, [renewSession]);
  
  return {
    renewSession,
    withSessionRenewal
  };
};

/**
 * @deprecated Utilisez useSessionManager à la place
 * Hook de compatibilité pour le suivi d'activité
 * @returns {Object} Objet contenant les fonctions de suivi d'activité
 */
export const useActivityTracker = () => {
  const { renewSession: trackActivity, withSessionRenewal: withActivityTracking } = useSessionManager();
  return { trackActivity, withActivityTracking };
}; 