// src/services/api.js

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
   * Client API centralisé qui gère automatiquement les tokens CSRF
   */
  const api = {
    /**
     * Effectue une requête GET
     */
    get: async (url, options = {}) => {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        ...options,
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      
      return response.json();
    },
    
    /**
     * Effectue une requête POST avec CSRF token
     */
    post: async (url, data, options = {}) => {
      const csrfToken = getCsrfToken();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          ...(options.headers || {}),
        },
        credentials: 'include',
        body: JSON.stringify(data),
        ...options,
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      
      return response.json();
    },
    
    /**
     * Effectue une requête PUT avec CSRF token
     */
    put: async (url, data, options = {}) => {
      const csrfToken = getCsrfToken();
      
      const response = await fetch(url, {
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
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      
      return response.json();
    },
    
    /**
     * Effectue une requête PATCH avec CSRF token
     */
    patch: async (url, data, options = {}) => {
      const csrfToken = getCsrfToken();
      
      const response = await fetch(url, {
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
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      
      return response.json();
    },
    
    /**
     * Effectue une requête DELETE avec CSRF token
     */
    delete: async (url, options = {}) => {
      const csrfToken = getCsrfToken();
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
          ...(options.headers || {}),
        },
        credentials: 'include',
        ...options,
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      
      // DELETE peut retourner un corps vide
      if (response.status === 204) {
        return null;
      }
      
      return response.json().catch(() => null);
    },
  };
  
  export default api;