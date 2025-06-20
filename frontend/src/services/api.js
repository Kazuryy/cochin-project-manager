// src/services/api.js

/**
 * Configuration de l'API
 */
const API_BASE_URL = ''; // Utiliser le proxy Vite configuré

/**
 * Vérifie si une réponse contient une erreur d'authentification
 * 
 * @param {Response} response - Réponse HTTP à vérifier
 * @returns {Promise<boolean>} true si c'est une erreur d'authentification
 */
const checkAuthenticationError = async (response) => {
  try {
    // Essayer de lire le corps de la réponse
    const data = await response.json().catch(() => ({}));
    console.log("Vérification d'authentification:", response.status, data);
    
    // Ne pas considérer automatiquement toutes les erreurs 403 comme des erreurs d'authentification
    // Certaines peuvent être des erreurs de permission normales
    if (response.status === 403 && !data?.error?.includes('session')) {
      return false;
    }
    
    // Vérifier les indicateurs spécifiques d'erreur d'authentification
    const isAuthError = 
      (response.status === 401) || // 401 est toujours une erreur d'authentification
      data?.error === 'authentication_required' ||
      data?.error === 'invalid_session' ||
      data?.error === 'not_authenticated' ||
      (data?.detail && typeof data.detail === 'string' && (
        data.detail.toLowerCase().includes('authentication') ||
        data.detail.toLowerCase().includes('login required') ||
        data.detail.toLowerCase().includes('token expired')
      ));
    
    return isAuthError;
  } catch (e) {
    // En cas d'erreur, supposer que ce n'est pas une erreur d'authentification
    console.error('Erreur lors de la vérification d\'authentification:', e);
    return false;
  }
};

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
      return await response.json();
    },
    
    /**
     * Effectue une requête POST avec CSRF token
     * 
     * @param {string} url - URL de la requête
     * @param {Object|FormData} data - Données à envoyer
     * @param {Object} options - Options de la requête
     * @returns {Promise<Object>} Réponse de l'API
     * @throws {Error} Erreur en cas d'échec de la requête
     */
    post: async (url, data, options = {}) => {
      const csrfToken = getCsrfToken();
      const fullUrl = `${API_BASE_URL}${url}`;
      
      console.log(`🔵 [API_POST] Début de la requête POST vers ${fullUrl}`);
      console.log('🔵 [API_POST] Token CSRF:', csrfToken ? 'Disponible' : 'Non disponible');
      
      // Détecter si les données sont FormData pour l'upload de fichiers
      const isFormData = data instanceof FormData;
      
      const fetchOptions = {
        method: 'POST',
        credentials: 'include', // Toujours inclure les cookies pour l'authentification
        ...options,
      };
      
      if (isFormData) {
        // Pour FormData : ne pas définir Content-Type (boundary automatique) et ne pas stringify
        fetchOptions.headers = {
          'X-CSRFToken': csrfToken,
          ...(options.headers || {}),
        };
        fetchOptions.body = data;
        console.log('🔵 [API_POST] Envoi de FormData (fichiers)');
      } else {
        // Pour JSON : comportement normal
        fetchOptions.headers = {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          ...(options.headers || {}),
        };
        fetchOptions.body = JSON.stringify(data);
        console.log('🔵 [API_POST] Données JSON à envoyer:', data);
      }
      
      console.log('🔵 [API_POST] Options de la requête:', {
        method: fetchOptions.method,
        credentials: fetchOptions.credentials,
        headers: fetchOptions.headers
      });
      
      try {
        console.log(`🔵 [API_POST] Envoi de la requête à ${fullUrl}...`);
        const startTime = Date.now();
        
        const response = await fetch(fullUrl, fetchOptions);
        const duration = Date.now() - startTime;
        
        console.log(`🔵 [API_POST] Réponse reçue en ${duration}ms, statut:`, response.status, response.statusText);
        
        // Vérifier si la session est active seulement pour les erreurs 401
        if (response.status === 401) {
          console.warn(`🔴 [API_POST] Problème d'authentification détecté: ${response.status}`);
          
          // Récupérer le contexte d'authentification s'il existe
          try {
            const authContext = getAuthContext ? getAuthContext() : null;
            if (authContext?.handleAuthError) {
              // Laisser le contexte d'authentification gérer l'erreur
              const error = new Error('Session expirée ou non authentifiée');
              error.status = response.status;
              authContext.handleAuthError(error);
            } else {
              // Fallback si pas de contexte d'authentification
              handleSessionExpiration();
            }
          } catch (err) {
            console.error('🔴 [API_POST] Erreur lors de la gestion de l\'authentification:', err);
            handleSessionExpiration();
          }
          
          throw new Error('Session expirée ou non authentifiée');
        } else if (response.status === 403) {
          // Pour les 403, vérifier si c'est une erreur d'authentification ou juste une permission refusée
          console.warn(`🔴 [API_POST] Erreur 403 détectée`);
          
          // Essayer d'extraire les détails de l'erreur
          const errorData = await response.json().catch(() => ({}));
          console.error(`🔴 [API_POST] Détails de l'erreur 403:`, errorData);
          
          const authError = await checkAuthenticationError(response.clone());
          if (authError) {
            console.warn('🔴 [API_POST] Problème de session détecté dans une erreur 403');
            handleSessionExpiration();
            throw new Error('Session expirée ou non authentifiée');
          }
          
          // Sinon c'est une erreur de permission normale
          const error = new Error(errorData.message || 'Droits insuffisants pour effectuer cette action');
          error.status = response.status;
          error.response = { status: response.status, data: errorData };
          throw error;
        }
        
        // Vérifier si la requête a réussi
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`🔴 [API_POST] Erreur API (${response.status}):`, errorData);
          
          // Créer une erreur avec les détails de la réponse
          const errorMessage = errorData.message || errorData.error || errorData.detail || `Erreur HTTP ${response.status}`;
          const error = new Error(errorMessage);
          error.status = response.status;
          error.response = { status: response.status, data: errorData };
          throw error;
        }
        
        // Traiter la réponse
        console.log(`🔵 [API_POST] Analyse de la réponse JSON...`);
        const responseData = await response.json();
        console.log(`🟢 [API_POST] Réponse traitée avec succès:`, responseData);
        
        return responseData;
      } catch (error) {
        // Ne pas propager les erreurs de session qui ont déjà été traitées
        if (error.message === 'Session expirée ou non authentifiée') {
          console.error('🔴 [API_POST] Erreur de session:', error.message);
          throw error;
        }
        
        // Gestion spécifique des erreurs réseau
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          console.error('🔴 [API_POST] Erreur réseau: Impossible de contacter le serveur');
          throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion internet.');
        }
        
        // Propager l'erreur
        console.error('🔴 [API_POST] Erreur lors de la requête:', error);
        throw error;
      }
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
      const fullUrl = `${API_BASE_URL}${url}`;
      
      console.log(`🗑️ API DELETE - URL complète: ${fullUrl}`);
      console.log('🗑️ API DELETE - Token CSRF:', csrfToken ? 'Disponible' : 'Non disponible');
      console.log('🗑️ API DELETE - Options de la requête:', options);
      
      try {
        const response = await fetch(fullUrl, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
            ...(options.headers || {}),
          },
          credentials: 'include',
          ...options,
        });
        
        console.log(`🗑️ API DELETE - Statut de la réponse:`, response.status, response.statusText);
        
        // Gestion des erreurs HTTP
        if (!response.ok) {
          console.error(`🗑️ API DELETE - Erreur HTTP: ${response.status}`);
          
          // Essayer d'extraire les détails de l'erreur
          const errorData = await response.json().catch(() => ({}));
          console.error(`🗑️ API DELETE - Détails de l'erreur:`, errorData);
          
          const error = new Error(errorData.message || errorData.detail || `Erreur HTTP ${response.status}`);
          error.status = response.status;
          error.response = { status: response.status, data: errorData };
          throw error;
        }
        
        // DELETE peut retourner un corps vide
        if (response.status === 204) {
          console.log(`🗑️ API DELETE - Succès sans contenu (204)`);
          return { success: true };
        }
        
        // Essayer de parser la réponse JSON si elle existe
        const result = await response.json().catch(() => {
          console.log(`🗑️ API DELETE - Pas de contenu JSON dans la réponse`);
          return { success: true };
        });
        
        console.log(`🗑️ API DELETE - Succès avec résultat:`, result);
        return result;
      } catch (error) {
        console.error(`🗑️ API DELETE - Erreur:`, error);
        throw error;
      }
    },
  };
  
  // Fonction pour obtenir le contexte d'authentification (sera définie par l'application)
  let getAuthContext = null;

  // Fonction pour définir le contexte d'authentification depuis l'AuthProvider
  export const setAuthContext = (authContextGetter) => {
    getAuthContext = authContextGetter;
  };
  
  export default api;