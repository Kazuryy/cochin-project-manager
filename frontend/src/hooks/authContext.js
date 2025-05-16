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