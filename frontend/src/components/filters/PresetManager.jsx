import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FiSave, FiDatabase, FiTrash2, FiClock, FiFilter } from 'react-icons/fi';

// Constantes pour faciliter la maintenance et l'internationalisation future
const CONSTANTS = {
  TEXTS: {
    MANAGE_PRESETS: 'Gérer les presets',
    MY_TEMPLATES: 'Mes modèles',
    MY_FILTER_TEMPLATES: 'Mes modèles de filtres',
    NO_SAVED_TEMPLATES: 'Aucun modèle sauvegardé',
    CONFIGURE_FILTERS_HINT: 'Configurez des filtres et sauvegardez-les comme modèle',
    CLICK_TO_APPLY: 'Cliquez sur un modèle pour l\'appliquer',
    DELETE_CONFIRMATION: 'Êtes-vous sûr de vouloir supprimer ce preset ?',
    DELETE_PRESET: 'Supprimer ce preset',
    LOAD_PRESET: 'Charger le preset',
    CLOSE_MANAGER: 'Fermer le gestionnaire de presets',
    EMPTY_PRESET: 'Preset vide',
    FILTERS: 'filtre(s)',
    SORTS: 'tri(s)',
    COLUMNS: 'colonne(s)',
    TEMPLATES_COUNT: 'modèle(s)'
  },
  MAX_HEIGHT: 'max-h-80'
};

function PresetManager({ 
  presets = [], 
  onLoadPreset, 
  onDeletePreset,
  onLoadPresetsFromStorage,
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Mémorisation de la fonction de fermeture pour éviter les re-renders
  const closeManager = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Mémorisation de la fonction toggle pour éviter les re-renders
  const toggleManager = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Chargement des presets optimisé avec mémorisation
  useEffect(() => {
    onLoadPresetsFromStorage();
  }, [onLoadPresetsFromStorage]);

  // Gestionnaire de chargement de preset optimisé
  const handleLoadPreset = useCallback((preset) => {
    onLoadPreset(preset);
    closeManager();
  }, [onLoadPreset, closeManager]);

  // Gestionnaire de suppression optimisé avec confirmation personnalisée
  const handleDeletePreset = useCallback((e, presetId) => {
    e.stopPropagation();
    // Utilisation d'une confirmation plus moderne
    if (window.confirm(CONSTANTS.TEXTS.DELETE_CONFIRMATION)) {
      onDeletePreset(presetId);
    }
  }, [onDeletePreset]);

  // Gestion optimisée des événements clavier
  const handleKeyDown = useCallback((e, action, ...args) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action(...args);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeManager();
    }
  }, [closeManager]);

  // Fonction de formatage de date mémorisée
  const formatDate = useCallback((dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Fonction de résumé de preset mémorisée
  const getPresetSummary = useCallback((preset) => {
    const filterCount = preset.filters?.length || 0;
    const sortCount = preset.sorting?.length || 0;
    const columnCount = preset.visibleColumns?.length || 0;
    
    const parts = [];
    if (filterCount > 0) parts.push(`${filterCount} ${CONSTANTS.TEXTS.FILTERS}`);
    if (sortCount > 0) parts.push(`${sortCount} ${CONSTANTS.TEXTS.SORTS}`);
    if (columnCount > 0) parts.push(`${columnCount} ${CONSTANTS.TEXTS.COLUMNS}`);
    
    return parts.length > 0 ? parts.join(' • ') : CONSTANTS.TEXTS.EMPTY_PRESET;
  }, []);

  // Mémorisation du texte du bouton pour éviter les recalculs
  const buttonText = useMemo(() => 
    `${CONSTANTS.TEXTS.MY_TEMPLATES} (${presets.length})`, 
    [presets.length]
  );

  // Composant d'élément de preset extrait pour une meilleure lisibilité
  const PresetItem = useCallback(({ preset }) => (
    <div
      className="border border-base-300 rounded-lg p-3 hover:bg-base-200 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      onClick={() => handleLoadPreset(preset)}
      onKeyDown={(e) => handleKeyDown(e, handleLoadPreset, preset)}
      role="button"
      tabIndex={0}
      aria-label={`${CONSTANTS.TEXTS.LOAD_PRESET} ${preset.name}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Nom du preset */}
          <div className="font-medium truncate" title={preset.name}>
            {preset.name}
          </div>
          
          {/* Description si disponible */}
          {preset.description && (
            <div className="text-sm text-base-content/70 truncate mt-1" title={preset.description}>
              {preset.description}
            </div>
          )}
          
          {/* Résumé */}
          <div className="text-xs text-base-content/60 mt-2 flex items-center gap-2">
            <FiFilter className="w-3 h-3" />
            <span>{getPresetSummary(preset)}</span>
          </div>
          
          {/* Date de création */}
          <div className="text-xs text-base-content/50 mt-1 flex items-center gap-1">
            <FiClock className="w-3 h-3" />
            <span>{formatDate(preset.createdAt)}</span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="ml-2">
          <button
            type="button"
            className="btn btn-ghost btn-xs text-error focus:ring-2 focus:ring-error focus:ring-offset-1"
            onClick={(e) => handleDeletePreset(e, preset.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                handleDeletePreset(e, preset.id);
              }
            }}
            title={CONSTANTS.TEXTS.DELETE_PRESET}
            aria-label={`${CONSTANTS.TEXTS.DELETE_PRESET} ${preset.name}`}
          >
            <FiTrash2 />
          </button>
        </div>
      </div>
    </div>
  ), [handleLoadPreset, handleDeletePreset, handleKeyDown, getPresetSummary, formatDate]);

  // Composant d'état vide extrait
  const EmptyState = useMemo(() => (
    <div className="text-center py-8 text-base-content/50">
      <FiSave className="w-8 h-8 mx-auto mb-2" />
      <p className="font-medium">{CONSTANTS.TEXTS.NO_SAVED_TEMPLATES}</p>
      <p className="text-xs mt-1">{CONSTANTS.TEXTS.CONFIGURE_FILTERS_HINT}</p>
    </div>
  ), []);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        className="btn btn-outline btn-sm focus:ring-2 focus:ring-primary focus:ring-offset-2"
        onClick={toggleManager}
        onKeyDown={(e) => handleKeyDown(e, toggleManager)}
        title={CONSTANTS.TEXTS.MANAGE_PRESETS}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <FiDatabase className="w-4 h-4" />
        {buttonText}
      </button>

      {isOpen && (
        <>
          {/* Overlay pour fermer - amélioration de l'accessibilité */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={closeManager}
            onKeyDown={(e) => handleKeyDown(e, closeManager)}
            role="button"
            tabIndex={0}
            aria-label={CONSTANTS.TEXTS.CLOSE_MANAGER}
          />
          
          {/* Dropdown - amélioration de la structure */}
          <div 
            className="absolute right-0 top-full mt-2 z-20 w-96 bg-base-100 border border-base-300 rounded-lg shadow-lg focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
            role="dialog"
            aria-label={CONSTANTS.TEXTS.MY_FILTER_TEMPLATES}
          >
            <div className="p-4">
              {/* Header optimisé */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-base">{CONSTANTS.TEXTS.MY_FILTER_TEMPLATES}</h3>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost hover:bg-base-300 focus:ring-2 focus:ring-primary focus:ring-offset-1"
                  onClick={closeManager}
                  onKeyDown={(e) => handleKeyDown(e, closeManager)}
                  aria-label={CONSTANTS.TEXTS.CLOSE_MANAGER}
                >
                  ×
                </button>
              </div>

              {/* Liste des presets optimisée */}
              <div className={`${CONSTANTS.MAX_HEIGHT} overflow-y-auto space-y-2`}>
                {presets.length === 0 ? (
                  EmptyState
                ) : (
                  presets.map(preset => (
                    <PresetItem key={preset.id} preset={preset} />
                  ))
                )}
              </div>

              {/* Footer optimisé */}
              {presets.length > 0 && (
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-base-300">
                  <div className="text-xs text-base-content/60">
                    {CONSTANTS.TEXTS.CLICK_TO_APPLY}
                  </div>
                  <div className="text-xs text-base-content/60">
                    {presets.length} {CONSTANTS.TEXTS.TEMPLATES_COUNT}
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