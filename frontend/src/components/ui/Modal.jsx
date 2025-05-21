import React, { useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * Composant Modal réutilisable
 * 
 * @param {boolean} isOpen - Si le modal est ouvert
 * @param {function} onClose - Fonction à appeler pour fermer le modal
 * @param {string} title - Titre du modal
 * @param {React.ReactNode} children - Contenu du modal
 * @param {boolean} closeOnClickOutside - Si le modal se ferme en cliquant à l'extérieur
 * @param {boolean} showCloseButton - Si le bouton de fermeture est affiché
 * @param {boolean} preventClosing - Empêche la fermeture du modal (pour les actions obligatoires)
 */
function Modal({
  isOpen,
  onClose,
  title,
  children,
  closeOnClickOutside = true,
  showCloseButton = true,
  preventClosing = false,
  size = 'md',
  className = '',
}) {
  const modalRef = useRef(null);
  
  // Mapping des tailles vers les classes Tailwind
  const sizeClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  };
  
  // Gérer la fermeture du modal lors du clic à l'extérieur
  const handleClickOutside = useCallback((event) => {
    if (
      closeOnClickOutside && 
      !preventClosing &&
      modalRef.current && 
      !modalRef.current.contains(event.target)
    ) {
      onClose();
    }
  }, [closeOnClickOutside, preventClosing, onClose]);
  
  // Gérer la fermeture du modal avec la touche Escape
  const handleEscapeKey = useCallback((event) => {
    if (!preventClosing && event.key === 'Escape') {
      onClose();
    }
  }, [preventClosing, onClose]);
  
  // Ajouter/supprimer les écouteurs d'événements
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      // Sauvegarder le style overflow actuel
      const currentOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
        // Restaurer le style overflow précédent
        document.body.style.overflow = currentOverflow;
      };
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      // S'assurer que overflow est restauré même si le composant est démonté
      document.body.style.overflow = '';
    };
  }, [isOpen, handleClickOutside, handleEscapeKey]);
  
  // Ne rien rendre si le modal est fermé
  if (!isOpen) return null;
  
  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={handleClickOutside}
        role="button"
        tabIndex={0}
        aria-label="Fermer le modal"
        onKeyDown={(e) => e.key === 'Enter' && handleClickOutside(e)}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          ref={modalRef}
          className={`relative bg-white rounded-lg shadow-xl ${sizeClasses[size] || 'max-w-md'} ${className}`}
        >
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              {title && <h3 className="font-bold text-lg">{title}</h3>}
              
              {showCloseButton && !preventClosing && (
                <button 
                  onClick={onClose}
                  className="absolute top-4 right-4 btn btn-sm btn-circle btn-ghost"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              )}
            </div>
            
            <div className="mt-4">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  children: PropTypes.node.isRequired,
  closeOnClickOutside: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  preventClosing: PropTypes.bool,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', 'full']),
  className: PropTypes.string,
};

export default Modal;