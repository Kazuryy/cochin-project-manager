import React from 'react';
import PropTypes from 'prop-types';
/**
 * Composant Card réutilisable
 * 
 * @param {string} title - Titre de la carte
 * @param {string} subtitle - Sous-titre de la carte (optionnel)
 * @param {React.ReactNode} children - Contenu de la carte
 * @param {string} className - Classes CSS supplémentaires
 * @param {string} width - Largeur de la carte ('xs', 'sm', 'md', 'lg', 'xl', 'full')
 * @param {boolean} withShadow - Ajouter une ombre à la carte
 */
function Card({
  title,
  subtitle,
  children,
  className = '',
  width = 'md',
  withShadow = true,
  ...props
}) {
  // Mapping des largeurs vers les classes Tailwind
  const widthClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'w-full',
  };

  return (
    <div 
      className={`
        card 
        ${widthClasses[width] || 'max-w-md'} 
        bg-base-100 
        ${withShadow ? 'shadow-xl' : ''}
        ${className}
      `}
      {...props}
    >
      <div className="card-body">
        {title && <h2 className="card-title text-2xl font-bold">{title}</h2>}
        {subtitle && <p className="text-base-content/70 mb-6">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

Card.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
  width: PropTypes.string,
  withShadow: PropTypes.bool
};

export default Card;