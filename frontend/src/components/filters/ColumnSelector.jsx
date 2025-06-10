import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FiEye, FiEyeOff, FiGrid, FiCheck } from 'react-icons/fi';

function ColumnSelector({ 
  availableColumns = [], 
  visibleColumns = [], 
  onChange,
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleColumnToggle = (columnId) => {
    const newVisibleColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    
    onChange(newVisibleColumns);
  };

  const selectAll = () => {
    onChange(availableColumns.map(col => col.id));
  };

  const selectNone = () => {
    onChange([]);
  };

  const visibleCount = visibleColumns.length;
  const totalCount = availableColumns.length;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => setIsOpen(!isOpen)}
        title="Gérer les colonnes visibles"
      >
        <FiGrid className="w-4 h-4" />
        Colonnes ({visibleCount}/{totalCount})
      </button>

      {isOpen && (
        <>
          {/* Overlay pour fermer */}
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
            aria-label="Fermer le sélecteur de colonnes"
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-20 w-80 bg-base-100 border border-base-300 rounded-lg shadow-lg">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Colonnes visibles</h3>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={selectAll}
                    title="Tout sélectionner"
                  >
                    Tout
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={selectNone}
                    title="Tout désélectionner"
                  >
                    Aucun
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="text-xs text-base-content/60 mb-3">
                {visibleCount} sur {totalCount} colonnes sélectionnées
              </div>

              {/* Column List */}
              <div className="max-h-60 overflow-y-auto space-y-1">
                {availableColumns.map(column => {
                  const isVisible = visibleColumns.includes(column.id);
                  
                  return (
                    <label
                      key={column.id}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-base-200 transition-colors ${
                        isVisible ? 'bg-primary/10' : ''
                      }`}
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isVisible}
                          onChange={() => handleColumnToggle(column.id)}
                        />
                        <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                          isVisible 
                            ? 'bg-primary border-primary text-primary-content' 
                            : 'border-base-300'
                        }`}>
                          {isVisible && <FiCheck className="w-3 h-3" />}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{column.label}</div>
                        {column.description && (
                          <div className="text-xs text-base-content/60 truncate">
                            {column.description}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-base-content/40">
                        {isVisible ? <FiEye /> : <FiEyeOff />}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-base-300">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setIsOpen(false)}
                >
                  Fermer
                </button>
                
                <div className="text-xs text-base-content/60">
                  {visibleCount === 0 && "⚠️ Aucune colonne sélectionnée"}
                  {visibleCount === totalCount && "✅ Toutes les colonnes"}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

ColumnSelector.propTypes = {
  availableColumns: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string
  })).isRequired,
  visibleColumns: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string
};

export default ColumnSelector; 