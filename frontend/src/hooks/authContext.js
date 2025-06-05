import { createContext } from 'react';

// Créer un contexte pour l'authentification avec une valeur par défaut
// pour éviter les erreurs lorsque useAuth est appelé hors du Provider
export const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  authError: null,
  login: () => Promise.reject(new Error('AuthProvider non trouvé')),
  logout: () => Promise.reject(new Error('AuthProvider non trouvé')),
  getCsrfToken: () => Promise.reject(new Error('AuthProvider non trouvé')),
  handleAuthError: () => {}, // Nouvelle fonction pour gérer les erreurs d'auth
});

// Fonction pour récupérer le token CSRF des cookies
export const getCookie = (name) => {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith(name + '=')) {
      return trimmed.substring(name.length + 1);
    }
  }
  return null;
};

/**
 * Utilitaire pour vérifier si une erreur est liée à l'authentification
 */
export const isAuthenticationError = (error) => {
  if (!error) return false;
  
  return (
    error.isSessionExpired ||
    error.status === 401 ||
    (error.status === 403 && error.response?.data?.detail?.toLowerCase().includes('authentication')) ||
    error.message?.toLowerCase().includes('session expirée')
  );
};

/**
 * Hook personnalisé pour gérer les erreurs d'authentification dans les composants
 */
export const useAuthErrorHandler = () => {
  return {
    handleError: (error) => {
      if (isAuthenticationError(error)) {
        console.warn('🔓 Erreur d\'authentification détectée:', error.message);
        // L'erreur est déjà gérée par le service API
        return true; // Indique que l'erreur a été gérée
      }
      return false; // L'erreur doit être gérée par le composant
    }
  };
};