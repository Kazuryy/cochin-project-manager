import { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { AuthContext, getCookie } from './authContext';

/**
 * Provider d'authentification à utiliser au niveau de l'application
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // Vérification du statut d'authentification au chargement
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/auth/check/', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification', error);
        setAuthError('Impossible de vérifier votre statut d\'authentification');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);
  
  // Fonction pour obtenir le token CSRF
  const getCsrfToken = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/csrf/', {
        credentials: 'include',
      });
      
      // Le token est automatiquement défini dans les cookies
      return response.ok;
    } catch (error) {
      console.error('Erreur lors de l\'obtention du token CSRF', error);
      return false;
    }
  }, []);
  
  // Fonction de connexion
  const login = useCallback(async (credentials) => {
    setAuthError(null);
    
    try {
      // Obtenir un token CSRF avant la connexion
      await getCsrfToken();
      
      const response = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken'),
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Échec de la connexion');
      }
      
      setUser(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      setAuthError(error.message || 'Une erreur est survenue lors de la connexion');
      throw error;
    }
  }, [getCsrfToken, setUser, setIsAuthenticated, setAuthError]);
  
  // Fonction de déconnexion
  const logout = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/logout/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
        },
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Échec de la déconnexion');
      }
    } catch (error) {
      console.error('Erreur lors de la déconnexion', error);
    } finally {
      // Toujours nettoyer l'état même en cas d'erreur
      setUser(null);
      setIsAuthenticated(false);
    }
  }, [setUser, setIsAuthenticated]);
  
  // Valeur du contexte d'authentification
  const authValue = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    authError,
    login,
    logout,
    getCsrfToken,
  }), [user, isAuthenticated, isLoading, authError, login, logout, getCsrfToken]);
  
  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};