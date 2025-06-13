import React, { useState, useCallback, useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import { FiArrowUp, FiArrowDown, FiTrash2, FiPlus, FiList } from 'react-icons/fi';

/**
 * Composant SortManager - Gestion avancée du tri avec priorités multiples
 * Optimisé pour les performances et l'accessibilité
 */
const SortManager = memo(function SortManager({ 
  sorting = [], 
  availableFields = [],
  onAddSort, 
  onRemoveSort, 
  onClearSorting,
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newSortField, setNewSortField] = useState('');

  // Vérification de sécurité des callbacks
  const safeOnAddSort = useCallback((field, direction) => {
    if (typeof onAddSort === 'function') {
      onAddSort(field, direction);
    }
  }, [onAddSort]);

  const safeOnRemoveSort = useCallback((field) => {
    if (typeof onRemoveSort === 'function') {
      onRemoveSort(field);
    }
  }, [onRemoveSort]);

  const safeOnClearSorting = useCallback(() => {
    if (typeof onClearSorting === 'function') {
      onClearSorting();
    }
  }, [onClearSorting]);

  // Handlers optimisés avec useCallback
  const handleAddSort = useCallback(() => {
    if (newSortField && !sorting.find(s => s.field === newSortField)) {
      safeOnAddSort(newSortField, 'asc');
      setNewSortField('');
    }
  }, [newSortField, sorting, safeOnAddSort]);

  const handleToggleDirection = useCallback((field) => {
    const currentSort = sorting.find(s => s.field === field);
    if (currentSort) {
      const newDirection = currentSort.direction === 'asc' ? 'desc' : 'asc';
      safeOnAddSort(field, newDirection);
    }
  }, [sorting, safeOnAddSort]);

  const handleCloseManager = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleToggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleFieldChange = useCallback((e) => {
    setNewSortField(e.target.value);
  }, []);

  // Fonction utilitaire pour obtenir le label d'un champ
  const getFieldLabel = useCallback((fieldValue) => {
    const field = availableFields.find(f => f.value === fieldValue);
    return field ? field.label : fieldValue;
  }, [availableFields]);

  // Calculs mémorisés pour éviter les recalculs inutiles
  const availableFieldsForSort = useMemo(() => {
    return availableFields.filter(
      field => !sorting.find(s => s.field === field.value)
    );
  }, [availableFields, sorting]);

  // Tri des éléments mémorisé (compatible avec tous les navigateurs)
  const sortedSorting = useMemo(() => {
    return [...sorting].sort((a, b) => a.priority - b.priority);
  }, [sorting]);

  // Gestion des événements clavier pour l'overlay
  const handleOverlayKeyDown = useCallback((e) => {
    // Seule la touche Escape ferme le gestionnaire
    if (e.key === 'Escape') {
      handleCloseManager();
    }
  }, [handleCloseManager]);

  const selectId = 'sort-field-select';

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={handleToggleOpen}
        title="Gérer le tri"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <FiList className="w-4 h-4" />
        Tri ({sorting.length})
      </button>

      {isOpen && (
        <>
          {/* Overlay pour fermer en cliquant à l'extérieur */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={handleCloseManager}
            onKeyDown={handleOverlayKeyDown}
            role="button"
            tabIndex={0}
            aria-label="Fermer le gestionnaire de tri"
          />
          
          {/* Panneau principal du gestionnaire */}
          <div className="absolute right-0 top-full mt-2 z-20 w-80 bg-base-100 border border-base-300 rounded-lg shadow-lg">
            <div className="p-4">
              {/* En-tête */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Gestion du tri</h3>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={handleCloseManager}
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>

              {/* Section d'ajout de tri */}
              {availableFieldsForSort.length > 0 && (
                <div className="mb-4 p-3 bg-base-200 rounded-lg">
                  <label 
                    className="label-text text-sm font-medium mb-2 block" 
                    htmlFor={selectId}
                  >
                    Ajouter un tri
                  </label>
                  <div className="flex gap-2">
                    <select
                      id={selectId}
                      className="select select-bordered select-sm flex-1"
                      value={newSortField}
                      onChange={handleFieldChange}
                      aria-label="Choisir un champ à trier"
                    >
                      <option value="">Choisir un champ</option>
                      {availableFieldsForSort.map(field => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={handleAddSort}
                      disabled={!newSortField}
                      aria-label="Ajouter le tri"
                    >
                      <FiPlus />
                    </button>
                  </div>
                </div>
              )}

              {/* Liste des tris actifs */}
              <div className="space-y-2">
                {sorting.length === 0 ? (
                  <div className="text-center py-8 text-base-content/50">
                    <FiList className="w-8 h-8 mx-auto mb-2" />
                    <p>Aucun tri configuré</p>
                    <p className="text-xs">Ajoutez un champ à trier</p>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-base-content/60 mb-2">
                      Ordre de priorité (du plus important au moins important) :
                    </div>
                    {sortedSorting.map((sort, index) => (
                      <SortItem
                        key={sort.field}
                        sort={sort}
                        index={index}
                        getFieldLabel={getFieldLabel}
                        onToggleDirection={handleToggleDirection}
                        onRemove={safeOnRemoveSort}
                      />
                    ))}
                  </>
                )}
              </div>

              {/* Actions globales */}
              {sorting.length > 0 && (
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-base-300">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline btn-error"
                    onClick={safeOnClearSorting}
                  >
                    Tout effacer
                  </button>
                  
                  <div className="text-xs text-base-content/60">
                    {sorting.length} tri(s) actif(s)
                  </div>
                </div>
              )}

              {/* Aide utilisateur */}
              <div className="mt-3 p-2 bg-info/10 rounded text-xs text-info-content">
                💡 Le tri multiple s'applique par ordre de priorité. 
                Le premier tri est le plus important.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

/**
 * Composant SortItem - Élément de tri individuel
 * Séparé pour améliorer la lisibilité et les performances
 */
const SortItem = memo(function SortItem({ 
  sort, 
  index, 
  getFieldLabel, 
  onToggleDirection, 
  onRemove 
}) {
  const handleToggleDirection = useCallback(() => {
    onToggleDirection(sort.field);
  }, [sort.field, onToggleDirection]);

  const handleRemove = useCallback(() => {
    onRemove(sort.field);
  }, [sort.field, onRemove]);

  return (
    <div className="flex items-center gap-3 p-2 bg-base-200 rounded border">
      <div className="w-6 h-6 bg-primary text-primary-content rounded-full flex items-center justify-center text-xs font-bold">
        {index + 1}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {getFieldLabel(sort.field)}
        </div>
        <div className="text-xs text-base-content/60">
          {sort.field}
        </div>
      </div>
      
      <button
        type="button"
        className={`btn btn-xs ${
          sort.direction === 'asc' ? 'btn-success' : 'btn-warning'
        }`}
        onClick={handleToggleDirection}
        title={`Actuellement: ${sort.direction === 'asc' ? 'Croissant' : 'Décroissant'}`}
        aria-label={`Changer la direction de tri, actuellement ${sort.direction === 'asc' ? 'croissant' : 'décroissant'}`}
      >
        {sort.direction === 'asc' ? (
          <>
            <FiArrowUp className="w-3 h-3" />
            <span className="hidden sm:inline ml-1">Asc</span>
          </>
        ) : (
          <>
            <FiArrowDown className="w-3 h-3" />
            <span className="hidden sm:inline ml-1">Desc</span>
          </>
        )}
      </button>
      
      <button
        type="button"
        className="btn btn-ghost btn-xs text-error"
        onClick={handleRemove}
        title="Supprimer ce tri"
        aria-label={`Supprimer le tri sur ${getFieldLabel(sort.field)}`}
      >
        <FiTrash2 />
      </button>
    </div>
  );
});

// PropTypes optimisés et cohérents
SortManager.propTypes = {
  sorting: PropTypes.arrayOf(PropTypes.shape({
    field: PropTypes.string.isRequired,
    direction: PropTypes.oneOf(['asc', 'desc']).isRequired,
    priority: PropTypes.number.isRequired
  })),
  availableFields: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired
  })),
  onAddSort: PropTypes.func,
  onRemoveSort: PropTypes.func,
  onClearSorting: PropTypes.func,
  className: PropTypes.string
};

SortItem.propTypes = {
  sort: PropTypes.shape({
    field: PropTypes.string.isRequired,
    direction: PropTypes.oneOf(['asc', 'desc']).isRequired,
    priority: PropTypes.number.isRequired
  }).isRequired,
  index: PropTypes.number.isRequired,
  getFieldLabel: PropTypes.func.isRequired,
  onToggleDirection: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired
};

export default SortManager; 