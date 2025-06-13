import React, { useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { COMPARISON_OPERATORS } from '../../hooks/useAdvancedFilters';

// Constantes extraites pour éviter les recalculs
const DEFAULT_OPERATORS = Object.values(COMPARISON_OPERATORS);

const operatorLabels = {
  [COMPARISON_OPERATORS.EQUALS]: 'Égal à',
  [COMPARISON_OPERATORS.NOT_EQUALS]: 'Différent de',
  [COMPARISON_OPERATORS.CONTAINS]: 'Contient',
  [COMPARISON_OPERATORS.NOT_CONTAINS]: 'Ne contient pas',
  [COMPARISON_OPERATORS.STARTS_WITH]: 'Commence par',
  [COMPARISON_OPERATORS.ENDS_WITH]: 'Finit par',
  [COMPARISON_OPERATORS.GREATER_THAN]: 'Supérieur à',
  [COMPARISON_OPERATORS.LESS_THAN]: 'Inférieur à',
  [COMPARISON_OPERATORS.GREATER_EQUAL]: 'Supérieur ou égal à',
  [COMPARISON_OPERATORS.LESS_EQUAL]: 'Inférieur ou égal à'
};

function ComparisonFilter({ 
  value = '', 
  operator = COMPARISON_OPERATORS.CONTAINS,
  onChange, 
  onOperatorChange,
  label = "Filtre de comparaison",
  placeholder = "Valeur à comparer",
  availableOperators = DEFAULT_OPERATORS
}) {
  // Références pour l'accessibilité et la gestion du focus
  const inputRef = useRef(null);
  const operatorId = useMemo(() => `operator-${Math.random().toString(36).substr(2, 9)}`, []);
  const valueId = useMemo(() => `value-${Math.random().toString(36).substr(2, 9)}`, []);

  // Optimisation : mémorisation des handlers d'événements
  const handleValueChange = useCallback((e) => {
    const newValue = e.target.value;
    onChange(newValue);
  }, [onChange]);

  const handleOperatorChange = useCallback((e) => {
    const newOperator = e.target.value;
    onOperatorChange(newOperator);
  }, [onOperatorChange]);

  const clearValue = useCallback(() => {
    onChange('');
    // Amélioration UX : remettre le focus sur l'input après effacement
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onChange]);

  // Optimisation : mémorisation du texte de prévisualisation
  const previewText = useMemo(() => {
    if (!value) return null;
    return `${operatorLabels[operator]} "${value}"`;
  }, [value, operator]);

  // Conversion sécurisée de la valeur pour affichage
  const displayValue = useMemo(() => {
    return value?.toString() || '';
  }, [value]);

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={operatorId} className="label-text font-medium">
          {label}
        </label>
      )}
      
      <div className="space-y-2">
        {/* Sélecteur d'opérateur avec accessibilité améliorée */}
        <select
          id={operatorId}
          className="select select-bordered select-sm w-full"
          value={operator}
          onChange={handleOperatorChange}
          aria-label={label || "Opérateur de comparaison"}
        >
          {availableOperators.map(op => (
            <option key={op} value={op}>
              {operatorLabels[op] || op}
            </option>
          ))}
        </select>
        
        {/* Champ de valeur avec accessibilité améliorée */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id={valueId}
            type="text"
            className="input input-bordered input-sm flex-1"
            value={displayValue}
            onChange={handleValueChange}
            placeholder={placeholder}
            aria-label="Valeur de comparaison"
            aria-describedby={value ? `${valueId}-preview` : undefined}
          />
          
          {value && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={clearValue}
              title="Effacer la valeur"
              aria-label="Effacer la valeur de filtre"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {/* Prévisualisation avec accessibilité */}
      {previewText && (
        <div 
          id={`${valueId}-preview`}
          className="text-xs text-base-content/60"
          role="status"
          aria-live="polite"
        >
          {previewText}
        </div>
      )}
    </div>
  );
}

ComparisonFilter.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  operator: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onOperatorChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  placeholder: PropTypes.string,
  availableOperators: PropTypes.arrayOf(PropTypes.string)
};

// Optimisation : mémorisation du composant pour éviter les re-renders inutiles
export default React.memo(ComparisonFilter); 