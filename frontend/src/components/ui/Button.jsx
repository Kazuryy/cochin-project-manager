import React from 'react';
import PropTypes from 'prop-types';

/**
 * Composant Button réutilisable avec gestion des états
 * 
 * @param {string} variant - 'primary', 'secondary', 'accent', 'ghost', etc.
 * @param {boolean} isLoading - Si le bouton est en état de chargement
 * @param {boolean} isDisabled - Si le bouton est désactivé
 * @param {string} size - 'xs', 'sm', 'md', 'lg' - taille du bouton
 * @param {string} className - Classes CSS supplémentaires
 * @param {function} onClick - Fonction de clic
 * @param {React.ReactNode} children - Contenu du bouton
 */
function Button({ 
  variant = 'primary', 
  isLoading = false, 
  isDisabled = false, 
  size = 'md', 
  className = '', 
  onClick, 
  children,
  type = 'button', 
  ...props 
}) {
  // Construire la classe du bouton avec DaisyUI
  const buttonClass = `
    btn 
    btn-${variant} 
    btn-${size}
    ${isLoading ? 'loading' : ''} 
    ${className}
  `.trim();

  return (
    <button
      type={type}
      className={buttonClass}
      disabled={isDisabled || isLoading}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}

Button.propTypes = {
  variant: PropTypes.string,
  isLoading: PropTypes.bool,
  isDisabled: PropTypes.bool,
  size: PropTypes.string,
  className: PropTypes.string, 
  onClick: PropTypes.func,
  children: PropTypes.node,
  type: PropTypes.string
};


export default Button;