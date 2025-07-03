import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { FiX, FiCheckCircle, FiAlertCircle, FiInfo, FiAlertTriangle } from 'react-icons/fi';



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
    const baseIconProps = { className: "w-5 h-5" };
    switch (type) {
      case 'success':
        return <FiCheckCircle {...baseIconProps} className="w-5 h-5 text-green-600" />;
      case 'error':
        return <FiAlertCircle {...baseIconProps} className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <FiAlertTriangle {...baseIconProps} className="w-5 h-5 text-amber-600" />;
      default:
        return <FiInfo {...baseIconProps} className="w-5 h-5 text-blue-600" />;
    }
  }, [type]);

  // Mémorisation de la classe CSS pour optimiser les re-renders
  const alertClass = useMemo(() => {
    const baseClasses = 'fixed top-4 right-4 z-50 w-auto max-w-md shadow-lg transition-all duration-300 rounded-lg border min-w-64';
    let typeClass = '';
    
    switch (type) {
      case 'success':
        typeClass = 'bg-green-50 text-green-800 border-green-200';
        break;
      case 'error':
        typeClass = 'bg-red-50 text-red-800 border-red-200';
        break;
      case 'warning':
        typeClass = 'bg-amber-50 text-amber-800 border-amber-200';
        break;
      default:
        typeClass = 'bg-blue-50 text-blue-800 border-blue-200';
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
      <div className="flex items-start justify-between p-4">
        <div className="flex items-center space-x-3 flex-1">
          <div className="flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium whitespace-pre-line leading-relaxed">
              {message}
            </div>
          </div>
        </div>
        <button
          onClick={handleClose}
          className={`flex-shrink-0 ml-3 rounded-md p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            type === 'success' ? 'hover:bg-green-200 focus:ring-green-400' :
            type === 'error' ? 'hover:bg-red-200 focus:ring-red-400' :
            type === 'warning' ? 'hover:bg-amber-200 focus:ring-amber-400' :
            'hover:bg-blue-200 focus:ring-blue-400'
          }`}
          aria-label="Fermer la notification"
        >
          <FiX className="w-4 h-4" />
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