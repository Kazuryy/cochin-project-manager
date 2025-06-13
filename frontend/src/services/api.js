// src/services/api.js

/**
 * Configuration de l'API
 */
const API_BASE_URL = ''; // Utiliser le proxy Vite configuré

/**
 * Récupère le token CSRF des cookies
 */
const getCsrfToken = () => {
    return document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1] || '';
  };
  
  /**
   * Gère la redirection vers la page de login en cas d'expiration de session
   */
  const handleSessionExpiration = () => {
    console.warn('🔓 Session expirée, redirection vers la page de login...');
    
    // Éviter les redirections multiples
    if (window.location.pathname === '/login') {
      return;
    }
    
    // Créer une notification toast personnalisée
    const createSessionExpiredToast = () => {
      // Supprimer toute notification existante
      const existingToast = document.getElementById('session-expired-toast');
      if (existingToast) {
        existingToast.remove();
      }
      
      const toast = document.createElement('div');
      toast.id = 'session-expired-toast';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f87171;
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
      
      // Ajouter l'animation CSS
      if (!document.getElementById('toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }
      
      toast.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-weight: 600; margin-bottom: 4px;">Session expirée</div>
            <div style="font-size: 13px; opacity: 0.9;">
              Redirection vers la page de connexion dans <span id="countdown">5</span> secondes...
            </div>
          </div>
          <button id="redirect-now" style="
            background: white;
            color: #f87171;
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
    
    const _toast = createSessionExpiredToast();
    
    // Gérer la redirection immédiate
    const redirectButton = document.getElementById('redirect-now');
    const performRedirect = () => {
      // Vider le localStorage/sessionStorage
      localStorage.removeItem('user');
      sessionStorage.clear();
      
      // Redirection vers la page de login
      window.location.href = '/login';
    };
    
    redirectButton.addEventListener('click', performRedirect);
    
    // Compte à rebours automatique
    let countdown = 5;
    const countdownElement = document.getElementById('countdown');
    
    const timer = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = countdown;
      }
      
      if (countdown <= 0) {
        clearInterval(timer);
        performRedirect();
      }
    }, 1000);
  };
  
  /**
   * Gestion uniformisée des erreurs avec détection d'expiration de session
   */
  const handleError = async (response) => {
    if (!response.ok) {
      // Gérer spécifiquement les erreurs d'authentification
      if (response.status === 401 || response.status === 403) {
        try {
          const errorData = await response.json().catch(() => null);
          
          // Vérifier si c'est une erreur d'authentification/session
          const isAuthError = 
            response.status === 401 ||
            errorData?.detail?.toLowerCase().includes('authentication') ||
            errorData?.detail?.toLowerCase().includes('permission') ||
            errorData?.detail?.toLowerCase().includes('credentials') ||
            errorData?.detail?.toLowerCase().includes('login required') ||
            errorData?.detail?.toLowerCase().includes('unauthorized');
          
          if (isAuthError) {
            handleSessionExpiration();
            // Créer une erreur spéciale pour l'expiration de session
            const error = new Error('Session expirée');
            error.status = response.status;
            error.isSessionExpired = true;
            throw error;
          }
        } catch (e) {
          // Si on ne peut pas parser la réponse, considérer comme expiration de session
          if (e.isSessionExpired) {
            throw e;
          }
          handleSessionExpiration();
          const error = new Error('Session expirée');
          error.status = response.status;
          error.isSessionExpired = true;
          throw error;
        }
      }
      
      const errorData = await response.json().catch(() => null);
      const error = new Error(`Erreur HTTP ${response.status}`);
      error.status = response.status;
      error.response = {
        status: response.status,
        data: errorData
      };
      throw error;
    }
    
    // Si la requête est réussie, signaler l'activité utilisateur
    if (getAuthContext) {
      try {
        const authContext = getAuthContext();
        if (authContext?.initializeSession) {
          authContext.initializeSession();
        }
      } catch (error) {
        // Ignorer les erreurs du contexte d'authentification
        console.debug('Impossible de renouveler la session:', error.message);
      }
    }
    
    return response;
  };
  
  /**
   * Client API centralisé qui gère automatiquement les tokens CSRF
   */
  const api = {
    /**
     * Effectue une requête GET
     */
    get: async (url, options = {}) => {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: 'GET',
        credentials: 'include',
        ...options,
      });
      
      await handleError(response);
      return response.json();
    },
    
    /**
     * Effectue une requête POST avec CSRF token
     */
    post: async (url, data, options = {}) => {
      const csrfToken = getCsrfToken();
      
      // Détecter si les données sont FormData pour l'upload de fichiers
      const isFormData = data instanceof FormData;
      
      const fetchOptions = {
        method: 'POST',
        credentials: 'include',
        ...options,
      };
      
      if (isFormData) {
        // Pour FormData : ne pas définir Content-Type (boundary automatique) et ne pas stringify
        fetchOptions.headers = {
          'X-CSRFToken': csrfToken,
          ...(options.headers || {}),
        };
        fetchOptions.body = data;
      } else {
        // Pour JSON : comportement normal
        fetchOptions.headers = {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          ...(options.headers || {}),
        };
        fetchOptions.body = JSON.stringify(data);
      }
      
      const response = await fetch(`${API_BASE_URL}${url}`, fetchOptions);
      
      await handleError(response);
      return response.json();
    },
    
    /**
     * Effectue une requête PUT avec CSRF token
     */
    put: async (url, data, options = {}) => {
      const csrfToken = getCsrfToken();
      
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          ...(options.headers || {}),
        },
        credentials: 'include',
        body: JSON.stringify(data),
        ...options,
      });
      
      await handleError(response);
      return response.json();
    },
    
    /**
     * Effectue une requête PATCH avec CSRF token
     */
    patch: async (url, data, options = {}) => {
      const csrfToken = getCsrfToken();
      
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          ...(options.headers || {}),
        },
        credentials: 'include',
        body: JSON.stringify(data),
        ...options,
      });
      
      await handleError(response);
      return response.json();
    },
    
    /**
     * Effectue une requête DELETE avec CSRF token
     */
    delete: async (url, options = {}) => {
      const csrfToken = getCsrfToken();
      
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          ...(options.headers || {}),
        },
        credentials: 'include',
        ...options,
      });
      
      await handleError(response);
      
      // DELETE peut retourner un corps vide
      if (response.status === 204) {
        return null;
      }
      
      return response.json().catch(() => null);
    },
  };
  
  // Fonction pour obtenir le contexte d'authentification (sera définie par l'application)
  let getAuthContext = null;

  // Fonction pour définir le contexte d'authentification depuis l'AuthProvider
  export const setAuthContext = (authContextGetter) => {
    getAuthContext = authContextGetter;
  };
  
  export default api;