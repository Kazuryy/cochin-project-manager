import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FiX, FiDownload, FiDatabase, FiCheck } from 'react-icons/fi';

const ExportConfigModal = ({ isOpen, onClose, onExport, projectCount }) => {
  // ✅ OPTIMISATION : Colonnes disponibles mémorisées pour éviter les recréations
  const availableColumns = useMemo(() => [
    { id: 'nom_projet', label: 'Nom du projet', description: 'Titre du projet' },
    { id: 'description', label: 'Description', description: 'Description complète' },
    { id: 'numero_projet', label: 'Numéro projet', description: 'Référence unique' },
    { id: 'type_projet', label: 'Type de projet', description: 'Catégorie' },
    { id: 'sous_type_projet', label: 'Sous-type', description: 'Sous-catégorie' },
    { id: 'equipe', label: 'Équipe', description: 'Équipe assignée', default: true },
    { id: 'contact_principal', label: 'Contact principal', description: 'Responsable du projet', default: true },
    { id: 'email_contact', label: 'Email contact', description: 'Email du contact' },
    { id: 'devis_actifs', label: 'Devis actifs', description: 'Numéros des devis en cours', default: true },
    { id: 'statut', label: 'Statut', description: 'État actuel' },
    { id: 'progression', label: 'Progression (%)', description: 'Pourcentage d\'avancement' },
    { id: 'echeance_prochaine', label: 'Échéance prochaine', description: 'Prochaine deadline' },
    { id: 'date_creation', label: 'Date création', description: 'Date de création du projet' }
  ], []);

  // ✅ OPTIMISATION : Colonnes par défaut mémorisées
  const defaultColumns = useMemo(() => 
    availableColumns
      .filter(col => col.default)
      .map(col => col.id),
    [availableColumns]
  );

  // État des colonnes sélectionnées
  const [selectedColumns, setSelectedColumns] = useState(defaultColumns);

  // ✅ CORRECTION : useEffect avec les bonnes dépendances
  useEffect(() => {
    if (isOpen) {
      setSelectedColumns(defaultColumns);
    }
  }, [isOpen, defaultColumns]);

  // ✅ OPTIMISATION : Handlers mémorisés avec useCallback
  const toggleColumn = useCallback((columnId) => {
    setSelectedColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedColumns(availableColumns.map(col => col.id));
  }, [availableColumns]);

  const selectNone = useCallback(() => {
    setSelectedColumns([]);
  }, []);

  const resetToDefault = useCallback(() => {
    setSelectedColumns(defaultColumns);
  }, [defaultColumns]);

  // ✅ AMÉLIORATION : Gestion d'erreur plus moderne avec callback
  const handleExport = useCallback(() => {
    if (selectedColumns.length === 0) {
      // ✅ AMÉLIORATION : Meilleure UX - le bouton est désactivé donc cette condition ne devrait pas arriver
      console.warn('Aucune colonne sélectionnée pour l\'export');
      return;
    }
    onExport(selectedColumns);
    onClose();
  }, [selectedColumns, onExport, onClose]);

  // ✅ OPTIMISATION : Gestion des événements clavier pour l'accessibilité
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // ✅ OPTIMISATION : Early return optimisé
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      aria-describedby="export-modal-description"
    >
      <div className="bg-base-100 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-base-300">
          <div>
            <h2 id="export-modal-title" className="text-2xl font-bold flex items-center">
              <FiDatabase className="mr-3 text-primary" aria-hidden="true" />
              Configuration d'export TSV
            </h2>
            <p id="export-modal-description" className="text-base-content/70 mt-1">
              Sélectionnez les colonnes à inclure dans l'export ({projectCount} projets)
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="btn btn-ghost btn-sm"
            aria-label="Fermer la modal"
          >
            <FiX className="text-xl" aria-hidden="true" />
          </button>
        </div>

        {/* Actions rapides */}
        <div className="p-6 border-b border-base-300">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Actions de sélection">
            <button 
              onClick={selectAll}
              className="btn btn-sm btn-outline"
              type="button"
            >
              Tout sélectionner
            </button>
            <button 
              onClick={selectNone}
              className="btn btn-sm btn-outline"
              type="button"
            >
              Tout désélectionner
            </button>
            <button 
              onClick={resetToDefault}
              className="btn btn-sm btn-primary"
              type="button"
            >
              Par défaut
            </button>
          </div>
          <div className="text-sm text-base-content/60 mt-2" aria-live="polite">
            {selectedColumns.length} colonne(s) sélectionnée(s)
          </div>
        </div>

        {/* Liste des colonnes */}
        <div className="p-6">
          <fieldset>
            <legend className="sr-only">Sélection des colonnes à exporter</legend>
            <div className="space-y-3">
              {availableColumns.map((column) => {
                const isSelected = selectedColumns.includes(column.id);
                const isDefault = column.default;
                
                return (
                  <div 
                    key={column.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/10' 
                        : 'border-base-300 hover:border-base-400'
                    }`}
                    onClick={() => toggleColumn(column.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleColumn(column.id);
                      }
                    }}
                    aria-pressed={isSelected}
                    aria-describedby={`${column.id}-description`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div 
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected 
                              ? 'border-primary bg-primary text-white' 
                              : 'border-base-300'
                          }`}
                          aria-hidden="true"
                        >
                          {isSelected && <FiCheck className="w-3 h-3" />}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {column.label}
                            {isDefault && (
                              <span className="badge badge-primary badge-xs">Par défaut</span>
                            )}
                          </div>
                          <div 
                            id={`${column.id}-description`}
                            className="text-sm text-base-content/60"
                          >
                            {column.description}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-base-300">
          <div className="text-sm text-base-content/60">
            📋 Format TSV avec tabulations comme séparateurs
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="btn btn-outline"
              type="button"
            >
              Annuler
            </button>
            <button
              onClick={handleExport}
              className="btn btn-success gap-2"
              disabled={selectedColumns.length === 0}
              type="button"
            >
              <FiDownload className="w-4 h-4" aria-hidden="true" />
              Exporter ({selectedColumns.length} colonnes)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportConfigModal;

// Validation des props
ExportConfigModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  projectCount: PropTypes.number.isRequired
}; 