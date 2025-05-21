// frontend/src/components/tables/FieldsManager.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDynamicTables } from '../../contexts/hooks/useDynamicTables';
import { Button, FormField, Alert, Modal } from '../ui';
import { FiPlus, FiEdit, FiTrash2, FiArrowUp, FiArrowDown } from 'react-icons/fi';

function FieldsManager({ tableId }) {
  const { 
    fetchTableWithFields, 
    addFieldToTable, 
    isLoading, 
    error 
  } = useDynamicTables();
  
  const [table, setTable] = useState(null);
  const [fields, setFields] = useState([]);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [fieldFormData, setFieldFormData] = useState({
    name: '',
    field_type: 'text',
    description: '',
    is_required: false,
    is_unique: false,
    is_searchable: false,
    default_value: '',
    options: ''
  });
  
  const [fieldFormErrors, setFieldFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  
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
  
  const handleFieldChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFieldFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
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
      options: ''
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
      options: field.options ? JSON.stringify(field.options) : ''
    });
    setIsFieldModalOpen(true);
  };
  
  const handleSaveField = async () => {
    const errors = validateFieldForm();
    if (Object.keys(errors).length > 0) {
      setFieldFormErrors(errors);
      return;
    }
    
    try {
      // Préparer les données du champ
      const fieldData = {
        ...fieldFormData
      };
      
      // Convertir les options en JSON si nécessaire
      if (fieldData.field_type === 'choice' && fieldData.options) {
        try {
          // Vérifier si c'est déjà un objet JSON valide
          JSON.parse(fieldData.options);
        } catch {
          // Si ce n'est pas un JSON valide, essayer de le formater comme une liste
          fieldData.options = JSON.stringify(
            fieldData.options.split(',').map(option => option.trim())
          );
        }
      }
      
      let result;
      if (selectedField) {
        // Mode édition de champ
        // Implémenter l'appel API pour mettre à jour un champ existant
        // result = await updateFieldInTable(tableId, selectedField.id, fieldData);
        alert('Fonction non implémentée: Mise à jour de champ');
      } else {
        // Mode création de champ
        result = await addFieldToTable(tableId, fieldData);
      }
      
      if (result) {
        setSuccessMessage(
          selectedField 
            ? 'Champ mis à jour avec succès' 
            : 'Champ ajouté avec succès'
        );
        
        // Recharger les champs
        const updatedTable = await fetchTableWithFields(tableId);
        if (updatedTable) {
          setTable(updatedTable);
          setFields(updatedTable.fields || []);
        }
        
        setIsFieldModalOpen(false);
        
        // Effacer le message après quelques secondes
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      }
    } catch (err) {
      console.error('Erreur lors de la sauvegarde du champ:', err);
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
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          Gestion des champs {table ? `- ${table.name}` : ''}
        </h2>
        <Button variant="primary" onClick={handleAddField}>
          <FiPlus className="mr-2" />
          Ajouter un champ
        </Button>
      </div>
      
      {error && (
        <Alert type="error" message={error} />
      )}
      
      {successMessage && (
        <Alert type="success" message={successMessage} />
      )}
      
      {isLoading && !table ? (
        <div className="flex justify-center p-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
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
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => alert('Fonction non implémentée: Suppression de champ')}
                        >
                          <FiTrash2 />
                        </Button>
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
      )}
      
      {/* Modal pour l'ajout/édition de champ */}
      <Modal
        isOpen={isFieldModalOpen}
        onClose={() => setIsFieldModalOpen(false)}
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
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="ghost"
              onClick={() => setIsFieldModalOpen(false)}
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