import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Types de filtres supportés
 * @enum {string}
 */
export const FILTER_TYPES = {
  TEXT: 'text',
  SELECT_MULTIPLE: 'select_multiple',
  DATE_RANGE: 'date_range',
  NUMBER_RANGE: 'number_range',
  BOOLEAN: 'boolean',
  COMPARISON: 'comparison'
};

/**
 * Opérateurs de comparaison
 * @enum {string}
 */
export const COMPARISON_OPERATORS = {
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  GREATER_EQUAL: 'greater_equal',
  LESS_EQUAL: 'less_equal'
};

/**
 * Hook personnalisé pour gérer les filtres avancés
 * @param {Array} data - Données à filtrer
 * @param {Array} initialColumns - Colonnes initiales visibles
 * @param {Function} customGetFieldValue - Fonction personnalisée pour extraire les valeurs
 * @returns {Object} Objet contenant les fonctions et états de filtrage
 */
export function useAdvancedFilters(data = [], initialColumns = [], customGetFieldValue = null) {
  const [filters, setFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(initialColumns);
  const [presets, setPresets] = useState([]);

  // Mémoisation des fonctions de filtrage
  const applyTextFilter = useCallback((fieldValue, filter) => {
    const textValue = String(fieldValue).toLowerCase();
    const searchTerm = String(filter.value).toLowerCase();
    
    switch (filter.operator) {
      case COMPARISON_OPERATORS.CONTAINS:
        return textValue.includes(searchTerm);
      case COMPARISON_OPERATORS.NOT_CONTAINS:
        return !textValue.includes(searchTerm);
      case COMPARISON_OPERATORS.EQUALS:
        return textValue === searchTerm;
      case COMPARISON_OPERATORS.NOT_EQUALS:
        return textValue !== searchTerm;
      case COMPARISON_OPERATORS.STARTS_WITH:
        return textValue.startsWith(searchTerm);
      case COMPARISON_OPERATORS.ENDS_WITH:
        return textValue.endsWith(searchTerm);
      default:
        return true;
    }
  }, []);

  const applyDateRangeFilter = useCallback((fieldValue, filter) => {
    if (!filter.value?.start && !filter.value?.end) return true;
    const itemDate = new Date(fieldValue);
    if (isNaN(itemDate)) return false;
    
    const startDate = filter.value.start ? new Date(filter.value.start) : null;
    const endDate = filter.value.end ? new Date(filter.value.end) : null;
    
    return (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
  }, []);

  const applyNumberRangeFilter = useCallback((fieldValue, filter) => {
    const numValue = Number(fieldValue);
    if (isNaN(numValue)) return false;
    
    const minValue = filter.value?.min;
    const maxValue = filter.value?.max;
    
    return (minValue === undefined || numValue >= minValue) && (maxValue === undefined || numValue <= maxValue);
  }, []);

  const applyComparisonFilter = useCallback((fieldValue, filter) => {
    const compareValue = String(fieldValue);
    const targetValue = String(filter.value);
    
    switch (filter.operator) {
      case COMPARISON_OPERATORS.EQUALS:
        return compareValue === targetValue;
      case COMPARISON_OPERATORS.NOT_EQUALS:
        return compareValue !== targetValue;
      case COMPARISON_OPERATORS.GREATER_THAN:
        return Number(compareValue) > Number(targetValue);
      case COMPARISON_OPERATORS.LESS_THAN:
        return Number(compareValue) < Number(targetValue);
      case COMPARISON_OPERATORS.GREATER_EQUAL:
        return Number(compareValue) >= Number(targetValue);
      case COMPARISON_OPERATORS.LESS_EQUAL:
        return Number(compareValue) <= Number(targetValue);
      default:
        return true;
    }
  }, []);

  // Fonction pour extraire la valeur d'un champ
  const getFieldValue = useCallback((record, ...possibleFields) => {
    if (customGetFieldValue && possibleFields.length === 1) {
      return customGetFieldValue(record, possibleFields[0]);
    }
    
    if (!record) return '';
    
    for (const field of possibleFields) {
      if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
        return record[field];
      }
    }
    
    if (record.values && Array.isArray(record.values)) {
      for (const field of possibleFields) {
        const valueField = record.values.find(v => v.field_slug === field);
        if (valueField?.value !== undefined && valueField?.value !== null && valueField?.value !== '') {
          return valueField.value;
        }
      }
    }
    
    return '';
  }, [customGetFieldValue]);

  // Application des filtres
  const applyFilters = useCallback((item) => {
    return filters.every(filter => {
      if (!filter.field || filter.value === null || filter.value === undefined) {
        return true;
      }

      const fieldValue = getFieldValue(item, filter.field);
      
      switch (filter.type) {
        case FILTER_TYPES.TEXT:
          return applyTextFilter(fieldValue, filter);
        case FILTER_TYPES.SELECT_MULTIPLE:
          if (!Array.isArray(filter.value) || filter.value.length === 0) return true;
          return filter.value.includes(String(fieldValue));
        case FILTER_TYPES.BOOLEAN:
          return Boolean(fieldValue) === filter.value;
        case FILTER_TYPES.DATE_RANGE:
          return applyDateRangeFilter(fieldValue, filter);
        case FILTER_TYPES.NUMBER_RANGE:
          return applyNumberRangeFilter(fieldValue, filter);
        case FILTER_TYPES.COMPARISON:
          return applyComparisonFilter(fieldValue, filter);
        default:
          return true;
      }
    });
  }, [filters, getFieldValue, applyTextFilter, applyDateRangeFilter, applyNumberRangeFilter, applyComparisonFilter]);

  // Application du tri
  const applySorting = useCallback((items) => {
    if (sorting.length === 0) return items;

    return [...items].sort((a, b) => {
      for (const sort of [...sorting].sort((x, y) => x.priority - y.priority)) {
        const aValue = getFieldValue(a, sort.field);
        const bValue = getFieldValue(b, sort.field);
        
        let comparison = 0;
        
        const aNum = Number(aValue);
        const bNum = Number(bValue);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          comparison = aNum - bNum;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
        
        if (comparison !== 0) {
          return sort.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }, [sorting, getFieldValue]);

  // Données filtrées et triées
  const filteredData = useMemo(() => {
    let result = data.filter(applyFilters);
    result = applySorting(result);
    return result;
  }, [data, applyFilters, applySorting]);

  // Gestion des presets
  const savePreset = useCallback((name, description = '') => {
    try {
      const preset = {
        id: uuidv4(),
        name,
        description,
        filters: [...filters],
        sorting: [...sorting],
        visibleColumns: [...visibleColumns],
        createdAt: new Date().toISOString()
      };
      
      setPresets(prev => [...prev, preset]);
      
      const existingPresets = JSON.parse(localStorage.getItem('filter_presets') || '[]');
      const updatedPresets = [...existingPresets, preset];
      localStorage.setItem('filter_presets', JSON.stringify(updatedPresets));
      
      return preset;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du preset:', error);
      return null;
    }
  }, [filters, sorting, visibleColumns]);

  const loadPreset = useCallback((preset) => {
    if (!preset || typeof preset !== 'object') return;
    
    setFilters(preset.filters || []);
    setSorting(preset.sorting || []);
    setVisibleColumns(preset.visibleColumns || []);
  }, []);

  const deletePreset = useCallback((presetId) => {
    try {
      setPresets(prev => prev.filter(p => p.id !== presetId));
      
      const existingPresets = JSON.parse(localStorage.getItem('filter_presets') || '[]');
      const updatedPresets = existingPresets.filter(p => p.id !== presetId);
      localStorage.setItem('filter_presets', JSON.stringify(updatedPresets));
    } catch (error) {
      console.error('Erreur lors de la suppression du preset:', error);
    }
  }, []);

  const loadPresetsFromStorage = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('filter_presets') || '[]');
      setPresets(stored);
    } catch (error) {
      console.error('Erreur lors du chargement des presets:', error);
      setPresets([]);
    }
  }, []);

  return {
    filters,
    sorting,
    visibleColumns,
    presets,
    filteredData,
    addFilter: useCallback((filterConfig) => {
      const newFilter = {
        id: uuidv4(),
        field: '',
        type: FILTER_TYPES.TEXT,
        operator: COMPARISON_OPERATORS.CONTAINS,
        value: null,
        label: '',
        ...filterConfig
      };
      setFilters(prev => [...prev, newFilter]);
    }, []),
    removeFilter: useCallback((filterId) => {
      setFilters(prev => prev.filter(f => f.id !== filterId));
    }, []),
    updateFilter: useCallback((filterId, updates) => {
      setFilters(prev => 
        prev.map(filter => 
          filter.id === filterId 
            ? { ...filter, ...updates }
            : filter
        )
      );
    }, []),
    clearFilters: useCallback(() => {
      setFilters([]);
    }, []),
    addSort: useCallback((field, direction = 'asc') => {
      setSorting(prev => {
        const existing = prev.find(s => s.field === field);
        if (existing) {
          return prev.map(s => 
            s.field === field 
              ? { ...s, direction }
              : s
          );
        } else {
          return [...prev, { field, direction, priority: prev.length }];
        }
      });
    }, []),
    removeSort: useCallback((field) => {
      setSorting(prev => prev.filter(s => s.field !== field));
    }, []),
    clearSorting: useCallback(() => {
      setSorting([]);
    }, []),
    setVisibleColumns,
    savePreset,
    loadPreset,
    deletePreset,
    loadPresetsFromStorage,
    getFieldValue
  };
} 