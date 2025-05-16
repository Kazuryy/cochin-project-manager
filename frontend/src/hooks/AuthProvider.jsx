// Modification de AuthProvider.jsx - Version complète avec logs
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
      console.log('Getting CSRF token...');
      const response = await fetch('/api/auth/csrf/', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        console.error('Failed to get CSRF token, status:', response.status);
        throw new Error('Échec de l\'obtention du token CSRF');
      }
      
      const data = await response.json();
      // Vérifiez si le token est présent dans la réponse
      if (data?.csrfToken) {
        console.log('CSRF token obtained successfully');
        // Retourner le token
        return data.csrfToken;
      }
      
      console.error('CSRF token not found in response');
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
        
        console.log('Checking auth status...');
        setIsLoading(true);
        
        const response = await fetch('/api/auth/check/', {
          credentials: 'include',
        });
        
        if (!isMounted) return;
        
        if (response.ok) {
          const data = await response.json();
          console.log('Auth check success:', data);
          setUser(data.user);
          setIsAuthenticated(true);
        } else {
          console.log('Auth check failed, status:', response.status);
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
          console.log('Auth check completed, isLoading set to false');
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
    console.log('Login attempt with:', { username: credentials.username });
    setAuthError(null);
    
    try {
      // Obtenir un token CSRF avant la connexion
      const csrfToken = await getCsrfToken();
      
      if (!csrfToken) {
        console.error('Failed to get CSRF token for login');
        throw new Error('Impossible d\'obtenir un token CSRF');
      }
      
      console.log('Sending login request...');
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
        console.error('Login failed:', data);
        throw new Error(data.message || 'Échec de la connexion');
      }
      
      console.log('Login successful:', data);
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
    console.log('Logout attempt...');
    try {
      const csrfToken = await getCsrfToken();
      
      if (!csrfToken) {
        console.error('Failed to get CSRF token for logout');
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
        console.error('Logout failed:', data);
        throw new Error(data.message || 'Échec de la déconnexion');
      }
      
      console.log('Logout successful');
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