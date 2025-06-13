import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FiPlus, FiTrash2, FiSave, FiSettings, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { FILTER_TYPES, COMPARISON_OPERATORS } from '../../hooks/useAdvancedFilters';
import MultipleSelector from './MultiSelector';
import DateRangeFilter from './DateRangeFilter';
import NumberRangeFilter from './NumberRangeFilter';
import BooleanFilter from './BooleanFilter';
import ComparisonFilter from './ComparisonFilter';

// Configuration centralisée pour éviter la duplication
const COMMON_INPUT_CLASSES = "input input-bordered input-sm";
const COMMON_SELECT_CLASSES = "select select-bordered select-sm w-full";
const COMMON_BUTTON_CLASSES = "btn btn-sm";

const filterTypeLabels = {
  [FILTER_TYPES.TEXT]: 'Texte',
  [FILTER_TYPES.SELECT_MULTIPLE]: 'Sélection multiple',
  [FILTER_TYPES.DATE_RANGE]: 'Plage de dates',
  [FILTER_TYPES.NUMBER_RANGE]: 'Plage numérique',
  [FILTER_TYPES.BOOLEAN]: 'Oui/Non',
  [FILTER_TYPES.COMPARISON]: 'Comparaison'
};

// Fonction utilitaire pour obtenir l'opérateur par défaut selon le type
const getDefaultOperatorForType = (type) => {
  switch (type) {
    case FILTER_TYPES.TEXT:
    case FILTER_TYPES.COMPARISON:
      return COMPARISON_OPERATORS.CONTAINS;
    case FILTER_TYPES.NUMBER_RANGE:
      return COMPARISON_OPERATORS.EQUALS;
    default:
      return COMPARISON_OPERATORS.CONTAINS;
  }
};

// Fonction utilitaire pour obtenir la valeur par défaut selon le type
const getDefaultValueForType = (type) => {
  switch (type) {
    case FILTER_TYPES.DATE_RANGE:
      return { start: '', end: '' };
    case FILTER_TYPES.NUMBER_RANGE:
      return { min: undefined, max: undefined };
    case FILTER_TYPES.SELECT_MULTIPLE:
      return [];
    case FILTER_TYPES.BOOLEAN:
      return false;
    default:
      return '';
  }
};

const FilterRow = React.memo(function FilterRow({ 
  filter, 
  availableFields, 
  onUpdate, 
  onRemove, 
  getFieldOptions,
  expandedStates,
  onToggleExpanded
}) {
  const isExpanded = expandedStates[filter.id] ?? true;

  // Mémorisation des handlers pour éviter les re-rendus
  const handleFieldChange = useCallback((e) => {
    const field = e.target.value;
    const fieldData = availableFields.find(f => f.value === field);
    
    onUpdate(filter.id, { 
      field,
      value: field ? getDefaultValueForType(filter.type) : null,
      operator: getDefaultOperatorForType(filter.type),
      label: fieldData?.label || field
    });
  }, [filter.id, filter.type, availableFields, onUpdate]);

  const handleTypeChange = useCallback((e) => {
    const newType = e.target.value;
    onUpdate(filter.id, { 
      type: newType,
      value: getDefaultValueForType(newType),
      operator: getDefaultOperatorForType(newType)
    });
  }, [filter.id, onUpdate]);

  const handleValueChange = useCallback((value) => {
    onUpdate(filter.id, { value });
  }, [filter.id, onUpdate]);

  const handleOperatorChange = useCallback((operator) => {
    onUpdate(filter.id, { operator });
  }, [filter.id, onUpdate]);

  const handleRemove = useCallback(() => {
    onRemove(filter.id);
  }, [filter.id, onRemove]);

  const handleToggleExpanded = useCallback(() => {
    onToggleExpanded(filter.id);
  }, [filter.id, onToggleExpanded]);

  // Mémorisation des options pour éviter les recalculs
  const fieldOptions = useMemo(() => {
    return filter.field ? getFieldOptions(filter.field) : [];
  }, [filter.field, getFieldOptions]);

  const renderFilterControl = () => {
    if (!filter.field) return null;

    const controlId = `filter-value-${filter.id}`;

    try {
      switch (filter.type) {
        case FILTER_TYPES.TEXT:
          return (
            <input
              id={controlId}
              type="text"
              className={`${COMMON_INPUT_CLASSES} w-full`}
              value={filter.value || ''}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder="Rechercher..."
              aria-label="Valeur du filtre texte"
            />
          );

        case FILTER_TYPES.SELECT_MULTIPLE:
          return (
            <div id={controlId}>
              <MultipleSelector
                options={fieldOptions}
                value={filter.value || []}
                onChange={handleValueChange}
                placeholder="Sélectionnez des options..."
                aria-label="Sélection multiple"
              />
            </div>
          );

        case FILTER_TYPES.DATE_RANGE:
          return (
            <div id={controlId}>
              <DateRangeFilter
                value={filter.value || { start: '', end: '' }}
                onChange={handleValueChange}
                label=""
                aria-label="Plage de dates"
              />
            </div>
          );

        case FILTER_TYPES.NUMBER_RANGE:
          return (
            <div id={controlId}>
              <NumberRangeFilter
                value={filter.value || { min: undefined, max: undefined }}
                onChange={handleValueChange}
                label=""
                currency={filter.field?.toLowerCase().includes('prix') || filter.field?.toLowerCase().includes('montant')}
                aria-label="Plage numérique"
              />
            </div>
          );

        case FILTER_TYPES.BOOLEAN:
          return (
            <div id={controlId}>
              <BooleanFilter
                value={filter.value ?? false}
                onChange={handleValueChange}
                label=""
                aria-label="Valeur booléenne"
              />
            </div>
          );

        case FILTER_TYPES.COMPARISON:
          return (
            <div id={controlId}>
              <ComparisonFilter
                value={filter.value || ''}
                operator={filter.operator || COMPARISON_OPERATORS.CONTAINS}
                onChange={handleValueChange}
                onOperatorChange={handleOperatorChange}
                label=""
                aria-label="Filtre de comparaison"
              />
            </div>
          );

        default:
          return (
            <div className="text-sm text-error" role="alert">
              Type de filtre non supporté: {filter.type}
            </div>
          );
      }
    } catch (error) {
      console.error('Erreur lors du rendu du contrôle de filtre:', error);
      return (
        <div className="text-sm text-error" role="alert">
          Erreur lors du chargement du filtre
        </div>
      );
    }
  };

  const filterId = `filter-${filter.id}`;
  const fieldSelectId = `field-select-${filter.id}`;
  const typeSelectId = `type-select-${filter.id}`;

  return (
    <div className="border border-base-300 rounded-lg p-3 space-y-3" role="region" aria-labelledby={filterId}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          id={filterId}
          type="button"
          className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
          onClick={handleToggleExpanded}
          aria-expanded={isExpanded}
          aria-controls={`${filterId}-content`}
        >
          {isExpanded ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}
          Filtre #{filter.id.slice(-4)}
          {filter.label && ` - ${filter.label}`}
        </button>
        
        <button
          type="button"
          className={`${COMMON_BUTTON_CLASSES} btn-ghost text-error hover:bg-error/10`}
          onClick={handleRemove}
          aria-label={`Supprimer le filtre ${filter.label || filter.id.slice(-4)}`}
        >
          <FiTrash2 aria-hidden="true" />
        </button>
      </div>

      {isExpanded && (
        <div id={`${filterId}-content`} className="space-y-3">
          {/* Field Selection */}
          <div>
            <label className="label-text text-xs font-medium" htmlFor={fieldSelectId}>
              Champ <span className="text-error">*</span>
            </label>
            <select
              id={fieldSelectId}
              className={COMMON_SELECT_CLASSES}
              value={filter.field || ''}
              onChange={handleFieldChange}
              aria-required="true"
              aria-describedby={filter.field ? undefined : `${fieldSelectId}-error`}
            >
              <option value="">Sélectionnez un champ</option>
              {availableFields.map(field => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </select>
            {!filter.field && (
              <div id={`${fieldSelectId}-error`} className="text-xs text-error mt-1">
                Veuillez sélectionner un champ
              </div>
            )}
          </div>

          {/* Type Selection */}
          {filter.field && (
            <div>
              <label className="label-text text-xs font-medium" htmlFor={typeSelectId}>
                Type de filtre <span className="text-error">*</span>
              </label>
              <select
                id={typeSelectId}
                className={COMMON_SELECT_CLASSES}
                value={filter.type || ''}
                onChange={handleTypeChange}
                aria-required="true"
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
              <label className="label-text text-xs font-medium" htmlFor={`filter-value-${filter.id}`}>
                Valeur
              </label>
              {renderFilterControl()}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

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
  const [expandedStates, setExpandedStates] = useState({});

  // Mémorisation des handlers
  const handleAddFilter = useCallback(() => {
    const newFilter = {
      field: '',
      type: FILTER_TYPES.TEXT,
      value: null,
      label: '',
      operator: COMPARISON_OPERATORS.CONTAINS
    };
    onAddFilter(newFilter);
  }, [onAddFilter]);

  const handleSavePreset = useCallback(() => {
    const trimmedName = presetName.trim();
    if (trimmedName && filters.length > 0) {
      onSavePreset(trimmedName);
      setPresetName('');
      setShowPresetForm(false);
    }
  }, [presetName, filters.length, onSavePreset]);

  const handleToggleExpanded = useCallback((filterId) => {
    setExpandedStates(prev => ({
      ...prev,
      [filterId]: !prev[filterId]
    }));
  }, []);

  const handlePresetNameChange = useCallback((e) => {
    setPresetName(e.target.value);
  }, []);

  const handlePresetFormToggle = useCallback(() => {
    setShowPresetForm(prev => !prev);
    if (showPresetForm) {
      setPresetName('');
    }
  }, [showPresetForm]);

  const handleCancelPreset = useCallback(() => {
    setShowPresetForm(false);
    setPresetName('');
  }, []);

  // Mémorisation des calculs
  const hasActiveFilters = useMemo(() => {
    return filters.some(f => 
      f.field && 
      f.value !== null && 
      f.value !== undefined && 
      f.value !== '' &&
      !(Array.isArray(f.value) && f.value.length === 0)
    );
  }, [filters]);

  const canSavePreset = useMemo(() => {
    return presetName.trim().length > 0 && filters.length > 0 && hasActiveFilters;
  }, [presetName, filters.length, hasActiveFilters]);

  return (
    <div className={`space-y-4 ${className}`} role="region" aria-label="Panneau de filtres avancés">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-base">Filtres avancés</h3>
        <div className="flex gap-2">
          <button
            type="button"
            className={`${COMMON_BUTTON_CLASSES} btn-outline`}
            onClick={handlePresetFormToggle}
            aria-label="Sauvegarder comme preset"
            disabled={filters.length === 0}
          >
            <FiSave className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${COMMON_BUTTON_CLASSES} btn-primary`}
            onClick={handleAddFilter}
            aria-label="Ajouter un nouveau filtre"
          >
            <FiPlus className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Save Preset Form */}
      {showPresetForm && (
        <div className="bg-base-200 p-3 rounded-lg space-y-2" role="dialog" aria-labelledby="preset-form-title">
          <label id="preset-form-title" className="label-text text-sm font-medium" htmlFor="preset-name">
            Nom du preset <span className="text-error">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="preset-name"
              className={`${COMMON_INPUT_CLASSES} flex-1`}
              value={presetName}
              onChange={handlePresetNameChange}
              placeholder="Nom du preset..."
              onKeyDown={(e) => e.key === 'Enter' && canSavePreset && handleSavePreset()}
              aria-required="true"
              maxLength={50}
            />
            <button
              type="button"
              className={`${COMMON_BUTTON_CLASSES} btn-primary`}
              onClick={handleSavePreset}
              disabled={!canSavePreset}
              aria-label="Confirmer la sauvegarde du preset"
            >
              Sauvegarder
            </button>
            <button
              type="button"
              className={`${COMMON_BUTTON_CLASSES} btn-ghost`}
              onClick={handleCancelPreset}
              aria-label="Annuler la sauvegarde du preset"
            >
              Annuler
            </button>
          </div>
          {!hasActiveFilters && filters.length > 0 && (
            <div className="text-xs text-warning" role="alert">
              Aucun filtre actif à sauvegarder
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        {filters.length === 0 ? (
          <div className="text-center py-8 text-base-content/50" role="status">
            <FiSettings className="w-8 h-8 mx-auto mb-2" aria-hidden="true" />
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
              expandedStates={expandedStates}
              onToggleExpanded={handleToggleExpanded}
            />
          ))
        )}
      </div>

      {/* Actions */}
      {filters.length > 0 && (
        <div className="flex justify-between items-center pt-3 border-t border-base-300">
          <button
            type="button"
            className={`${COMMON_BUTTON_CLASSES} btn-outline btn-error`}
            onClick={onClearFilters}
            aria-label="Supprimer tous les filtres"
          >
            Tout effacer
          </button>
          
          <div className="text-sm text-base-content/60" role="status" aria-live="polite">
            {filters.length} filtre(s) • {hasActiveFilters ? 'Actif' : 'Inactif'}
          </div>
        </div>
      )}
    </div>
  );
}

// Validation plus stricte des PropTypes
FilterRow.propTypes = {
  filter: PropTypes.shape({
    id: PropTypes.string.isRequired,
    field: PropTypes.string,
    type: PropTypes.string.isRequired,
    value: PropTypes.any,
    operator: PropTypes.string,
    label: PropTypes.string
  }).isRequired,
  availableFields: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired
  })).isRequired,
  onUpdate: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  getFieldOptions: PropTypes.func.isRequired,
  expandedStates: PropTypes.object.isRequired,
  onToggleExpanded: PropTypes.func.isRequired
};

AdvancedFilterPanel.propTypes = {
  filters: PropTypes.arrayOf(PropTypes.object).isRequired,
  availableFields: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired
  })).isRequired,
  onAddFilter: PropTypes.func.isRequired,
  onUpdateFilter: PropTypes.func.isRequired,
  onRemoveFilter: PropTypes.func.isRequired,
  onClearFilters: PropTypes.func.isRequired,
  onSavePreset: PropTypes.func.isRequired,
  getFieldOptions: PropTypes.func,
  className: PropTypes.string
};

export default AdvancedFilterPanel; 