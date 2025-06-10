import React from 'react';
import PropTypes from 'prop-types';
import { COMPARISON_OPERATORS } from '../../hooks/useAdvancedFilters';

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
  availableOperators = Object.values(COMPARISON_OPERATORS)
}) {
  const handleValueChange = (e) => {
    onChange(e.target.value);
  };

  const handleOperatorChange = (e) => {
    onOperatorChange(e.target.value);
  };

  const clearValue = () => {
    onChange('');
  };

  return (
    <div className="space-y-2">
      {label && <label className="label-text font-medium">{label}</label>}
      
      <div className="space-y-2">
        {/* Sélecteur d'opérateur */}
        <select
          className="select select-bordered select-sm w-full"
          value={operator}
          onChange={handleOperatorChange}
        >
          {availableOperators.map(op => (
            <option key={op} value={op}>
              {operatorLabels[op] || op}
            </option>
          ))}
        </select>
        
        {/* Champ de valeur */}
        <div className="flex gap-2">
          <input
            type="text"
            className="input input-bordered input-sm flex-1"
            value={value}
            onChange={handleValueChange}
            placeholder={placeholder}
          />
          
          {value && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={clearValue}
              title="Effacer la valeur"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {value && (
        <div className="text-xs text-base-content/60">
          {operatorLabels[operator]} "{value}"
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

export default ComparisonFilter; 