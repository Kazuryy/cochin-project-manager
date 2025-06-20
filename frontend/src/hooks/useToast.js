import { useState, useCallback, useEffect, useRef } from 'react';

// Constantes pour la configuration
const DEFAULT_DURATION = 3000;
const ANIMATION_DURATION = 300;
const MAX_TOASTS = 5;

/**
 * Hook personnalisé pour gérer les notifications toast
 * @returns {Object} Interface du hook useToast
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  /**
   * Supprime un toast et nettoie son timer associé
   * @param {number} id - Identifiant du toast à supprimer
   */
  const removeToast = useCallback((id) => {
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
    
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  /**
   * Ajoute un nouveau toast
   * @param {string} message - Message à afficher
   * @param {string} type - Type de toast (info, success, error, warning)
   * @param {Object} options - Options additionnelles
   * @returns {number} ID du toast créé
   */
  const addToast = useCallback((message, type = 'info', duration = DEFAULT_DURATION) => {
    const id = Math.random().toString(36).substr(2, 9);

    setToasts(prev => [...prev, { id, message, type, duration }]);
    
    // Configuration du timer de suppression automatique
    if (duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      
      // Stockage de la référence du timer pour nettoyage
      if (timersRef.current) {
      timersRef.current.set(id, timer);
      }
    }

    return id;
  }, [removeToast]);

  // Helpers mémorisés pour les différents types de toasts
  const success = useCallback((message, options = {}) => 
    addToast(message, 'success', options), [addToast]);
  
  const error = useCallback((message, options = {}) => 
    addToast(message, 'error', options), [addToast]);
  
  const warning = useCallback((message, options = {}) => 
    addToast(message, 'warning', options), [addToast]);
  
  const info = useCallback((message, options = {}) => 
    addToast(message, 'info', options), [addToast]);

  // Nettoyage des timers au démontage
  useEffect(() => {
    const currentTimers = timersRef.current;
    return () => {
      currentTimers.forEach(timer => clearTimeout(timer));
      currentTimers.clear();
    };
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  };
}; 