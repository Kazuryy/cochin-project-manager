import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import CreateTypeModal from './modals/CreateTypeModal';

/**
 * Composant de sélection avec possibilité d'ajouter une nouvelle option
 * @param {Object} props - Les propriétés du composant
 * @param {string} props.id - Identifiant unique du select
 * @param {string} props.name - Nom du champ
 * @param {string|number} props.value - Valeur sélectionnée
 * @param {Function} props.onChange - Gestionnaire de changement
 * @param {Array<{value: string|number, label: string}>} props.options - Options disponibles
 * @param {string} [props.placeholder="Sélectionner..."] - Texte par défaut
 * @param {boolean} [props.required=false] - Champ obligatoire
 * @param {string} [props.className=""] - Classes CSS additionnelles
 * @param {boolean} [props.disabled=false] - Désactive le composant
 * @param {Function} [props.onAddOption] - Gestionnaire d'ajout d'option
 * @param {string} [props.addButtonTitle="Ajouter une nouvelle option"] - Titre du bouton d'ajout
 * @param {boolean} [props.showAddButton=true] - Affiche le bouton d'ajout
 * @param {boolean} [props.isLoading=false] - État de chargement
 * @param {React.ReactNode} [props.emptyMessage] - Message si aucune option
 * @param {Function} [props.onError] - Gestionnaire d'erreur
 * @param {boolean} [props.isTypeMode=false] - Mode création de type
 * @param {Function} [props.onCreateType] - Gestionnaire de création de type
 */
const SelectWithAddOption = ({
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder = "Sélectionner...",
  required = false,
  className = "",
  disabled = false,
  onAddOption,
  addButtonTitle = "Ajouter une nouvelle option",
  showAddButton = true,
  isLoading = false,
  emptyMessage = null,
  onError,
  isTypeMode = false,
  onCreateType = null
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [newOptionData, setNewOptionData] = useState({ label: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [typeCreationError, setTypeCreationError] = useState(null);

  const handleError = useCallback((message) => {
    if (onError) {
      onError(message);
    } else {
      console.error(message);
    }
  }, [onError]);

  const handleAddOption = useCallback(async () => {
    if (!newOptionData.label.trim()) {
      handleError('Veuillez remplir le libellé');
      return;
    }

    if (!onAddOption) {
      handleError('Fonction d\'ajout non définie');
      return;
    }

    setIsAdding(true);
    try {
      await onAddOption(newOptionData.label);
      setShowAddModal(false);
      setNewOptionData({ label: '' });
    } catch (error) {
      handleError(error.message || 'Erreur lors de l\'ajout de l\'option');
    } finally {
      setIsAdding(false);
    }
  }, [newOptionData.label, onAddOption, handleError]);

  const handleCreateType = useCallback(async (typeName, columns) => {
    if (!onCreateType) {
      setTypeCreationError('Fonction de création de type non définie');
      return;
    }

    setIsAdding(true);
    setTypeCreationError(null);
    
    try {
      await onCreateType(typeName, columns);
      setShowTypeModal(false);
    } catch (error) {
      setTypeCreationError(error.message || 'Erreur lors de la création du type');
    } finally {
      setIsAdding(false);
    }
  }, [onCreateType]);

  const handleAddButtonClick = useCallback(() => {
    if (isTypeMode) {
      setShowTypeModal(true);
    } else {
      setShowAddModal(true);
    }
  }, [isTypeMode]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOption();
    } else if (e.key === 'Escape') {
      setShowAddModal(false);
      setNewOptionData({ label: '' });
    }
  }, [handleAddOption]);

  const closeModal = useCallback(() => {
    if (!isAdding) {
      setShowAddModal(false);
      setNewOptionData({ label: '' });
    }
  }, [isAdding]);

  const closeTypeModal = useCallback(() => {
    if (!isAdding) {
      setShowTypeModal(false);
      setTypeCreationError(null);
    }
  }, [isAdding]);

  const selectClassName = useMemo(() => 
    `select select-bordered join-item flex-1 ${className}`,
    [className]
  );

  return (
    <>
      <div className="join w-full">
        <select
          id={id}
          name={name}
          value={value || ''}
          onChange={onChange}
          className={selectClassName}
          required={required}
          disabled={disabled || isLoading}
          aria-describedby={`${id}-help`}
        >
          <option value="">{placeholder}</option>
          {isLoading ? (
            <option disabled>Chargement...</option>
          ) : (
            options.map((option) => (
              <option key={`${option.value}-${option.label}`} value={option.value}>
                {option.label}
              </option>
            ))
          )}
        </select>
        
        {showAddButton && (onAddOption || onCreateType) && (
          <button
            type="button"
            className="btn btn-outline join-item"
            onClick={handleAddButtonClick}
            title={addButtonTitle}
            disabled={disabled || isLoading}
            aria-label={addButtonTitle}
          >
            ➕
          </button>
        )}
      </div>

      {!isLoading && options.length === 0 && emptyMessage && (
        <div className="mt-2" id={`${id}-help`}>
          {emptyMessage}
        </div>
      )}

      {showAddModal && !isTypeMode && (
        <div className="modal modal-open" role="dialog" aria-labelledby="add-option-title" aria-modal="true">
          <div className="modal-box">
            <h3 id="add-option-title" className="font-bold text-lg">
              ➕ Ajouter une nouvelle option
            </h3>
            <p className="py-4">
              <span className="text-sm text-base-content/70">
                Cette option sera ajoutée directement dans la base de données
              </span>
            </p>
            
            <div className="form-control w-full mb-4">
              <label className="label" htmlFor="new_option_input">
                <span className="label-text font-medium">Nouvelle option</span>
              </label>
              <input
                type="text"
                id="new_option_input"
                value={newOptionData.label}
                onChange={(e) => setNewOptionData({ label: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Nouvelle entrée"
                className="input input-bordered w-full"
                autoFocus
                disabled={isAdding}
                aria-describedby="new_option_help"
              />
              <label className="label" htmlFor="new_option_input">
                <span id="new_option_help" className="label-text-alt">
                  Cette valeur apparaîtra dans la liste des choix
                </span>
              </label>
            </div>
            
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeModal}
                disabled={isAdding}
              >
                Annuler
              </button>
              <button
                type="button"
                className={`btn btn-primary ${isAdding ? 'loading' : ''}`}
                onClick={handleAddOption}
                disabled={isAdding || !newOptionData.label.trim()}
              >
                {isAdding ? 'Ajout...' : 'Ajouter'}
              </button>
            </div>
          </div>
          
          <button
            type="button"
            className="modal-backdrop"
            onClick={closeModal}
            aria-label="Fermer la modal"
          ></button>
        </div>
      )}

      {isTypeMode && (
        <CreateTypeModal
          isOpen={showTypeModal}
          onClose={closeTypeModal}
          onCreateType={handleCreateType}
          isLoading={isAdding}
          error={typeCreationError}
        />
      )}
    </>
  );
};

SelectWithAddOption.propTypes = {
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  onAddOption: PropTypes.func,
  addButtonTitle: PropTypes.string,
  showAddButton: PropTypes.bool,
  isLoading: PropTypes.bool,
  emptyMessage: PropTypes.node,
  onError: PropTypes.func,
  isTypeMode: PropTypes.bool,
  onCreateType: PropTypes.func,
};

export default SelectWithAddOption; 