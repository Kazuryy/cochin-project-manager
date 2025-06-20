import { useState, useCallback } from 'react';

// Hook personnalisé pour gérer les toasts
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    const newToast = { id, message, type };
    setToasts(prev => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  // Fonctions raccourcies pour faciliter l'utilisation
  const success = useCallback((message, duration = 4000) => {
    return addToast(message, 'success', duration);
  }, [addToast]);

  const error = useCallback((message, duration = 5000) => {
    return addToast(message, 'error', duration);
  }, [addToast]);

  const warning = useCallback((message, duration = 4000) => {
    return addToast(message, 'warning', duration);
  }, [addToast]);

  const info = useCallback((message, duration = 3000) => {
    return addToast(message, 'info', duration);
  }, [addToast]);

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