import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FiEye, FiEyeOff, FiGrid, FiCheck } from 'react-icons/fi';

function ColumnSelector({ 
  availableColumns = [], 
  visibleColumns = [], 
  onChange,
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  // Mémorisation des statistiques pour éviter les recalculs
  const stats = useMemo(() => ({
    visibleCount: visibleColumns.length,
    totalCount: availableColumns.length
  }), [visibleColumns.length, availableColumns.length]);

  // Mémorisation des callbacks pour éviter les re-renders inutiles
  const handleColumnToggle = useCallback((columnId) => {
    const newVisibleColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    
    onChange(newVisibleColumns);
  }, [visibleColumns, onChange]);

  const selectAll = useCallback(() => {
    onChange(availableColumns.map(col => col.id));
  }, [availableColumns, onChange]);

  const selectNone = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    // Remettre le focus sur le bouton principal après fermeture
    setTimeout(() => buttonRef.current?.focus(), 0);
  }, []);

  const toggleDropdown = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Gestion globale de la touche Échap
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      return () => document.removeEventListener('keydown', handleEscKey);
    }
  }, [isOpen, closeDropdown]);

  // Gestion du focus lors de l'ouverture
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      // Focus sur le premier élément focusable du dropdown
      const firstFocusable = dropdownRef.current.querySelector('button, input, [tabindex]');
      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 0);
      }
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-outline btn-sm"
        onClick={toggleDropdown}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Gérer les colonnes visibles"
      >
        <FiGrid className="w-4 h-4" />
        Colonnes ({stats.visibleCount}/{stats.totalCount})
      </button>

      {isOpen && (
        <>
          {/* Overlay pour fermer - Amélioration de l'accessibilité */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={closeDropdown}
            aria-hidden="true"
          />
          
          {/* Dropdown */}
          <div 
            ref={dropdownRef}
            className="absolute right-0 top-full mt-2 z-20 w-80 bg-base-100 border border-base-300 rounded-lg shadow-lg"
            role="dialog"
            aria-labelledby="column-selector-title"
          >
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 id="column-selector-title" className="font-medium">Colonnes visibles</h3>
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
                {stats.visibleCount} sur {stats.totalCount} colonnes sélectionnées
              </div>

              {/* Column List */}
              <div className="max-h-60 overflow-y-auto space-y-1" role="group" aria-label="Liste des colonnes">
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
                          aria-describedby={column.description ? `desc-${column.id}` : undefined}
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
                          <div 
                            id={`desc-${column.id}`}
                            className="text-xs text-base-content/60 truncate"
                          >
                            {column.description}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-base-content/40" aria-hidden="true">
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
                  onClick={closeDropdown}
                >
                  Fermer
                </button>
                
                <div className="text-xs text-base-content/60" aria-live="polite">
                  {stats.visibleCount === 0 && "⚠️ Aucune colonne sélectionnée"}
                  {stats.visibleCount === stats.totalCount && "✅ Toutes les colonnes"}
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