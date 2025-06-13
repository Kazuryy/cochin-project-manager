import { useContext } from 'react';
import { AuthContext } from './authContext';

/**
 * Hook personnalisé pour utiliser le contexte d'authentification
 * @returns {Object} Le contexte d'authentification contenant les informations de l'utilisateur et les méthodes d'authentification
 * @throws {Error} Si le hook est utilisé en dehors d'un AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  
  return context;
}