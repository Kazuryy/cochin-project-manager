import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Modal, Button, Alert } from '../ui';
import { FiPlus, FiTrash2, FiDatabase } from 'react-icons/fi';
import { useDynamicTables } from '../../contexts/hooks/useDynamicTables';
import api from '../../services/api';

// Désactiver Hot Refresh temporairement pour les tests
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // Ne pas recharger ce module
  });
}

const FIELD_TYPES = [
  { value: 'text', label: 'Texte' },
  { value: 'long_text', label: 'Texte long' },
  { value: 'number', label: 'Nombre' },
  { value: 'decimal', label: 'Nombre décimal' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date et heure' },
  { value: 'boolean', label: 'Booléen' },
  { value: 'choice', label: 'Liste de choix' },
  { value: 'foreign_key', label: 'Clé étrangère (FK)' }
];

// Fonction utilitaire pour créer une nouvelle colonne avec des valeurs par défaut
const createNewColumn = () => ({
  id: Date.now(),
  name: '',
  type: 'text',
  is_required: false,
  is_choice_field: false,
  choice_column_name: '',
  is_foreign_key: false,
  foreign_table_id: '',
  foreign_reference_field: 'id',
  foreign_display_field: ''
});

// Fonction utilitaire pour réinitialiser les propriétés spécifiques d'une colonne selon son type
const resetColumnTypeSpecificProperties = (column, newType) => {
  const resetColumn = { ...column, type: newType };
  
  if (newType === 'choice') {
    return {
      ...resetColumn,
      is_choice_field: true,
      is_foreign_key: false,
      foreign_table_id: '',
      foreign_display_field: '',
      foreign_reference_field: 'id'
    };
  } 
  
  if (newType === 'foreign_key') {
    return {
      ...resetColumn,
      is_foreign_key: true,
      is_choice_field: false,
      choice_column_name: '',
      foreign_reference_field: 'id'
    };
  }
  
  // Pour tous les autres types, nettoyer les propriétés spéciales
  return {
    ...resetColumn,
    is_choice_field: false,
    is_foreign_key: false,
    choice_column_name: '',
    foreign_table_id: '',
    foreign_reference_field: '',
    foreign_display_field: ''
  };
};

function CreateTypeModal({ 
  isOpen, 
  onClose, 
  onCreateType, 
  isLoading = false,
  error = null 
}) {
  const { tables } = useDynamicTables();
  const [step, setStep] = useState(1);
  const [typeName, setTypeName] = useState('');
  const [columns, setColumns] = useState([]);
  const [typeNameError, setTypeNameError] = useState('');
  const [tableFields, setTableFields] = useState({});

  // Memoisation des tables disponibles pour les FK
  const availableTables = useMemo(() => 
    tables.filter(table => 
      !table.name.toLowerCase().includes('details') && 
      table.name !== 'TableNames'
    ), 
    [tables]
  );

  // Fonction optimisée pour charger les champs d'une table avec cache intelligent
  const loadTableFields = useCallback(async (tableId) => {
    if (tableFields[tableId]) {
      return tableFields[tableId];
    }

    try {
      const tableData = await api.get(`/api/database/tables/${tableId}/`);
      
      if (tableData?.fields) {
        setTableFields(prev => ({
          ...prev,
          [tableId]: tableData.fields
        }));
        return tableData.fields;
      }
    } catch (error) {
      console.error('Erreur lors du chargement des champs:', error);
    }
    return [];
  }, [tableFields]);

  // Fonction de reset optimisée
  const resetModal = useCallback(() => {
    setStep(1);
    setTypeName('');
    setColumns([]);
    setTypeNameError('');
  }, []);

  const handleClose = useCallback(() => {
    if (!isLoading) {
      resetModal();
      onClose();
    }
  }, [isLoading, resetModal, onClose]);

  const handleNextStep = useCallback(() => {
    const name = typeName.trim();
    if (!name) {
      setTypeNameError('Le nom du type est requis');
      return;
    }
    
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
    setTypeName(capitalizedName);
    setTypeNameError('');
    setStep(2);
  }, [typeName]);

  const addColumn = useCallback(() => {
    setColumns(prev => [...prev, createNewColumn()]);
  }, []);

  const removeColumn = useCallback((id) => {
    setColumns(prev => prev.filter(col => col.id !== id));
  }, []);

  // Fonction optimisée pour la mise à jour des colonnes
  const updateColumn = useCallback((id, updates) => {
    setColumns(prevColumns => prevColumns.map(col => {
      if (col.id !== id) return col;

      // Si on met à jour le type, appliquer les réinitialisations nécessaires
      if (updates.type && updates.type !== col.type) {
        return resetColumnTypeSpecificProperties(col, updates.type);
      }

      // Sinon, appliquer simplement les mises à jour
      return { ...col, ...updates };
    }));
  }, []);

  // Gestionnaire optimisé pour le changement de table FK
  const handleForeignTableChange = useCallback(async (columnId, selectedTableId) => {
    updateColumn(columnId, {
      foreign_table_id: selectedTableId,
      foreign_reference_field: 'id'
    });

    if (selectedTableId) {
      try {
        await loadTableFields(selectedTableId);
      } catch (error) {
        console.error('Erreur lors du chargement des champs:', error);
      }
    }
  }, [updateColumn, loadTableFields]);

  const handleCreateType = useCallback(async () => {
    const validColumns = columns.filter(col => col.name.trim());
    await onCreateType(typeName, validColumns);
    resetModal();
  }, [columns, typeName, onCreateType, resetModal]);

  // Validation optimisée avec memoisation
  const isColumnValid = useCallback((column) => {
    return column.name.trim() && 
           (!column.is_choice_field || column.choice_column_name.trim()) && 
           (!column.is_foreign_key || column.foreign_table_id);
  }, []);

  const canCreateType = useMemo(() => {
    return typeName.trim() && columns.every(isColumnValid);
  }, [typeName, columns, isColumnValid]);

  // Fonction pour obtenir le nom de la table par ID
  const getTableNameById = useCallback((tableId) => {
    return availableTables.find(t => t.id.toString() === tableId)?.name || '';
  }, [availableTables]);

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
                <div className="label">
                  <span className="label-text-alt text-error">{typeNameError}</span>
                </div>
              )}
              <div className="label">
                <span className="label-text-alt">
                  La première lettre sera automatiquement mise en majuscule
                </span>
              </div>
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
                        <label className="label" htmlFor={`column_name_${column.id}`}>
                          <span className="label-text">Nom de la colonne *</span>
                        </label>
                        <input
                          type="text"
                          id={`column_name_${column.id}`}
                          value={column.name}
                          onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                          placeholder="Ex: Sous type, Qualité..."
                          className="input input-bordered input-sm"
                          disabled={isLoading}
                        />
                      </div>

                      <div className="form-control">
                        <label className="label" htmlFor={`column_type_${column.id}`}>
                          <span className="label-text">Type de données</span>
                        </label>
                        <select
                          id={`column_type_${column.id}`}
                          value={column.type}
                          onChange={(e) => updateColumn(column.id, { type: e.target.value })}
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
                          onChange={(e) => updateColumn(column.id, { is_required: e.target.checked })}
                          className="checkbox checkbox-sm"
                          disabled={isLoading}
                        />
                        <span className="label-text ml-2">Requis</span>
                      </label>

                      {column.type === 'choice' && (
                        <label className="label cursor-pointer">
                          <input
                            type="checkbox"
                            checked={column.is_choice_field}
                            onChange={(e) => updateColumn(column.id, { is_choice_field: e.target.checked })}
                            className="checkbox checkbox-sm"
                            disabled={isLoading}
                          />
                          <span className="label-text ml-2">Lier à la table Choix</span>
                        </label>
                      )}
                    </div>

                    {column.type === 'choice' && column.is_choice_field && (
                      <div className="form-control">
                        <label className="label" htmlFor={`choice_column_${column.id}`}>
                          <span className="label-text">Nom de la colonne dans Choix *</span>
                        </label>
                        <input
                          type="text"
                          id={`choice_column_${column.id}`}
                          value={column.choice_column_name}
                          onChange={(e) => updateColumn(column.id, { choice_column_name: e.target.value })}
                          placeholder="Ex: sous_type_prestation, qualite..."
                          className="input input-bordered input-sm"
                          disabled={isLoading}
                        />
                        <div className="label">
                          <span className="label-text-alt">
                            Cette colonne sera créée dans la table Choix si elle n'existe pas
                          </span>
                        </div>
                      </div>
                    )}

                    {column.type === 'foreign_key' && (
                      <div className="space-y-3">
                        <div className="form-control">
                          <label className="label" htmlFor={`foreign_table_${column.id}`}>
                            <span className="label-text">Table de référence *</span>
                          </label>
                          <select
                            id={`foreign_table_${column.id}`}
                            value={column.foreign_table_id}
                            onChange={(e) => handleForeignTableChange(column.id, e.target.value)}
                            className="select select-bordered select-sm"
                            disabled={isLoading}
                          >
                            <option value="">Sélectionner une table...</option>
                            {availableTables.map(table => (
                              <option key={table.id} value={table.id.toString()}>
                                {table.name}
                              </option>
                            ))}
                          </select>
                          <div className="label">
                            <span className="label-text-alt">
                              Cette colonne pointera vers la table sélectionnée
                            </span>
                          </div>
                        </div>

                        {column.foreign_table_id && (
                          <div className="form-control">
                            <label className="label" htmlFor={`foreign_ref_${column.id}`}>
                              <span className="label-text">Champ de référence *</span>
                            </label>
                            <select
                              id={`foreign_ref_${column.id}`}
                              value={column.foreign_reference_field}
                              onChange={(e) => updateColumn(column.id, { foreign_reference_field: e.target.value })}
                              className="select select-bordered select-sm"
                              disabled={isLoading}
                            >
                              <option value="id">ID (clé primaire)</option>
                              {tableFields[column.foreign_table_id]?.map(field => (
                                <option key={field.id} value={field.slug}>
                                  {field.name} ({field.field_type})
                                </option>
                              ))}
                            </select>
                            <div className="label">
                              <span className="label-text-alt">
                                Champ de la table {getTableNameById(column.foreign_table_id)} à utiliser comme référence
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="form-control">
                          <label className="label" htmlFor={`foreign_display_${column.id}`}>
                            <span className="label-text">Champ d'affichage (optionnel)</span>
                          </label>
                          <input
                            type="text"
                            id={`foreign_display_${column.id}`}
                            value={column.foreign_display_field}
                            onChange={(e) => updateColumn(column.id, { foreign_display_field: e.target.value })}
                            placeholder="Ex: nom, titre, description..."
                            className="input input-bordered input-sm"
                            disabled={isLoading}
                          />
                          <div className="label">
                            <span className="label-text-alt">
                              Champ à afficher dans les listes déroulantes (sinon utilisera le champ de référence)
                            </span>
                          </div>
                        </div>
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
                  disabled={isLoading || !canCreateType}
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