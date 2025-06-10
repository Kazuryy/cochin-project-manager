import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FiPlus, FiTrash2, FiSave, FiSettings, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { FILTER_TYPES, COMPARISON_OPERATORS } from '../../hooks/useAdvancedFilters';
import MultipleSelector from './MultiSelector';
import DateRangeFilter from './DateRangeFilter';
import NumberRangeFilter from './NumberRangeFilter';
import BooleanFilter from './BooleanFilter';
import ComparisonFilter from './ComparisonFilter';

const filterTypeLabels = {
  [FILTER_TYPES.TEXT]: 'Texte',
  [FILTER_TYPES.SELECT_MULTIPLE]: 'Sélection multiple',
  [FILTER_TYPES.DATE_RANGE]: 'Plage de dates',
  [FILTER_TYPES.NUMBER_RANGE]: 'Plage numérique',
  [FILTER_TYPES.BOOLEAN]: 'Oui/Non',
  [FILTER_TYPES.COMPARISON]: 'Comparaison'
};

function FilterRow({ 
  filter, 
  availableFields, 
  onUpdate, 
  onRemove, 
  getFieldOptions 
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleFieldChange = (e) => {
    const field = e.target.value;
    onUpdate(filter.id, { 
      field,
      value: null, // Reset value when field changes
      label: availableFields.find(f => f.value === field)?.label || field
    });
  };

  const handleTypeChange = (e) => {
    onUpdate(filter.id, { 
      type: e.target.value,
      value: null, // Reset value when type changes
      operator: COMPARISON_OPERATORS.CONTAINS
    });
  };

  const handleValueChange = (value) => {
    onUpdate(filter.id, { value });
  };

  const handleOperatorChange = (operator) => {
    onUpdate(filter.id, { operator });
  };

  const renderFilterControl = () => {
    if (!filter.field) return null;

    switch (filter.type) {
      case FILTER_TYPES.TEXT:
        return (
          <input
            type="text"
            className="input input-bordered input-sm w-full"
            value={filter.value || ''}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Rechercher..."
          />
        );

      case FILTER_TYPES.SELECT_MULTIPLE: {
        const options = getFieldOptions(filter.field);
        return (
          <MultipleSelector
            options={options}
            onChange={handleValueChange}
            placeholder="Sélectionnez des options..."
          />
        );
      }

      case FILTER_TYPES.DATE_RANGE:
        return (
          <DateRangeFilter
            value={filter.value || { start: '', end: '' }}
            onChange={handleValueChange}
            label=""
          />
        );

      case FILTER_TYPES.NUMBER_RANGE:
        return (
          <NumberRangeFilter
            value={filter.value || { min: undefined, max: undefined }}
            onChange={handleValueChange}
            label=""
            currency={filter.field?.toLowerCase().includes('prix') || filter.field?.toLowerCase().includes('montant')}
          />
        );

      case FILTER_TYPES.BOOLEAN:
        return (
          <BooleanFilter
            value={filter.value}
            onChange={handleValueChange}
            label=""
          />
        );

      case FILTER_TYPES.COMPARISON:
        return (
          <ComparisonFilter
            value={filter.value || ''}
            operator={filter.operator || COMPARISON_OPERATORS.CONTAINS}
            onChange={handleValueChange}
            onOperatorChange={handleOperatorChange}
            label=""
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="border border-base-300 rounded-lg p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
          Filtre #{filter.id.slice(-4)}
          {filter.label && ` - ${filter.label}`}
        </button>
        
        <button
          type="button"
          className="btn btn-ghost btn-xs text-error"
          onClick={() => onRemove(filter.id)}
          title="Supprimer ce filtre"
        >
          <FiTrash2 />
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {/* Field Selection */}
          <div>
            <label className="label-text text-xs font-medium" htmlFor="field-select">Champ</label>
            <select
              className="select select-bordered select-sm w-full"
              value={filter.field}
              onChange={handleFieldChange}
              id="field-select"
            >
              <option value="">Sélectionnez un champ</option>
              {availableFields.map(field => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type Selection */}
          {filter.field && (
            <div>
              <label className="label-text text-xs font-medium" htmlFor="type-select">Type de filtre</label>
              <select
                className="select select-bordered select-sm w-full"
                value={filter.type}
                onChange={handleTypeChange}
                id="type-select"
              >
                {Object.entries(filterTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filter Control */}
          {filter.field && (
            <div>
              <label className="label-text text-xs font-medium" htmlFor="value-input">Valeur</label>
              {renderFilterControl()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdvancedFilterPanel({ 
  filters, 
  availableFields = [],
  onAddFilter, 
  onUpdateFilter, 
  onRemoveFilter, 
  onClearFilters,
  onSavePreset,
  getFieldOptions = () => [],
  className = ""
}) {
  const [presetName, setPresetName] = useState('');
  const [showPresetForm, setShowPresetForm] = useState(false);

  const handleAddFilter = () => {
    onAddFilter({
      field: '',
      type: FILTER_TYPES.TEXT,
      value: null,
      label: ''
    });
  };

  const handleSavePreset = () => {
    if (presetName.trim()) {
      onSavePreset(presetName.trim());
      setPresetName('');
      setShowPresetForm(false);
    }
  };

  const hasActiveFilters = filters.some(f => f.field && f.value !== null && f.value !== undefined);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-base">Filtres avancés</h3>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setShowPresetForm(!showPresetForm)}
            title="Sauvegarder comme preset"
          >
            <FiSave className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleAddFilter}
            title="Ajouter un filtre"
          >
            <FiPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Save Preset Form */}
      {showPresetForm && (
        <div className="bg-base-200 p-3 rounded-lg space-y-2">
          <label className="label-text text-sm font-medium" htmlFor="preset-name">Nom du preset</label>
          <div className="flex gap-2">
            <input
              type="text"
              id="preset-name"
              className="input input-bordered input-sm flex-1"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nom du preset..."
              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
            />
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
            >
              Sauvegarder
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setShowPresetForm(false)}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        {filters.length === 0 ? (
          <div className="text-center py-8 text-base-content/50">
            <FiSettings className="w-8 h-8 mx-auto mb-2" />
            <p>Aucun filtre configuré</p>
            <p className="text-xs">Cliquez sur "+" pour ajouter un filtre</p>
          </div>
        ) : (
          filters.map(filter => (
            <FilterRow
              key={filter.id}
              filter={filter}
              availableFields={availableFields}
              onUpdate={onUpdateFilter}
              onRemove={onRemoveFilter}
              getFieldOptions={getFieldOptions}
            />
          ))
        )}
      </div>

      {/* Actions */}
      {filters.length > 0 && (
        <div className="flex justify-between pt-3 border-t border-base-300">
          <button
            type="button"
            className="btn btn-sm btn-outline btn-error"
            onClick={onClearFilters}
          >
            Tout effacer
          </button>
          
          <div className="text-sm text-base-content/60">
            {filters.length} filtre(s) • {hasActiveFilters ? 'Actif' : 'Inactif'}
          </div>
        </div>
      )}
    </div>
  );
}

FilterRow.propTypes = {
  filter: PropTypes.object.isRequired,
  availableFields: PropTypes.array.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  getFieldOptions: PropTypes.func.isRequired
};

AdvancedFilterPanel.propTypes = {
  filters: PropTypes.array.isRequired,
  availableFields: PropTypes.array.isRequired,
  onAddFilter: PropTypes.func.isRequired,
  onUpdateFilter: PropTypes.func.isRequired,
  onRemoveFilter: PropTypes.func.isRequired,
  onClearFilters: PropTypes.func.isRequired,
  onSavePreset: PropTypes.func.isRequired,
  getFieldOptions: PropTypes.func,
  className: PropTypes.string
};

export default AdvancedFilterPanel; 