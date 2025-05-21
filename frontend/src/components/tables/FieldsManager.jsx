// frontend/src/components/tables/FieldsManager.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDynamicTables } from '../../contexts/hooks/useDynamicTables';
import { Button, FormField, Alert, Modal } from '../ui';
import { FiPlus, FiEdit, FiTrash2, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import api from '../../services/api';

function FieldsManager({ tableId }) {
  const { 
    fetchTableWithFields, 
    deleteField,
    isLoading, 
    error 
  } = useDynamicTables();
  
  const [table, setTable] = useState(null);
  const [tables, setTables] = useState([]);
  const [fields, setFields] = useState([]);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [fieldFormData, setFieldFormData] = useState({
    name: '',
    field_type: 'text',
    description: '',
    is_required: false,
    is_unique: false,
    is_searchable: false,
    default_value: '',
    options: '',
    related_table: ''
  });
  
  const [fieldFormErrors, setFieldFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [tablesLoading, setTablesLoading] = useState(false);
  
  const fieldTypes = [
    { value: 'text', label: 'Texte' },
    { value: 'long_text', label: 'Texte long' },
    { value: 'number', label: 'Nombre' },
    { value: 'decimal', label: 'Nombre décimal' },
    { value: 'date', label: 'Date' },
    { value: 'datetime', label: 'Date et heure' },
    { value: 'boolean', label: 'Booléen' },
    { value: 'choice', label: 'Liste de choix' },
    { value: 'foreign_key', label: 'Clé étrangère' },
    { value: 'file', label: 'Fichier' },
    { value: 'image', label: 'Image' }
  ];
  
  // Charger les données de la table et ses champs
  useEffect(() => {
    const loadTable = async () => {
      const tableData = await fetchTableWithFields(tableId);
      if (tableData) {
        setTable(tableData);
        setFields(tableData.fields || []);
      }
    };
    
    loadTable();
  }, [tableId, fetchTableWithFields]);
  
  // Charger toutes les tables directement depuis l'API
  useEffect(() => {
    const loadAllTables = async () => {
      try {
        setTablesLoading(true);
        const response = await api.get('/api/database/tables/');
        if (response) {
          // Filtrer la table actuelle pour éviter l'auto-référence
          setTables(response.filter(t => t.id.toString() !== tableId.toString()));
          console.log("Tables chargées:", response);
          console.log("Tables filtrées:", response.filter(t => t.id.toString() !== tableId.toString()));
        } else {
          console.error("Aucune table reçue de l'API");
        }
      } catch (err) {
        console.error("Erreur lors du chargement des tables:", err);
      } finally {
        setTablesLoading(false);
      }
    };
    
    loadAllTables();
  }, [tableId]);
  
  const handleFieldChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Gestion spéciale pour le changement de type
    if (name === 'field_type' && value !== 'foreign_key') {
      // Si le type n'est plus 'foreign_key', réinitialiser related_table
      setFieldFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
        ...(name === 'field_type' && value !== 'foreign_key' ? { related_table: '' } : {})
      }));
    } else {
      setFieldFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
    
    // Effacer l'erreur pour ce champ
    if (fieldFormErrors[name]) {
      setFieldFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  const validateFieldForm = () => {
    const errors = {};
    
    if (!fieldFormData.name.trim()) {
      errors.name = 'Le nom du champ est requis';
    }
    
    if (fieldFormData.field_type === 'choice' && !fieldFormData.options.trim()) {
      errors.options = 'Les options sont requises pour un champ de type liste de choix';
    }
    
    if (fieldFormData.field_type === 'foreign_key' && !fieldFormData.related_table) {
      errors.related_table = 'Une table liée est requise pour un champ de type clé étrangère';
    }
    
    return errors;
  };
  
  const handleAddField = () => {
    setSelectedField(null);
    setFieldFormData({
      name: '',
      field_type: 'text',
      description: '',
      is_required: false,
      is_unique: false,
      is_searchable: false,
      default_value: '',
      options: '',
      related_table: ''
    });
    setIsFieldModalOpen(true);
  };
  
  const handleEditField = (field) => {
    setSelectedField(field);
    setFieldFormData({
      name: field.name,
      field_type: field.field_type,
      description: field.description || '',
      is_required: field.is_required,
      is_unique: field.is_unique,
      is_searchable: field.is_searchable,
      default_value: field.default_value || '',
      options: field.options ? JSON.stringify(field.options) : '',
      related_table: field.related_table || ''
    });
    setIsFieldModalOpen(true);
  };
  
  const prepareFieldData = (formData) => {
    const fieldData = {
      ...formData,
      slug: formData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^_+)|(_+$)/g, '')
    };

    // Traitement pour les champs de type choix
    if (fieldData.field_type === 'choice' && fieldData.options) {
      try {
        // Vérifier si c'est déjà un JSON valide
        JSON.parse(fieldData.options);
      } catch {
        // Sinon, convertir la liste séparée par des virgules en JSON
        fieldData.options = JSON.stringify(
          fieldData.options.split(',').map(option => option.trim())
        );
      }
    }
    
    console.log("Données du champ préparées:", fieldData);
    return fieldData;
  };

  const saveField = async (fieldData) => {
    console.log("Données à envoyer à l'API:", fieldData);
    try {
      // Obtenir un token CSRF
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];

      if (!csrfToken) {
        throw new Error('Token CSRF non trouvé');
      }

      const response = await fetch(`/api/database/tables/${tableId}/add_field/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(fieldData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Erreur HTTP ${response.status}`);
      }

      return response.json();
    } catch (err) {
      console.error("Erreur lors de la sauvegarde du champ:", err);
      throw err;
    }
  };

  const handleSaveField = async () => {
    const errors = validateFieldForm();
    if (Object.keys(errors).length > 0) {
      setFieldFormErrors(errors);
      return;
    }
    
    try {
      const fieldData = prepareFieldData(fieldFormData);
      const result = selectedField
        ? alert('Fonction non implémentée: Mise à jour de champ')
        : await saveField(fieldData);

      if (result) {
        setSuccessMessage(selectedField ? 'Champ mis à jour avec succès' : 'Champ ajouté avec succès');
        setIsFieldModalOpen(false);
        
        const updatedTable = await fetchTableWithFields(tableId);
        if (updatedTable) {
          setTable(updatedTable);
          setFields(updatedTable.fields || []);
        }
        
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      console.error('Erreur lors de la sauvegarde du champ:', err);
      setFieldFormErrors({
        submit: err.message || 'Une erreur est survenue lors de la sauvegarde du champ'
      });
    }
  };
  
  const handleMoveField = (fieldId, direction) => {
    const fieldIndex = fields.findIndex(f => f.id === fieldId);
    if (
      (direction === 'up' && fieldIndex === 0) || 
      (direction === 'down' && fieldIndex === fields.length - 1)
    ) {
      return;
    }
    
    const newFields = [...fields];
    const temp = newFields[fieldIndex];
    
    if (direction === 'up') {
      newFields[fieldIndex] = newFields[fieldIndex - 1];
      newFields[fieldIndex - 1] = temp;
    } else {
      newFields[fieldIndex] = newFields[fieldIndex + 1];
      newFields[fieldIndex + 1] = temp;
    }
    
    // Mettre à jour l'ordre des champs
    const updatedFields = newFields.map((field, index) => ({
      ...field,
      order: index
    }));
    
    setFields(updatedFields);
    
    // Ici, vous devriez implémenter la mise à jour de l'ordre dans l'API
    // updateFieldsOrder(tableId, updatedFields);
    alert('Fonction non implémentée: Mise à jour de l\'ordre des champs');
  };
  
  const handleCloseModal = () => {
    setIsFieldModalOpen(false);
    setFieldFormErrors({});
    setSelectedField(null);
    setFieldFormData({
      name: '',
      field_type: 'text',
      description: '',
      is_required: false,
      is_unique: false,
      is_searchable: false,
      default_value: '',
      options: '',
      related_table: ''
    });
  };
  
  const handleDeleteField = async (field) => {
    try {
      const success = await deleteField(tableId, field.id);
      if (success) {
        setSuccessMessage('Champ supprimé avec succès');
        // Mettre à jour la liste des champs
        const updatedTable = await fetchTableWithFields(tableId);
        if (updatedTable) {
          setTable(updatedTable);
          setFields(updatedTable.fields || []);
        }
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      console.error('Erreur lors de la suppression du champ:', err);
      setFieldFormErrors({
        submit: err.message || 'Une erreur est survenue lors de la suppression du champ'
      });
    } finally {
      setConfirmDelete(null);
    }
  };
  
  const getTableName = (tableId) => {
    const foundTable = tables.find(t => t.id.toString() === tableId.toString());
    return foundTable ? foundTable.name : `Table #${tableId}`;
  };
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      );
    }

    if (!table) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">Table non trouvée</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Nom</th>
              <th>Type</th>
              <th>Description</th>
              <th>Requis</th>
              <th>Unique</th>
              <th>Recherche</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {fields.length > 0 ? (
              fields.map((field, index) => (
                <tr key={field.id}>
                  <td className="w-20">
                    <div className="flex items-center space-x-1">
                      <span className="badge">{index + 1}</span>
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="xs"
                          isDisabled={index === 0}
                          onClick={() => handleMoveField(field.id, 'up')}
                        >
                          <FiArrowUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          isDisabled={index === fields.length - 1}
                          onClick={() => handleMoveField(field.id, 'down')}
                        >
                          <FiArrowDown />
                        </Button>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="font-medium">{field.name}</div>
                    <div className="text-xs opacity-60">{field.slug}</div>
                  </td>
                  <td>
                    {fieldTypes.find(t => t.value === field.field_type)?.label || field.field_type}
                    {field.field_type === 'foreign_key' && field.related_table && (
                      <div className="text-xs opacity-60">
                        → {getTableName(field.related_table)}
                      </div>
                    )}
                  </td>
                  <td>{field.description || '-'}</td>
                  <td>{field.is_required ? '✓' : '-'}</td>
                  <td>{field.is_unique ? '✓' : '-'}</td>
                  <td>{field.is_searchable ? '✓' : '-'}</td>
                  <td>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleEditField(field)}
                      >
                        <FiEdit />
                      </Button>
                      {confirmDelete === field.id ? (
                        <div className="flex space-x-1">
                          <Button
                            variant="error"
                            size="xs"
                            onClick={() => handleDeleteField(field)}
                          >
                            Oui
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setConfirmDelete(null)}
                          >
                            Non
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setConfirmDelete(field.id)}
                        >
                          <FiTrash2 />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center py-4">
                  Aucun champ défini pour cette table
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };
  
  return (
    <div className="space-y-4 bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          Gestion des champs {table ? `- ${table.name}` : ''}
        </h2>
        <Button variant="primary" onClick={handleAddField}>
          <FiPlus className="mr-2" />
          Ajouter un champ
        </Button>
      </div>
      
      {error && <Alert type="error" message={error} />}
      {successMessage && <Alert type="success" message={successMessage} />}
      
      {renderContent()}
      
      {/* Modal pour l'ajout/édition de champ */}
      <Modal
        isOpen={isFieldModalOpen}
        onClose={handleCloseModal}
        title={selectedField ? 'Modifier un champ' : 'Ajouter un champ'}
        size="lg"
      >
        <div className="space-y-4">
          <FormField
            id="name"
            name="name"
            label="Nom du champ"
            value={fieldFormData.name}
            onChange={handleFieldChange}
            error={fieldFormErrors.name}
            required
          />
          
          <div className="form-control w-full">
            <label className="label" htmlFor="field_type">
              <span className="label-text">Type de champ</span>
            </label>
            <select
              id="field_type"
              name="field_type"
              value={fieldFormData.field_type}
              onChange={handleFieldChange}
              className="select select-bordered w-full"
              disabled={selectedField}
            >
              {fieldTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          
          <FormField
            id="description"
            name="description"
            label="Description"
            value={fieldFormData.description}
            onChange={handleFieldChange}
          />
          
          {/* Options pour le type liste de choix */}
          {fieldFormData.field_type === 'choice' && (
            <FormField
              id="options"
              name="options"
              label="Options (séparées par des virgules ou en JSON)"
              value={fieldFormData.options}
              onChange={handleFieldChange}
              error={fieldFormErrors.options}
              helperText="Exemple: Option 1, Option 2, Option 3"
              required
            />
          )}
          
          {/* Sélecteur de table pour le type clé étrangère */}
          {fieldFormData.field_type === 'foreign_key' && (
            <div className="form-control w-full">
              <label className="label" htmlFor="related_table">
                <span className="label-text">Table liée</span>
                <span className="text-error ml-1">*</span>
              </label>
              {tablesLoading ? (
                <div className="flex items-center space-x-2">
                  <span className="loading loading-spinner loading-sm"></span>
                  <span>Chargement des tables...</span>
                </div>
              ) : (
                <>
                  <select
                    id="related_table"
                    name="related_table"
                    value={fieldFormData.related_table || ''}
                    onChange={handleFieldChange}
                    className={`select select-bordered w-full ${
                      fieldFormErrors.related_table ? 'select-error' : ''
                    }`}
                    required
                  >
                    <option value="">Sélectionner une table</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {fieldFormErrors.related_table && (
                    <label className="label">
                      <span className="label-text-alt text-error">{fieldFormErrors.related_table}</span>
                    </label>
                  )}
                  {tables.length === 0 && (
                    <label className="label">
                      <span className="label-text-alt text-warning">
                        Aucune autre table disponible. Créez d'abord d'autres tables.
                      </span>
                    </label>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* Valeur par défaut pour certains types */}
          {(fieldFormData.field_type === 'text' || 
            fieldFormData.field_type === 'long_text' || 
            fieldFormData.field_type === 'number' || 
            fieldFormData.field_type === 'decimal') && (
            <FormField
              id="default_value"
              name="default_value"
              label="Valeur par défaut"
              value={fieldFormData.default_value}
              onChange={handleFieldChange}
            />
          )}
          
          {/* Options générales pour tous les types */}
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">Champ obligatoire</span>
              <input
                type="checkbox"
                name="is_required"
                className="toggle toggle-primary"
                checked={fieldFormData.is_required}
                onChange={handleFieldChange}
              />
            </label>
          </div>
          
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">Valeur unique</span>
              <input
                type="checkbox"
                name="is_unique"
                className="toggle toggle-primary"
                checked={fieldFormData.is_unique}
                onChange={handleFieldChange}
              />
            </label>
          </div>
          
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">Champ recherchable</span>
              <input
                type="checkbox"
                name="is_searchable"
                className="toggle toggle-primary"
                checked={fieldFormData.is_searchable}
                onChange={handleFieldChange}
              />
            </label>
          </div>
          
          {/* Message d'erreur global */}
          {fieldFormErrors.submit && (
            <Alert type="error" message={fieldFormErrors.submit} />
          )}
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="ghost"
              onClick={handleCloseModal}
            >
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveField}
              isLoading={isLoading}
            >
              {selectedField ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

FieldsManager.propTypes = {
  tableId: PropTypes.string.isRequired
};

export default FieldsManager;