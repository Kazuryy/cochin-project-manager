// Modification de AuthProvider.jsx - Version optimisée sans clignotement
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { AuthContext } from './authContext';
import { setAuthContext } from '../services/api';

// Types d'erreur personnalisés
class AuthError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

// Constante pour l'environnement de développement
const IS_DEV = import.meta.env.DEV;

/**
 * Provider d'authentification à utiliser au niveau de l'application
 * @param {Object} props - Les propriétés du composant
 * @param {React.ReactNode} props.children - Les enfants du composant
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Gestion de la session utilisateur
  const sessionStartRef = useRef(null);
  const sessionCheckIntervalRef = useRef(null);
  const sessionWarningTimeoutRef = useRef(null);
  
  // Configuration basée sur la session backend
  const SESSION_DURATION = 60 * 60 * 1000; // 1 heure (même que backend)
  const SESSION_CHECK_INTERVAL = 2 * 60 * 1000; // Vérifier la session toutes les 2 minutes
  const WARNING_BEFORE_EXPIRY = 5 * 60 * 1000; // Prévenir 5 minutes avant expiration
  
  // Fonction pour obtenir le token CSRF
  const getCsrfToken = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/csrf/', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new AuthError('Échec de l\'obtention du token CSRF', 'CSRF_ERROR');
      }
      
      const data = await response.json();
      if (!data?.csrfToken) {
        throw new AuthError('Token CSRF non trouvé dans la réponse', 'CSRF_MISSING');
      }
      
      return data.csrfToken;
    } catch (error) {
      if (IS_DEV) {
        console.error('Error getting CSRF token:', error);
      }
      throw error;
    }
  }, []);
  
  // Fonction pour gérer l'expiration de session
  const handleSessionExpiration = useCallback(async () => {
    if (IS_DEV) {
      console.warn('🕒 Session sur le point d\'expirer...');
    }
    
    // Créer une notification d'expiration de session
    const createSessionExpiryToast = () => {
      // Supprimer toute notification existante
      const existingToast = document.getElementById('session-expiry-toast');
      if (existingToast) {
        existingToast.remove();
      }
      
      const toast = document.createElement('div');
      toast.id = 'session-expiry-toast';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f59e0b;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
      `;
      
      toast.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-weight: 600; margin-bottom: 4px;">⏰ Session expirée</div>
            <div style="font-size: 13px; opacity: 0.9;">
              Redirection vers la page de connexion dans <span id="session-countdown">10</span> secondes...
            </div>
          </div>
          <button id="redirect-now-session" style="
            background: white;
            color: #f59e0b;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            margin-left: 12px;
          ">
            Rediriger maintenant
          </button>
        </div>
      `;
      
      document.body.appendChild(toast);
      return toast;
    };
    
    const _toast = createSessionExpiryToast();
    let countdown = 10;
    const countdownElement = document.getElementById('session-countdown');
    const redirectButton = document.getElementById('redirect-now-session');
    
    // Gérer la redirection immédiate
    const handleRedirect = () => {
      _toast.remove();
      clearInterval(timer);
      
      // Forcer la déconnexion
      setUser(null);
      setIsAuthenticated(false);
      
      // Redirection vers login
      window.location.href = '/login';
    };
    
    redirectButton.addEventListener('click', handleRedirect);
    
    // Compte à rebours
    const timer = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = countdown;
      }
      
      if (countdown <= 0) {
        handleRedirect();
      }
    }, 1000);
  }, []);
  
  // Fonction pour enregistrer le début de session
  const initializeSession = useCallback(() => {
    sessionStartRef.current = Date.now();
    
    // Annuler l'avertissement précédent s'il existe
    if (sessionWarningTimeoutRef.current) {
      clearTimeout(sessionWarningTimeoutRef.current);
      sessionWarningTimeoutRef.current = null;
    }
    
    // Programmer l'avertissement d'expiration de session
    sessionWarningTimeoutRef.current = setTimeout(() => {
      handleSessionExpiration();
    }, SESSION_DURATION - WARNING_BEFORE_EXPIRY);
  }, [handleSessionExpiration, SESSION_DURATION, WARNING_BEFORE_EXPIRY]);
  
  // Fonction pour vérifier l'authentification côté serveur
  const checkAuthenticationStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/check/', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.isAuthenticated) {
          setUser(data.user);
          setIsAuthenticated(true);
          setAuthError(null);
          return true;
        }
      }
      
      // Session expirée ou invalide
      setUser(null);
      setIsAuthenticated(false);
      return false;
      
    } catch (error) {
      console.error('Erreur lors de la vérification de session:', error);
      setUser(null);
      setIsAuthenticated(false);
      return false;
    }
  }, []);
  
  // Vérification périodique de la session
  useEffect(() => {
    if (!isAuthenticated) {
      // Nettoyer les timers si pas authentifié
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
      if (sessionWarningTimeoutRef.current) {
        clearTimeout(sessionWarningTimeoutRef.current);
        sessionWarningTimeoutRef.current = null;
      }
      return;
    }
    
    const checkSession = async () => {
      try {
        const isValid = await checkAuthenticationStatus();
        if (!isValid && IS_DEV) {
          console.warn('🔓 Session expirée détectée lors de la vérification périodique');
        }
      } catch (error) {
        if (IS_DEV) {
          console.error('Erreur lors de la vérification de session:', error);
        }
      }
    };
    
    // Vérification périodique de la session
    sessionCheckIntervalRef.current = setInterval(checkSession, SESSION_CHECK_INTERVAL);
    
    // Cleanup
    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, checkAuthenticationStatus, SESSION_CHECK_INTERVAL]);
  
  // Vérification du statut d'authentification au chargement
  useEffect(() => {
    let isMounted = true;
    let hasChecked = false; // Éviter les vérifications multiples en développement
    
    const checkAuthStatus = async () => {
      if (hasChecked) return; // Protection contre les appels multiples
      hasChecked = true;
      try {
        if (!isMounted) return;
        
        // Ne montrer le loading que si c'est la première fois
        if (!hasInitialized) {
          setIsLoading(true);
        }
        
        // D'abord récupérer le token CSRF pour définir le cookie
        try {
          await fetch('/api/auth/csrf/', {
            credentials: 'include',
          });
        } catch (csrfError) {
          console.warn('Failed to get CSRF token:', csrfError);
        }
        
        const response = await fetch('/api/auth/check/', {
          credentials: 'include',
        });
        
        if (!isMounted) return;
        
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setIsAuthenticated(true);
          initializeSession(); // Initialiser l'activité
        } else {
          // 401 est normal quand l'utilisateur n'est pas connecté, ne pas logger comme erreur
          if (response.status !== 401) {
            console.warn('Auth check unexpected status:', response.status);
          }
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
          setHasInitialized(true);
        }
      }
    };
    
    checkAuthStatus();
    
    // Cleanup function pour éviter les mises à jour sur un composant démonté
    return () => {
      isMounted = false;
    };
  }, [hasInitialized, initializeSession]);
  
  // Fonction de connexion
  const login = useCallback(async (credentials) => {
    setAuthError(null);
    
    try {
      // Récupérer le token CSRF depuis les cookies (comme api.js)
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1] || '';
      
      if (!csrfToken) {
        throw new AuthError('Impossible d\'obtenir un token CSRF', 'CSRF_ERROR');
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
        throw new AuthError(data.message || 'Échec de la connexion', 'LOGIN_ERROR');
      }
      
      setUser(data.user);
      setIsAuthenticated(true);
      initializeSession();
      return data;
    } catch (error) {
      if (IS_DEV) {
        console.error('Login error:', error);
      }
      setAuthError(error.message || 'Une erreur est survenue lors de la connexion');
      throw error;
    }
  }, [initializeSession]);
  
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
      
      // Nettoyer les timers
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
      if (sessionWarningTimeoutRef.current) {
        clearTimeout(sessionWarningTimeoutRef.current);
        sessionWarningTimeoutRef.current = null;
      }
    }
  }, [getCsrfToken]);
  
  // Cleanup au démontage du composant
  useEffect(() => {
    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      if (sessionWarningTimeoutRef.current) {
        clearTimeout(sessionWarningTimeoutRef.current);
      }
    };
  }, []);
  
  // Valeur du contexte d'authentification
  const authValue = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    authError,
    login,
    logout,
    getCsrfToken,
    initializeSession,
    handleAuthError: (error) => {
      // Vérifier si c'est une erreur d'authentification
      if (error?.status === 401 || 
          (error?.response?.status === 401) ||
          error?.message?.includes('Session expirée')) {
        console.warn('🔓 Erreur d\'authentification détectée:', error.message);
        
        // Si l'utilisateur est authentifié, forcer une vérification
        if (isAuthenticated) {
          checkAuthenticationStatus();
        }
        return true;
      }
      return false;
    }
  }), [user, isAuthenticated, isLoading, authError, login, logout, getCsrfToken, initializeSession, checkAuthenticationStatus]);
  
  // Configurer le service API avec le contexte d'authentification
  useEffect(() => {
    setAuthContext(() => authValue);
  }, [authValue]);
  
  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};