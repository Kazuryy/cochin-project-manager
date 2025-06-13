import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import DateRangeFilter from './DateRangeFilter';
import NumberRangeFilter from './NumberRangeFilter';
import BooleanFilter from './BooleanFilter';
import ComparisonFilter from './ComparisonFilter';
import MultipleSelector from './MultiSelector';
import { COMPARISON_OPERATORS } from '../../hooks/useAdvancedFilters';

/**
 * Composant de démonstration pour tester tous les types de filtres
 * Utile pour le développement et les tests
 * 
 * @param {Object} props - Props du composant
 * @param {string} props.className - Classes CSS supplémentaires
 * @param {function} props.onFiltersChange - Callback appelé quand les filtres changent
 */
function FilterDemo({ className = '', onFiltersChange }) {
  // États des filtres avec valeurs par défaut optimisées
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [numberRange, setNumberRange] = useState({ min: undefined, max: undefined });
  const [booleanValue, setBooleanValue] = useState(null);
  const [comparisonValue, setComparisonValue] = useState('');
  const [comparisonOperator, setComparisonOperator] = useState(COMPARISON_OPERATORS.CONTAINS);
  const [multipleSelection, setMultipleSelection] = useState([]);

  // Données statiques mémorisées pour éviter les re-créations
  const demoOptions = useMemo(() => [
    'Option 1', 
    'Option 2', 
    'Option 3', 
    'Option 4', 
    'Option 5'
  ], []);

  // Handlers optimisés avec useCallback
  const handleDateRangeChange = useCallback((newValue) => {
    setDateRange(newValue);
    onFiltersChange?.({
      dateRange: newValue,
      numberRange,
      booleanValue,
      comparisonValue,
      comparisonOperator,
      multipleSelection
    });
  }, [onFiltersChange, numberRange, booleanValue, comparisonValue, comparisonOperator, multipleSelection]);

  const handleNumberRangeChange = useCallback((newValue) => {
    setNumberRange(newValue);
    onFiltersChange?.({
      dateRange,
      numberRange: newValue,
      booleanValue,
      comparisonValue,
      comparisonOperator,
      multipleSelection
    });
  }, [onFiltersChange, dateRange, booleanValue, comparisonValue, comparisonOperator, multipleSelection]);

  const handleBooleanChange = useCallback((newValue) => {
    setBooleanValue(newValue);
    onFiltersChange?.({
      dateRange,
      numberRange,
      booleanValue: newValue,
      comparisonValue,
      comparisonOperator,
      multipleSelection
    });
  }, [onFiltersChange, dateRange, numberRange, comparisonValue, comparisonOperator, multipleSelection]);

  const handleComparisonValueChange = useCallback((newValue) => {
    setComparisonValue(newValue);
    onFiltersChange?.({
      dateRange,
      numberRange,
      booleanValue,
      comparisonValue: newValue,
      comparisonOperator,
      multipleSelection
    });
  }, [onFiltersChange, dateRange, numberRange, booleanValue, comparisonOperator, multipleSelection]);

  const handleComparisonOperatorChange = useCallback((newOperator) => {
    setComparisonOperator(newOperator);
    onFiltersChange?.({
      dateRange,
      numberRange,
      booleanValue,
      comparisonValue,
      comparisonOperator: newOperator,
      multipleSelection
    });
  }, [onFiltersChange, dateRange, numberRange, booleanValue, comparisonValue, multipleSelection]);

  const handleMultipleSelectionChange = useCallback((newSelection) => {
    setMultipleSelection(newSelection);
    onFiltersChange?.({
      dateRange,
      numberRange,
      booleanValue,
      comparisonValue,
      comparisonOperator,
      multipleSelection: newSelection
    });
  }, [onFiltersChange, dateRange, numberRange, booleanValue, comparisonValue, comparisonOperator]);

  // Fonction utilitaire pour formater les valeurs avec indentation
  const formatValue = useCallback((value) => {
    return JSON.stringify(value, null, 2);
  }, []);

  // Fonction utilitaire pour formater la valeur booléenne
  const formatBooleanValue = useCallback((value) => {
    if (value === null) return 'Tous';
    return value ? 'Vrai' : 'Faux';
  }, []);

  // Configuration des cartes mémorisée
  const filterCards = useMemo(() => [
    {
      id: 'date-range',
      title: 'Filtre de plage de dates',
      component: (
        <DateRangeFilter
          value={dateRange}
          onChange={handleDateRangeChange}
          label="Sélectionnez une période"
        />
      ),
      value: dateRange,
      span: 1
    },
    {
      id: 'number-range',
      title: 'Filtre de plage numérique',
      component: (
        <NumberRangeFilter
          value={numberRange}
          onChange={handleNumberRangeChange}
          label="Budget (€)"
          currency={true}
        />
      ),
      value: numberRange,
      span: 1
    },
    {
      id: 'boolean',
      title: 'Filtre booléen',
      component: (
        <BooleanFilter
          value={booleanValue}
          onChange={handleBooleanChange}
          label="Projet terminé ?"
          trueLabel="Terminé"
          falseLabel="En cours"
        />
      ),
      value: booleanValue,
      span: 1
    },
    {
      id: 'comparison',
      title: 'Filtre de comparaison',
      component: (
        <ComparisonFilter
          value={comparisonValue}
          operator={comparisonOperator}
          onChange={handleComparisonValueChange}
          onOperatorChange={handleComparisonOperatorChange}
          label="Nom du projet"
        />
      ),
      value: { operator: comparisonOperator, value: comparisonValue },
      span: 1
    },
    {
      id: 'multiple-selector',
      title: 'Sélecteur multiple',
      component: (
        <MultipleSelector
          options={demoOptions}
          onChange={handleMultipleSelectionChange}
          placeholder="Choisissez plusieurs options..."
        />
      ),
      value: multipleSelection,
      span: 2
    }
  ], [
    dateRange, numberRange, booleanValue, comparisonValue, comparisonOperator, multipleSelection,
    handleDateRangeChange, handleNumberRangeChange, handleBooleanChange, 
    handleComparisonValueChange, handleComparisonOperatorChange, handleMultipleSelectionChange,
    demoOptions
  ]);

  // Résumé des valeurs mémorisé
  const summary = useMemo(() => ({
    date: `${dateRange.start || 'Non définie'} → ${dateRange.end || 'Non définie'}`,
    amount: `${numberRange.min ?? 'Aucun'} → ${numberRange.max ?? 'Aucun'}`,
    boolean: formatBooleanValue(booleanValue),
    comparison: `${comparisonOperator} "${comparisonValue}"`,
    selection: `${multipleSelection.length} élément(s)`
  }), [dateRange, numberRange, booleanValue, comparisonOperator, comparisonValue, multipleSelection, formatBooleanValue]);

  return (
    <div className={`p-6 max-w-4xl mx-auto ${className}`} role="main" aria-label="Démonstration des filtres avancés">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Démonstration des Filtres Avancés</h1>
        <p className="text-base-content/60 mt-2">
          Interface de test pour tous les types de filtres disponibles
        </p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" role="group" aria-label="Filtres disponibles">
        {filterCards.map((card) => (
          <section
            key={card.id}
            className={`card bg-base-100 shadow-xl ${card.span === 2 ? 'md:col-span-2' : ''}`}
            aria-labelledby={`${card.id}-title`}
          >
            <div className="card-body">
              <h2 id={`${card.id}-title`} className="card-title">
                {card.title}
              </h2>
              
              <div className="space-y-4">
                {card.component}
                
                <details className="collapse collapse-arrow bg-base-200 rounded-lg">
                  <summary className="collapse-title text-sm font-medium cursor-pointer">
                    Valeur actuelle
                  </summary>
                  <div className="collapse-content">
                    <pre className="text-xs text-base-content/60 overflow-auto bg-base-300 p-2 rounded">
                      {formatValue(card.value)}
                    </pre>
                  </div>
                </details>
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Résumé optimisé */}
      <section 
        className="card bg-primary text-primary-content mt-6"
        aria-labelledby="summary-title"
      >
        <div className="card-body">
          <h2 id="summary-title" className="card-title">
            Résumé des valeurs
          </h2>
          <div className="text-sm space-y-1" role="list">
            <div role="listitem">
              <strong>Date:</strong> {summary.date}
            </div>
            <div role="listitem">
              <strong>Montant:</strong> {summary.amount}
            </div>
            <div role="listitem">
              <strong>Booléen:</strong> {summary.boolean}
            </div>
            <div role="listitem">
              <strong>Comparaison:</strong> {summary.comparison}
            </div>
            <div role="listitem">
              <strong>Sélection multiple:</strong> {summary.selection}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Validation des types avec PropTypes
FilterDemo.propTypes = {
  className: PropTypes.string,
  onFiltersChange: PropTypes.func
};

// Valeurs par défaut
FilterDemo.defaultProps = {
  className: '',
  onFiltersChange: null
};

// Export avec mémorisation pour optimiser les performances
export default React.memo(FilterDemo); 