import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FiSave, FiDatabase, FiTrash2, FiClock, FiFilter } from 'react-icons/fi';

function PresetManager({ 
  presets = [], 
  onLoadPreset, 
  onDeletePreset,
  onLoadPresetsFromStorage,
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Charger les presets au montage du composant
    onLoadPresetsFromStorage();
  }, [onLoadPresetsFromStorage]);

  const handleLoadPreset = (preset) => {
    onLoadPreset(preset);
    setIsOpen(false);
  };

  const handleDeletePreset = (e, presetId) => {
    e.stopPropagation();
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce preset ?')) {
      onDeletePreset(presetId);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPresetSummary = (preset) => {
    const filterCount = preset.filters?.length || 0;
    const sortCount = preset.sorting?.length || 0;
    const columnCount = preset.visibleColumns?.length || 0;
    
    const parts = [];
    if (filterCount > 0) parts.push(`${filterCount} filtre(s)`);
    if (sortCount > 0) parts.push(`${sortCount} tri(s)`);
    if (columnCount > 0) parts.push(`${columnCount} colonne(s)`);
    
    return parts.length > 0 ? parts.join(' • ') : 'Preset vide';
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => setIsOpen(!isOpen)}
        title="Gérer les presets"
      >
        <FiDatabase className="w-4 h-4" />
        Mes modèles ({presets.length})
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
            aria-label="Fermer le gestionnaire de presets"
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-20 w-96 bg-base-100 border border-base-300 rounded-lg shadow-lg">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Mes modèles de filtres</h3>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setIsOpen(false)}
                >
                  ×
                </button>
              </div>

              {/* Preset List */}
              <div className="max-h-80 overflow-y-auto space-y-2">
                {presets.length === 0 ? (
                  <div className="text-center py-8 text-base-content/50">
                    <FiSave className="w-8 h-8 mx-auto mb-2" />
                    <p>Aucun modèle sauvegardé</p>
                    <p className="text-xs">Configurez des filtres et sauvegardez-les comme modèle</p>
                  </div>
                ) : (
                  presets.map(preset => (
                    <div
                      key={preset.id}
                      className="border border-base-300 rounded-lg p-3 hover:bg-base-200 cursor-pointer transition-colors"
                      onClick={() => handleLoadPreset(preset)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleLoadPreset(preset);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Charger le preset ${preset.name}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          {/* Nom du preset */}
                          <div className="font-medium truncate">{preset.name}</div>
                          
                          {/* Description si disponible */}
                          {preset.description && (
                            <div className="text-sm text-base-content/70 truncate mt-1">
                              {preset.description}
                            </div>
                          )}
                          
                          {/* Résumé */}
                          <div className="text-xs text-base-content/60 mt-2 flex items-center gap-2">
                            <FiFilter className="w-3 h-3" />
                            {getPresetSummary(preset)}
                          </div>
                          
                          {/* Date de création */}
                          <div className="text-xs text-base-content/50 mt-1 flex items-center gap-1">
                            <FiClock className="w-3 h-3" />
                            {formatDate(preset.createdAt)}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="ml-2">
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error"
                            onClick={(e) => handleDeletePreset(e, preset.id)}
                            title="Supprimer ce preset"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {presets.length > 0 && (
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-base-300">
                  <div className="text-xs text-base-content/60">
                    Cliquez sur un modèle pour l'appliquer
                  </div>
                  <div className="text-xs text-base-content/60">
                    {presets.length} modèle(s)
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

PresetManager.propTypes = {
  presets: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    filters: PropTypes.array,
    sorting: PropTypes.array,
    visibleColumns: PropTypes.array,
    createdAt: PropTypes.string.isRequired
  })).isRequired,
  onLoadPreset: PropTypes.func.isRequired,
  onDeletePreset: PropTypes.func.isRequired,
  onLoadPresetsFromStorage: PropTypes.func.isRequired,
  className: PropTypes.string
};

export default PresetManager; 