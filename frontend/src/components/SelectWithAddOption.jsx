import React, { useState } from 'react';
import PropTypes from 'prop-types';
import CreateTypeModal from './modals/CreateTypeModal';

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
  // Nouvelles props pour le mode type
  isTypeMode = false,
  onCreateType = null
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [newOptionData, setNewOptionData] = useState({ label: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [typeCreationError, setTypeCreationError] = useState(null);

  const handleError = (message) => {
    if (onError) {
      onError(message);
    } else {
      alert(message); // Fallback si pas de gestionnaire d'erreur fourni
    }
  };

  const handleAddOption = async () => {
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
      console.error('Erreur lors de l\'ajout:', error);
      handleError(error.message || 'Erreur lors de l\'ajout de l\'option');
    } finally {
      setIsAdding(false);
    }
  };

  const handleCreateType = async (typeName, columns) => {
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
      console.error('Erreur lors de la création du type:', error);
      setTypeCreationError(error.message || 'Erreur lors de la création du type');
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddButtonClick = () => {
    if (isTypeMode) {
      setShowTypeModal(true);
    } else {
      setShowAddModal(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOption();
    } else if (e.key === 'Escape') {
      setShowAddModal(false);
      setNewOptionData({ label: '' });
    }
  };

  const closeModal = () => {
    if (!isAdding) {
      setShowAddModal(false);
      setNewOptionData({ label: '' });
    }
  };

  const closeTypeModal = () => {
    if (!isAdding) {
      setShowTypeModal(false);
      setTypeCreationError(null);
    }
  };

  return (
    <>
      <div className="join w-full">
        <select
          id={id}
          name={name}
          value={value || ''}
          onChange={onChange}
          className={`select select-bordered join-item flex-1 ${className}`}
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

      {/* Message si aucune option */}
      {!isLoading && options.length === 0 && emptyMessage && (
        <div className="mt-2" id={`${id}-help`}>
          {emptyMessage}
        </div>
      )}

      {/* Modal pour ajouter une nouvelle option simple */}
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
          
          {/* Overlay pour fermer la modal */}
          <div className="modal-backdrop" onClick={closeModal}></div>
        </div>
      )}

      {/* Modal pour créer un nouveau type complet */}
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
  // Nouvelles props pour le mode type
  isTypeMode: PropTypes.bool,
  onCreateType: PropTypes.func,
};

export default SelectWithAddOption; 