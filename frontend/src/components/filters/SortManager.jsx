import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FiArrowUp, FiArrowDown, FiTrash2, FiPlus, FiList } from 'react-icons/fi';

function SortManager({ 
  sorting = [], 
  availableFields = [],
  onAddSort, 
  onRemoveSort, 
  onClearSorting,
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newSortField, setNewSortField] = useState('');

  const handleAddSort = () => {
    if (newSortField && !sorting.find(s => s.field === newSortField)) {
      onAddSort(newSortField, 'asc');
      setNewSortField('');
    }
  };

  const handleToggleDirection = (field) => {
    const currentSort = sorting.find(s => s.field === field);
    if (currentSort) {
      const newDirection = currentSort.direction === 'asc' ? 'desc' : 'asc';
      onAddSort(field, newDirection);
    }
  };

  const getFieldLabel = (fieldValue) => {
    const field = availableFields.find(f => f.value === fieldValue);
    return field ? field.label : fieldValue;
  };

  const availableFieldsForSort = availableFields.filter(
    field => !sorting.find(s => s.field === field.value)
  );

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => setIsOpen(!isOpen)}
        title="Gérer le tri"
      >
        <FiList className="w-4 h-4" />
        Tri ({sorting.length})
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                setIsOpen(false);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Fermer le gestionnaire de tri"
          />
          
          <div className="absolute right-0 top-full mt-2 z-20 w-80 bg-base-100 border border-base-300 rounded-lg shadow-lg">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Gestion du tri</h3>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setIsOpen(false)}
                >
                  ×
                </button>
              </div>

              {availableFieldsForSort.length > 0 && (
                <div className="mb-4 p-3 bg-base-200 rounded-lg">
                  <label className="label-text text-sm font-medium mb-2 block" htmlFor="sort-select">
                    Ajouter un tri
                  </label>
                  <div className="flex gap-2">
                    <select
                      className="select select-bordered select-sm flex-1"
                      value={newSortField}
                      onChange={(e) => setNewSortField(e.target.value)}
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
                    >
                      <FiPlus />
                    </button>
                  </div>
                </div>
              )}

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
                    {sorting
                      .toSorted((a, b) => a.priority - b.priority)
                      .map((sort, index) => (
                        <div
                          key={sort.field}
                          className="flex items-center gap-3 p-2 bg-base-200 rounded border"
                        >
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
                            onClick={() => handleToggleDirection(sort.field)}
                            title={`Actuellement: ${sort.direction === 'asc' ? 'Croissant' : 'Décroissant'}`}
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
                            onClick={() => onRemoveSort(sort.field)}
                            title="Supprimer ce tri"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      ))}
                  </>
                )}
              </div>

              {sorting.length > 0 && (
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-base-300">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline btn-error"
                    onClick={onClearSorting}
                  >
                    Tout effacer
                  </button>
                  
                  <div className="text-xs text-base-content/60">
                    {sorting.length} tri(s) actif(s)
                  </div>
                </div>
              )}

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
}

SortManager.propTypes = {
  sorting: PropTypes.arrayOf(PropTypes.shape({
    field: PropTypes.string.isRequired,
    direction: PropTypes.oneOf(['asc', 'desc']).isRequired,
    priority: PropTypes.number.isRequired
  })).isRequired,
  availableFields: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired
  })).isRequired,
  onAddSort: PropTypes.func.isRequired,
  onRemoveSort: PropTypes.func.isRequired,
  onClearSorting: PropTypes.func.isRequired,
  className: PropTypes.string
};

export default SortManager; 