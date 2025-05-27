// src/services/api.js

/**
 * Configuration de l'API
 */
const API_BASE_URL = 'http://localhost:8000';

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
   * Gestion uniformisée des erreurs
   */
  const handleError = async (response) => {
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const error = new Error(`Erreur HTTP ${response.status}`);
      error.status = response.status;
      error.response = {
        status: response.status,
        data: errorData
      };
      throw error;
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
      
      const response = await fetch(`${API_BASE_URL}${url}`, {
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
  
  export default api;