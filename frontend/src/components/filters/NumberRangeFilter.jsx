import React from 'react';
import PropTypes from 'prop-types';

function NumberRangeFilter({ 
  value = { min: '', max: '' }, 
  onChange, 
  label = "Plage numérique",
  placeholder = { min: "Minimum", max: "Maximum" },
  step = "any",
  currency = false
}) {
  const handleMinChange = (e) => {
    const newValue = e.target.value;
    onChange({
      ...value,
      min: newValue === '' ? undefined : Number(newValue)
    });
  };

  const handleMaxChange = (e) => {
    const newValue = e.target.value;
    onChange({
      ...value,
      max: newValue === '' ? undefined : Number(newValue)
    });
  };

  const clearRange = () => {
    onChange({ min: undefined, max: undefined });
  };

  const formatValue = (val) => {
    if (val === undefined || val === null) return '';
    return currency ? `${val.toLocaleString('fr-FR')} €` : val.toLocaleString('fr-FR');
  };

  const hasValues = value.min !== undefined || value.max !== undefined;

  return (
    <div className="space-y-2">
      {label && <label className="label-text font-medium">{label}</label>}
      
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <input
            type="number"
            className="input input-bordered input-sm w-full"
            value={value.min !== undefined ? value.min : ''}
            onChange={handleMinChange}
            placeholder={placeholder.min}
            step={step}
          />
        </div>
        
        <span className="text-sm text-base-content/50">à</span>
        
        <div className="flex-1">
          <input
            type="number"
            className="input input-bordered input-sm w-full"
            value={value.max !== undefined ? value.max : ''}
            onChange={handleMaxChange}
            placeholder={placeholder.max}
            step={step}
            min={value.min !== undefined ? value.min : undefined}
          />
        </div>
        
        {hasValues && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={clearRange}
            title="Effacer la plage"
          >
            ×
          </button>
        )}
      </div>
      
      {hasValues && (
        <div className="text-xs text-base-content/60">
          {value.min !== undefined && value.max !== undefined 
            ? `Entre ${formatValue(value.min)} et ${formatValue(value.max)}`
            : value.min !== undefined 
              ? `À partir de ${formatValue(value.min)}`
              : `Jusqu'à ${formatValue(value.max)}`
          }
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