import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

function NumberRangeFilter({ 
  value = { min: '', max: '' }, 
  onChange, 
  label = "Plage numérique",
  placeholder = { min: "Minimum", max: "Maximum" },
  step = "any",
  currency = false
}) {
  // Validation et conversion sécurisée des nombres
  const parseNumber = useCallback((inputValue) => {
    if (inputValue === '' || inputValue === null || inputValue === undefined) {
      return undefined;
    }
    const parsed = Number(inputValue);
    return isNaN(parsed) ? undefined : parsed;
  }, []);

  // Validation que min <= max
  const validateRange = useCallback((newMin, newMax) => {
    if (newMin !== undefined && newMax !== undefined && newMin > newMax) {
      return { min: newMin, max: newMin }; // Ajuste max à min si min > max
    }
    return { min: newMin, max: newMax };
  }, []);

  // Gestion optimisée du changement de valeur minimum
  const handleMinChange = useCallback((e) => {
    const newValue = e.target.value;
    const parsedMin = parseNumber(newValue);
    const validatedRange = validateRange(parsedMin, value.max);
    
    onChange({
      ...value,
      ...validatedRange
    });
  }, [value, onChange, parseNumber, validateRange]);

  // Gestion optimisée du changement de valeur maximum
  const handleMaxChange = useCallback((e) => {
    const newValue = e.target.value;
    const parsedMax = parseNumber(newValue);
    const validatedRange = validateRange(value.min, parsedMax);
    
    onChange({
      ...value,
      ...validatedRange
    });
  }, [value, onChange, parseNumber, validateRange]);

  // Fonction de nettoyage mémorisée
  const clearRange = useCallback(() => {
    onChange({ min: undefined, max: undefined });
  }, [onChange]);

  // Formatage sécurisé des valeurs avec gestion d'erreur
  const formatValue = useCallback((val) => {
    if (val === undefined || val === null || isNaN(val)) return '';
    
    try {
      const formatted = val.toLocaleString('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
      return currency ? `${formatted} €` : formatted;
    } catch {
      // Fallback en cas d'erreur de formatage
      return currency ? `${val} €` : String(val);
    }
  }, [currency]);

  // Vérification mémorisée de la présence de valeurs
  const hasValues = useMemo(() => {
    return value.min !== undefined || value.max !== undefined;
  }, [value.min, value.max]);

  // Génération du texte de résumé mémorisé
  const summaryText = useMemo(() => {
    if (!hasValues) return '';
    
    if (value.min !== undefined && value.max !== undefined) {
      return `Entre ${formatValue(value.min)} et ${formatValue(value.max)}`;
    } else if (value.min !== undefined) {
      return `À partir de ${formatValue(value.min)}`;
    } else {
      return `Jusqu'à ${formatValue(value.max)}`;
    }
  }, [value.min, value.max, hasValues, formatValue]);

  // Génération d'IDs uniques pour l'accessibilité
  const minInputId = useMemo(() => `number-range-min-${Math.random().toString(36).substr(2, 9)}`, []);
  const maxInputId = useMemo(() => `number-range-max-${Math.random().toString(36).substr(2, 9)}`, []);

  return (
    <div className="space-y-2">
      {label && (
        <div className="label-text font-medium" role="group" aria-label={label}>
          {label}
        </div>
      )}
      
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <input
            id={minInputId}
            type="number"
            className="input input-bordered input-sm w-full"
            value={value.min !== undefined ? value.min : ''}
            onChange={handleMinChange}
            placeholder={placeholder.min}
            step={step}
            aria-label={`${label} - ${placeholder.min}`}
            aria-describedby={hasValues ? `${minInputId}-summary` : undefined}
          />
        </div>
        
        <span className="text-sm text-base-content/50" aria-hidden="true">à</span>
        
        <div className="flex-1">
          <input
            id={maxInputId}
            type="number"
            className="input input-bordered input-sm w-full"
            value={value.max !== undefined ? value.max : ''}
            onChange={handleMaxChange}
            placeholder={placeholder.max}
            step={step}
            min={value.min !== undefined ? value.min : undefined}
            aria-label={`${label} - ${placeholder.max}`}
            aria-describedby={hasValues ? `${maxInputId}-summary` : undefined}
          />
        </div>
        
        {hasValues && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={clearRange}
            title="Effacer la plage"
            aria-label="Effacer la plage de valeurs"
          >
            ×
          </button>
        )}
      </div>
      
      {hasValues && (
        <div 
          id={`${minInputId}-summary`}
          className="text-xs text-base-content/60"
          role="status"
          aria-live="polite"
        >
          {summaryText}
        </div>
      )}
    </div>
  );
}

NumberRangeFilter.propTypes = {
  value: PropTypes.shape({
    min: PropTypes.number,
    max: PropTypes.number
  }),
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  placeholder: PropTypes.shape({
    min: PropTypes.string,
    max: PropTypes.string
  }),
  step: PropTypes.string,
  currency: PropTypes.bool
};

export default NumberRangeFilter; 