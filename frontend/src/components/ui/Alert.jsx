import React from 'react';
import PropTypes from 'prop-types';
/**
 * Composant Alert réutilisable
 * 
 * @param {string} type - 'error', 'success', 'warning', 'info'
 * @param {string} message - Message à afficher
 * @param {boolean} dismissible - Si l'alerte peut être fermée
 * @param {function} onDismiss - Fonction à appeler lors de la fermeture
 */
function Alert({
  type = 'info',
  message,
  dismissible = false,
  onDismiss,
  className = '',
  ...props
}) {
  if (!message) return null;

  // Mapping des types d'alerte vers les classes DaisyUI
  const alertTypes = {
    error: 'alert-error',
    success: 'alert-success',
    warning: 'alert-warning',
    info: 'alert-info',
  };

  // Mapping des types d'alerte vers les icônes SVG
  const alertIcons = {
    error: (
      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    success: (
      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
    ),
  };

  return (
    <div className={`alert ${alertTypes[type] || 'alert-info'} ${className}`} {...props}>
      {alertIcons[type]}
      <span>{message}</span>
      
      {dismissible && onDismiss && (
        <button 
          onClick={onDismiss} 
          className="btn btn-sm btn-circle btn-ghost"
          aria-label="Fermer l'alerte"
        >
          ✕
        </button>
      )}
    </div>
  );
}

Alert.propTypes = {
  type: PropTypes.string,
  message: PropTypes.string,
  dismissible: PropTypes.bool,
  onDismiss: PropTypes.func,
  className: PropTypes.string,
};

export default Alert;