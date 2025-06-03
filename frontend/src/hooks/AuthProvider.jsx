// Modification de AuthProvider.jsx - Version sans debug
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { AuthContext} from './authContext';

/**
 * Provider d'authentification à utiliser au niveau de l'application
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // Fonction pour obtenir le token CSRF
  const getCsrfToken = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/csrf/', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Échec de l\'obtention du token CSRF');
      }
      
      const data = await response.json();
      // Vérifiez si le token est présent dans la réponse
      if (data?.csrfToken) {
        // Retourner le token
        return data.csrfToken;
      }
      
      throw new Error('Token CSRF non trouvé dans la réponse');
    } catch (error) {
      console.error('Error getting CSRF token:', error);
      return null;
    }
  }, []);
  
  // Vérification du statut d'authentification au chargement
  useEffect(() => {
    let isMounted = true;
    
    const checkAuthStatus = async () => {
      try {
        if (!isMounted) return;
        
        setIsLoading(true);
        
        const response = await fetch('/api/auth/check/', {
          credentials: 'include',
        });
        
        if (!isMounted) return;
        
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        if (!isMounted) return;
        
        console.error('Auth check error:', error);
        setAuthError('Impossible de vérifier votre statut d\'authentification');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    checkAuthStatus();
    
    // Cleanup function pour éviter les mises à jour sur un composant démonté
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Fonction de connexion
  const login = useCallback(async (credentials) => {
    setAuthError(null);
    
    try {
      // Obtenir un token CSRF avant la connexion
      const csrfToken = await getCsrfToken();
      
      if (!csrfToken) {
        throw new Error('Impossible d\'obtenir un token CSRF');
      }
      
      const response = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
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
      console.error('Login error:', error);
      setAuthError(error.message || 'Une erreur est survenue lors de la connexion');
      throw error;
    }
  }, [getCsrfToken]);
  
  // Fonction de déconnexion
  const logout = useCallback(async () => {
    try {
      const csrfToken = await getCsrfToken();
      
      if (!csrfToken) {
        throw new Error('Impossible d\'obtenir un token CSRF pour la déconnexion');
      }
      
      const response = await fetch('/api/auth/logout/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': csrfToken,
        },
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Échec de la déconnexion');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Toujours nettoyer l'état même en cas d'erreur
      setUser(null);
      setIsAuthenticated(false);
    }
  }, [getCsrfToken]);
  
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