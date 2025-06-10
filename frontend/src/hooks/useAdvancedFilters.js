import { useState, useCallback, useMemo } from 'react';

// Types de filtres supportés
export const FILTER_TYPES = {
  TEXT: 'text',
  SELECT_MULTIPLE: 'select_multiple',
  DATE_RANGE: 'date_range',
  NUMBER_RANGE: 'number_range',
  BOOLEAN: 'boolean',
  COMPARISON: 'comparison'
};

// Opérateurs de comparaison
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

export function useAdvancedFilters(data = [], initialColumns = [], customGetFieldValue = null) {
  const [filters, setFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(initialColumns);
  const [presets, setPresets] = useState([]);

  // Ajouter un filtre
  const addFilter = useCallback((filterConfig) => {
    const newFilter = {
      id: Date.now().toString(),
      field: '',
      type: FILTER_TYPES.TEXT,
      operator: COMPARISON_OPERATORS.CONTAINS,
      value: null,
      label: '',
      ...filterConfig
    };
    setFilters(prev => [...prev, newFilter]);
  }, []);

  // Supprimer un filtre
  const removeFilter = useCallback((filterId) => {
    setFilters(prev => prev.filter(f => f.id !== filterId));
  }, []);

  // Mettre à jour un filtre
  const updateFilter = useCallback((filterId, updates) => {
    setFilters(prev => 
      prev.map(filter => 
        filter.id === filterId 
          ? { ...filter, ...updates }
          : filter
      )
    );
  }, []);

  // Réinitialiser les filtres
  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  // Gestion du tri
  const addSort = useCallback((field, direction = 'asc') => {
    setSorting(prev => {
      const existing = prev.find(s => s.field === field);
      if (existing) {
        // Mise à jour du tri existant
        return prev.map(s => 
          s.field === field 
            ? { ...s, direction }
            : s
        );
      } else {
        // Nouveau tri
        return [...prev, { field, direction, priority: prev.length }];
      }
    });
  }, []);

  const removeSort = useCallback((field) => {
    setSorting(prev => prev.filter(s => s.field !== field));
  }, []);

  const clearSorting = useCallback(() => {
    setSorting([]);
  }, []);

  // Fonction pour extraire la valeur d'un champ (logique par défaut ou personnalisée)
  const getFieldValue = useCallback((record, ...possibleFields) => {
    // Si une fonction personnalisée est fournie, l'utiliser
    if (customGetFieldValue && possibleFields.length === 1) {
      return customGetFieldValue(record, possibleFields[0]);
    }
    
    // Sinon, utiliser la logique par défaut
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
      for (const sort of sorting.toSorted((x, y) => x.priority - y.priority)) {
        const aValue = getFieldValue(a, sort.field);
        const bValue = getFieldValue(b, sort.field);
        
        let comparison = 0;
        
        // Comparaison numérique si possible
        const aNum = Number(aValue);
        const bNum = Number(bValue);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          comparison = aNum - bNum;
        } else {
          // Comparaison textuelle
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
    const preset = {
      id: Date.now().toString(),
      name,
      description,
      filters: [...filters],
      sorting: [...sorting],
      visibleColumns: [...visibleColumns],
      createdAt: new Date().toISOString()
    };
    setPresets(prev => [...prev, preset]);
    
    // Sauvegarder dans localStorage
    const existingPresets = JSON.parse(localStorage.getItem('filter_presets') || '[]');
    const updatedPresets = [...existingPresets, preset];
    localStorage.setItem('filter_presets', JSON.stringify(updatedPresets));
    
    return preset;
  }, [filters, sorting, visibleColumns]);

  const loadPreset = useCallback((preset) => {
    setFilters(preset.filters || []);
    setSorting(preset.sorting || []);
    setVisibleColumns(preset.visibleColumns || []);
  }, []);

  const deletePreset = useCallback((presetId) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
    
    // Supprimer du localStorage
    const existingPresets = JSON.parse(localStorage.getItem('filter_presets') || '[]');
    const updatedPresets = existingPresets.filter(p => p.id !== presetId);
    localStorage.setItem('filter_presets', JSON.stringify(updatedPresets));
  }, []);

  // Charger les presets depuis localStorage au démarrage
  const loadPresetsFromStorage = useCallback(() => {
    const stored = JSON.parse(localStorage.getItem('filter_presets') || '[]');
    setPresets(stored);
  }, []);

  return {
    filters,
    sorting,
    visibleColumns,
    presets,
    filteredData,
    addFilter,
    removeFilter,
    updateFilter,
    clearFilters,
    addSort,
    removeSort,
    clearSorting,
    setVisibleColumns,
    savePreset,
    loadPreset,
    deletePreset,
    loadPresetsFromStorage,
    getFieldValue
  };
} 