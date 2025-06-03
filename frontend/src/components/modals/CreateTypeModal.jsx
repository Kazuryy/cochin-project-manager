import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Modal, Button, Alert } from '../ui';
import { FiPlus, FiTrash2, FiDatabase } from 'react-icons/fi';

const FIELD_TYPES = [
  { value: 'text', label: 'Texte' },
  { value: 'long_text', label: 'Texte long' },
  { value: 'number', label: 'Nombre' },
  { value: 'decimal', label: 'Nombre décimal' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date et heure' },
  { value: 'boolean', label: 'Booléen' },
  { value: 'choice', label: 'Liste de choix' }
];

function CreateTypeModal({ 
  isOpen, 
  onClose, 
  onCreateType, 
  isLoading = false,
  error = null 
}) {
  const [step, setStep] = useState(1); // 1: nom du type, 2: colonnes
  const [typeName, setTypeName] = useState('');
  const [columns, setColumns] = useState([]);
  const [typeNameError, setTypeNameError] = useState('');

  const resetModal = () => {
    setStep(1);
    setTypeName('');
    setColumns([]);
    setTypeNameError('');
  };

  const handleClose = () => {
    if (!isLoading) {
      resetModal();
      onClose();
    }
  };

  const handleNextStep = () => {
    const name = typeName.trim();
    if (!name) {
      setTypeNameError('Le nom du type est requis');
      return;
    }
    
    // Capitaliser la première lettre seulement
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
    setTypeName(capitalizedName);
    setTypeNameError('');
    setStep(2);
  };

  const addColumn = () => {
    setColumns([...columns, {
      id: Date.now(),
      name: '',
      type: 'text',
      is_required: false,
      is_choice_field: false,
      choice_column_name: ''
    }]);
  };

  const removeColumn = (id) => {
    setColumns(columns.filter(col => col.id !== id));
  };

  const updateColumn = (id, field, value) => {
    setColumns(columns.map(col => 
      col.id === id ? { ...col, [field]: value } : col
    ));
  };

  const handleCreateType = async () => {
    const validColumns = columns.filter(col => col.name.trim());
    await onCreateType(typeName, validColumns);
    resetModal();
  };

  const isColumnValid = (column) => {
    if (!column.name.trim()) return false;
    if (column.is_choice_field && !column.choice_column_name.trim()) return false;
    return true;
  };

  const canCreateType = () => {
    return typeName.trim() && columns.every(isColumnValid);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 1 ? "Créer un nouveau type" : `Configurer les colonnes pour "${typeName}"`}
      size="lg"
      preventClosing={isLoading}
    >
      <div className="space-y-6">
        {error && (
          <Alert type="error" message={error} />
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="text-sm text-base-content/70">
              <p>Vous allez créer un nouveau type qui sera :</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Ajouté dans la table <strong>TableNames</strong></li>
                <li>Aura sa propre table <strong>{typeName || '[Nom]'}Details</strong> créée automatiquement</li>
              </ul>
            </div>

            <div className="form-control w-full">
              <label className="label" htmlFor="type_name">
                <span className="label-text font-medium">
                  Nom du type <span className="text-error">*</span>
                </span>
              </label>
              <input
                type="text"
                id="type_name"
                value={typeName}
                onChange={(e) => {
                  setTypeName(e.target.value);
                  setTypeNameError('');
                }}
                placeholder="Ex: Prestation, Formation, Collaboration..."
                className={`input input-bordered w-full ${typeNameError ? 'input-error' : ''}`}
                autoFocus
                disabled={isLoading}
              />
              {typeNameError && (
                <label className="label">
                  <span className="label-text-alt text-error">{typeNameError}</span>
                </label>
              )}
              <label className="label">
                <span className="label-text-alt">
                  La première lettre sera automatiquement mise en majuscule
                </span>
              </label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
                Annuler
              </Button>
              <Button variant="primary" onClick={handleNextStep} disabled={isLoading}>
                Suivant
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium">Colonnes pour la table {typeName}Details</h3>
                <p className="text-sm text-base-content/70">
                  Définissez les colonnes que vous souhaitez dans votre nouvelle table
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addColumn}
                disabled={isLoading}
              >
                <FiPlus className="mr-1" />
                Ajouter une colonne
              </Button>
            </div>

            {columns.length === 0 ? (
              <div className="text-center py-8 text-base-content/50">
                <FiDatabase className="mx-auto text-4xl mb-2" />
                <p>Aucune colonne définie</p>
                <p className="text-sm">Cliquez sur "Ajouter une colonne" pour commencer</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {columns.map((column, index) => (
                  <div key={column.id} className="p-4 border border-base-300 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Colonne {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => removeColumn(column.id)}
                        disabled={isLoading}
                      >
                        <FiTrash2 className="text-error" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Nom de la colonne *</span>
                        </label>
                        <input
                          type="text"
                          value={column.name}
                          onChange={(e) => updateColumn(column.id, 'name', e.target.value)}
                          placeholder="Ex: Sous type, Qualité..."
                          className="input input-bordered input-sm"
                          disabled={isLoading}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Type de données</span>
                        </label>
                        <select
                          value={column.type}
                          onChange={(e) => updateColumn(column.id, 'type', e.target.value)}
                          className="select select-bordered select-sm"
                          disabled={isLoading}
                        >
                          {FIELD_TYPES.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <label className="label cursor-pointer">
                        <input
                          type="checkbox"
                          checked={column.is_required}
                          onChange={(e) => updateColumn(column.id, 'is_required', e.target.checked)}
                          className="checkbox checkbox-sm"
                          disabled={isLoading}
                        />
                        <span className="label-text ml-2">Requis</span>
                      </label>

                      <label className="label cursor-pointer">
                        <input
                          type="checkbox"
                          checked={column.is_choice_field}
                          onChange={(e) => updateColumn(column.id, 'is_choice_field', e.target.checked)}
                          className="checkbox checkbox-sm"
                          disabled={isLoading}
                        />
                        <span className="label-text ml-2">Lier à la table Choix</span>
                      </label>
                    </div>

                    {column.is_choice_field && (
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Nom de la colonne dans Choix *</span>
                        </label>
                        <input
                          type="text"
                          value={column.choice_column_name}
                          onChange={(e) => updateColumn(column.id, 'choice_column_name', e.target.value)}
                          placeholder="Ex: sous_type_prestation, qualite..."
                          className="input input-bordered input-sm"
                          disabled={isLoading}
                        />
                        <label className="label">
                          <span className="label-text-alt">
                            Cette colonne sera créée dans la table Choix si elle n'existe pas
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={isLoading}>
                Retour
              </Button>
              <div className="space-x-2">
                <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
                  Annuler
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleCreateType}
                  isLoading={isLoading}
                  disabled={isLoading || !canCreateType()}
                >
                  {isLoading ? 'Création...' : 'Créer le type'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

CreateTypeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreateType: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  error: PropTypes.string
};

export default CreateTypeModal; 