import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * Composant de filtre booléen avec trois états : null (tous), true, false
 * Utilise un groupe de boutons pour permettre à l'utilisateur de sélectionner une valeur
 */
function BooleanFilter({ 
  value, 
  onChange, 
  label = "Filtre booléen",
  trueLabel = "Oui",
  falseLabel = "Non",
  nullLabel = "Tous"
}) {
  // Optimisation : mémorisation des handlers pour éviter les re-renders inutiles
  const handleNullClick = useCallback(() => onChange(null), [onChange]);
  const handleTrueClick = useCallback(() => onChange(true), [onChange]);
  const handleFalseClick = useCallback(() => onChange(false), [onChange]);

  // Optimisation : mémorisation de la fonction de calcul des classes CSS
  const getButtonClass = useCallback((buttonValue) => {
    const baseClass = "btn btn-sm flex-1";
    return value === buttonValue 
      ? `${baseClass} btn-primary` 
      : `${baseClass} btn-outline`;
  }, [value]);

  // Mémorisation des classes pour chaque bouton
  const buttonClasses = useMemo(() => ({
    null: getButtonClass(null),
    true: getButtonClass(true),
    false: getButtonClass(false)
  }), [getButtonClass]);

  return (
    <fieldset className="space-y-2">
      {/* Utilisation de legend pour une meilleure sémantique */}
      {label && (
        <legend className="label-text font-medium text-sm">
          {label}
        </legend>
      )}
      
      {/* Groupe de boutons avec attributs ARIA pour l'accessibilité */}
      <div 
        className="flex gap-1" 
        role="radiogroup" 
        aria-label={label || "Filtre booléen"}
      >
        <button
          type="button"
          className={buttonClasses.null}
          onClick={handleNullClick}
          aria-pressed={value === null}
          aria-describedby={value !== null ? undefined : "filter-description"}
        >
          {nullLabel}
        </button>
        
        <button
          type="button"
          className={buttonClasses.true}
          onClick={handleTrueClick}
          aria-pressed={value === true}
          aria-describedby={value === true ? "filter-description" : undefined}
        >
          {trueLabel}
        </button>
        
        <button
          type="button"
          className={buttonClasses.false}
          onClick={handleFalseClick}
          aria-pressed={value === false}
          aria-describedby={value === false ? "filter-description" : undefined}
        >
          {falseLabel}
        </button>
      </div>
      
      {/* Indicateur de l'état actuel du filtre */}
      {value !== null && (
        <div 
          id="filter-description"
          className="text-xs text-base-content/60"
          role="status"
          aria-live="polite"
        >
          Filtre actif : {value ? trueLabel : falseLabel}
        </div>
      )}
    </fieldset>
  );
}

// PropTypes corrigés pour accepter null
BooleanFilter.propTypes = {
  value: PropTypes.oneOf([true, false, null]), // Correction : accepte null
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  trueLabel: PropTypes.string,
  falseLabel: PropTypes.string,
  nullLabel: PropTypes.string
};

export default BooleanFilter; 