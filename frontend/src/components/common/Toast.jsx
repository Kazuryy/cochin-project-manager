import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { FiX, FiCheckCircle, FiAlertCircle, FiInfo, FiAlertTriangle } from 'react-icons/fi';

// Hook personnalisé pour gérer les toasts
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

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
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return {
    toasts,
    addToast,
    removeToast
  };
};

const Toast = ({ message, type = 'info', duration = 3000, onClose, autoClose = true }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const timerRef = useRef(null);

  // Mémorisation du handler de fermeture pour éviter les re-renders
  const handleClose = useCallback(() => {
    setIsAnimatingOut(true);
    // Animation de sortie avant fermeture définitive
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  }, [onClose]);

  // Gestion de la fermeture automatique optimisée
  useEffect(() => {
    if (autoClose && duration > 0) {
      timerRef.current = setTimeout(handleClose, duration);
      
      // Nettoyage du timer pour éviter les memory leaks
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [duration, autoClose, handleClose]);

  // Mémorisation des icônes pour éviter les re-calculs
  const icon = useMemo(() => {
    const iconProps = { className: "text-lg" };
    switch (type) {
      case 'success':
        return <FiCheckCircle {...iconProps} />;
      case 'error':
        return <FiAlertCircle {...iconProps} />;
      case 'warning':
        return <FiAlertTriangle {...iconProps} />;
      default:
        return <FiInfo {...iconProps} />;
    }
  }, [type]);

  // Mémorisation de la classe CSS pour optimiser les re-renders
  const alertClass = useMemo(() => {
    const baseClasses = 'alert fixed top-4 right-4 z-50 w-auto max-w-md shadow-lg transition-all duration-300';
    let typeClass = '';
    
    switch (type) {
      case 'success':
        typeClass = 'alert-success';
        break;
      case 'error':
        typeClass = 'alert-error';
        break;
      case 'warning':
        typeClass = 'alert-warning';
        break;
      default:
        typeClass = 'alert-info';
    }

    // Animation optimisée : utilisation d'états séparés pour un meilleur contrôle
    const animationClass = isAnimatingOut 
      ? 'opacity-0 translate-x-full' 
      : 'opacity-100 translate-x-0';

    return `${baseClasses} ${typeClass} ${animationClass}`;
  }, [type, isAnimatingOut]);

  // Ne pas rendre si le composant est devenu invisible
  if (!isVisible) {
    return null;
  }

  return (
    <div className={alertClass}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {icon}
          <span>{message}</span>
        </div>
        <button
          onClick={handleClose}
          className="btn btn-ghost btn-sm btn-circle ml-3"
          aria-label="Fermer la notification"
        >
          <FiX />
        </button>
      </div>
    </div>
  );
};

// Validation des PropTypes
Toast.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['info', 'success', 'error', 'warning']),
  duration: PropTypes.number,
  onClose: PropTypes.func,
  autoClose: PropTypes.bool
};

// Composant conteneur optimisé pour afficher tous les toasts
export const ToastContainer = ({ toasts, onRemoveToast }) => {
  // Optimisation : éviter le re-render si pas de toasts
  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={0} // Désactiver la fermeture auto dans le composant
          autoClose={false} // Le hook gère déjà la fermeture automatique
          onClose={() => onRemoveToast(toast.id)}
        />
      ))}
    </div>
  );
};

// Validation des PropTypes pour ToastContainer
ToastContainer.propTypes = {
  toasts: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    message: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['info', 'success', 'error', 'warning']),
    duration: PropTypes.number,
    autoClose: PropTypes.bool
  })).isRequired,
  onRemoveToast: PropTypes.func.isRequired
};

export default Toast; 