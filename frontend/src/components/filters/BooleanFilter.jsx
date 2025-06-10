import React from 'react';
import PropTypes from 'prop-types';

function BooleanFilter({ 
  value, 
  onChange, 
  label = "Filtre booléen",
  trueLabel = "Oui",
  falseLabel = "Non",
  nullLabel = "Tous"
}) {
  const handleChange = (newValue) => {
    onChange(newValue);
  };

  const getButtonClass = (buttonValue) => {
    const baseClass = "btn btn-sm flex-1";
    if (value === buttonValue) {
      return `${baseClass} btn-primary`;
    }
    return `${baseClass} btn-outline`;
  };

  return (
    <div className="space-y-2">
      {label && <label className="label-text font-medium">{label}</label>}
      
      <div className="flex gap-1">
        <button
          type="button"
          className={getButtonClass(null)}
          onClick={() => handleChange(null)}
        >
          {nullLabel}
        </button>
        
        <button
          type="button"
          className={getButtonClass(true)}
          onClick={() => handleChange(true)}
        >
          {trueLabel}
        </button>
        
        <button
          type="button"
          className={getButtonClass(false)}
          onClick={() => handleChange(false)}
        >
          {falseLabel}
        </button>
      </div>
      
      {value !== null && (
        <div className="text-xs text-base-content/60">
          Filtre: {value ? trueLabel : falseLabel}
        </div>
      )}
    </div>
  );
}

BooleanFilter.propTypes = {
  value: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  trueLabel: PropTypes.string,
  falseLabel: PropTypes.string,
  nullLabel: PropTypes.string
};

export default BooleanFilter; 