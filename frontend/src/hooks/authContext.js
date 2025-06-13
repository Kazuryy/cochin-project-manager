import { createContext } from 'react';

/**
 * @typedef {Object} AuthContextType
 * @property {Object|null} user - L'utilisateur authentifié
 * @property {boolean} isAuthenticated - État d'authentification
 * @property {boolean} isLoading - État de chargement
 * @property {Error|null} authError - Erreur d'authentification
 * @property {Function} login - Fonction de connexion
 * @property {Function} logout - Fonction de déconnexion
 * @property {Function} getCsrfToken - Fonction pour récupérer le token CSRF
 * @property {Function} initializeSession - Fonction d'initialisation de session
 * @property {Function} handleAuthError - Fonction de gestion des erreurs d'auth
 */

const AUTH_ERROR_MESSAGES = {
  PROVIDER_NOT_FOUND: 'AuthProvider not found',
  SESSION_EXPIRED: 'Session expired',
};

// Créer un contexte pour l'authentification avec une valeur par défaut
export const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  authError: null,
  login: () => Promise.reject(new Error(AUTH_ERROR_MESSAGES.PROVIDER_NOT_FOUND)),
  logout: () => Promise.reject(new Error(AUTH_ERROR_MESSAGES.PROVIDER_NOT_FOUND)),
  getCsrfToken: () => Promise.reject(new Error(AUTH_ERROR_MESSAGES.PROVIDER_NOT_FOUND)),
  initializeSession: () => {},
  handleAuthError: () => {},
});

/**
 * Récupère un cookie par son nom
 * @param {string} name - Nom du cookie
 * @returns {string|null} Valeur du cookie ou null si non trouvé
 */
export const getCookie = (name) => {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop().split(';').shift());
    }
    return null;
  } catch (error) {
    console.error('Error reading cookie:', error);
    return null;
  }
};

/**
 * Vérifie si une erreur est liée à l'authentification
 * @param {Error} error - L'erreur à vérifier
 * @returns {boolean} True si l'erreur est liée à l'authentification
 */
export const isAuthenticationError = (error) => {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorDetail = error.response?.data?.detail?.toLowerCase() || '';
  
  return (
    error.isSessionExpired ||
    error.status === 401 ||
    (error.status === 403 && errorDetail.includes('authentication')) ||
    errorMessage.includes(AUTH_ERROR_MESSAGES.SESSION_EXPIRED.toLowerCase())
  );
};

/**
 * Hook personnalisé pour gérer les erreurs d'authentification
 * @returns {Object} Objet contenant la fonction handleError
 */
export const useAuthErrorHandler = () => {
  return {
    handleError: (error) => {
      if (isAuthenticationError(error)) {
        console.warn('🔓 Authentication error detected:', error.message);
        return true;
      }
      return false;
    }
  };
};