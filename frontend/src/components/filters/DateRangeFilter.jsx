import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

// Constantes pour éviter les recréations d'objets
const DEFAULT_VALUE = { start: '', end: '' };
const DEFAULT_PLACEHOLDER = { start: "Date début", end: "Date fin" };

function DateRangeFilter({ 
  value = DEFAULT_VALUE, 
  onChange, 
  label = "Plage de dates",
  placeholder = DEFAULT_PLACEHOLDER
}) {
  // Validation de la plage de dates
  const isValidRange = useMemo(() => {
    if (!value.start || !value.end) return true;
    return new Date(value.start) <= new Date(value.end);
  }, [value.start, value.end]);

  // Handlers optimisés avec useCallback
  const handleStartChange = useCallback((e) => {
    onChange({
      ...value,
      start: e.target.value
    });
  }, [value, onChange]);

  const handleEndChange = useCallback((e) => {
    onChange({
      ...value,
      end: e.target.value
    });
  }, [value, onChange]);

  const clearDates = useCallback(() => {
    onChange(DEFAULT_VALUE);
  }, [onChange]);

  // Formatage sécurisé des dates pour l'affichage
  const formatDateSafely = useCallback((dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('fr-FR');
    } catch (error) {
      console.warn('Erreur de formatage de date:', error);
      return dateString;
    }
  }, []);

  // Génération d'IDs uniques pour l'accessibilité
  const startInputId = useMemo(() => `date-start-${Math.random().toString(36).substr(2, 9)}`, []);
  const endInputId = useMemo(() => `date-end-${Math.random().toString(36).substr(2, 9)}`, []);

  return (
    <div className="space-y-2" role="group" aria-labelledby={label ? `${startInputId}-label` : undefined}>
      {label && (
        <label 
          id={`${startInputId}-label`}
          className="label-text font-medium"
        >
          {label}
        </label>
      )}
      
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <input
            id={startInputId}
            type="date"
            className={`input input-bordered input-sm w-full ${
              !isValidRange ? 'input-error' : ''
            }`}
            value={value.start || ''}
            onChange={handleStartChange}
            placeholder={placeholder.start}
            aria-label={placeholder.start}
            aria-describedby={!isValidRange ? `${startInputId}-error` : undefined}
          />
        </div>
        
        <span 
          className="text-sm text-base-content/50" 
          aria-hidden="true"
        >
          à
        </span>
        
        <div className="flex-1">
          <input
            id={endInputId}
            type="date"
            className={`input input-bordered input-sm w-full ${
              !isValidRange ? 'input-error' : ''
            }`}
            value={value.end || ''}
            onChange={handleEndChange}
            placeholder={placeholder.end}
            min={value.start || undefined}
            aria-label={placeholder.end}
            aria-describedby={!isValidRange ? `${endInputId}-error` : undefined}
          />
        </div>
        
        {(value.start || value.end) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={clearDates}
            title="Effacer les dates"
            aria-label="Effacer la plage de dates"
          >
            ×
          </button>
        )}
      </div>
      
      {/* Message d'erreur pour plage invalide */}
      {!isValidRange && (
        <div 
          id={`${startInputId}-error`}
          className="text-xs text-error"
          role="alert"
        >
          La date de fin doit être postérieure à la date de début
        </div>
      )}
      
      {/* Affichage de la plage sélectionnée */}
      {value.start && value.end && isValidRange && (
        <div className="text-xs text-base-content/60">
          Du {formatDateSafely(value.start)} au {formatDateSafely(value.end)}
        </div>
      )}
    </div>
  );
}

DateRangeFilter.propTypes = {
  value: PropTypes.shape({
    start: PropTypes.string,
    end: PropTypes.string
  }),
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  placeholder: PropTypes.shape({
    start: PropTypes.string,
    end: PropTypes.string
  })
};

export default DateRangeFilter; 