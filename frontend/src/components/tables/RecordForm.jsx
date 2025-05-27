// frontend/src/components/tables/RecordForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useDynamicTables } from '../../contexts/hooks/useDynamicTables';
import { Card, Button, FormField, Alert } from '../ui';
import api from '../../services/api';

function RecordForm({ tableId, recordId }) {
  const navigate = useNavigate();
  const { 
    fetchTableWithFields, 
    createRecord,
    updateRecord,
    isLoading, 
    error 
  } = useDynamicTables();
  
  const [table, setTable] = useState(null);
  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [fkChoices, setFkChoices] = useState({});
  const [fkLoading, setFkLoading] = useState({});

  const findBestDisplayValue = useCallback((record) => {
    const priorityFields = [
      'nom', 'name', 'title', 'titre', 'libelle', 'label',
      'designation', 'description', 'nom_contact', 'nom_client'
    ];
    
    for (const fieldName of priorityFields) {
      const matchingField = Object.entries(record).find(([key, value]) => 
        key.toLowerCase().includes(fieldName.toLowerCase()) && 
        value && 
        typeof value === 'string'
      );
      if (matchingField) return matchingField[1];
    }
    
    const systemFields = ['id', 'created_at', 'updated_at'];
    const firstNonSystemField = Object.entries(record).find(([key, value]) => 
      !systemFields.includes(key) && 
      value && 
      typeof value === 'string' && 
      value.trim() !== ''
    );
    
    return firstNonSystemField ? firstNonSystemField[1] : null;
  }, []);

  const createChoice = useCallback((record) => ({
    value: record.id.toString(),
    display: findBestDisplayValue(record) 
      ? `${findBestDisplayValue(record)} (ID: ${record.id})` 
      : `Enregistrement #${record.id}`
  }), [findBestDisplayValue]);

  const sortChoices = useCallback((choices) => {
    return [...choices].sort((a, b) => a.display.localeCompare(b.display));
  }, []);

  const loadFkChoicesForField = useCallback(async (field) => {
    setFkLoading(prev => ({ ...prev, [field.id]: true }));
    
    try {
      const records = await api.get(`/api/database/records/by_table/?table_id=${field.related_table}`);
      const choices = records.map(createChoice);
      setFkChoices(prev => ({
        ...prev,
        [field.id]: sortChoices(choices)
      }));
    } catch (err) {
      console.error(`Erreur lors du chargement des choix FK pour ${field.name}:`, err);
      setFkChoices(prev => ({ ...prev, [field.id]: [] }));
    } finally {
      setFkLoading(prev => ({ ...prev, [field.id]: false }));
    }
  }, [createChoice, sortChoices]);

  // Charger les données de la table et ses champs
  useEffect(() => {
    const loadTable = async () => {
      const tableData = await fetchTableWithFields(tableId);
      if (tableData) {
        setTable(tableData);
        setFields(tableData.fields || []);
        
        const initialFormData = {};
        tableData.fields?.forEach(field => {
          initialFormData[field.slug] = field.default_value || '';
        });
        setFormData(initialFormData);
      }
    };
    
    loadTable();
  }, [tableId, fetchTableWithFields]);

  // Charger les choix FK pour tous les champs FK
  useEffect(() => {
    const loadAllFkChoices = async () => {
      const fkFields = fields.filter(field => field.field_type === 'foreign_key');
      for (const field of fkFields) {
        if (field.related_table && !fkChoices[field.id]) {
          await loadFkChoicesForField(field);
        }
      }
    };
    
    if (fields.length > 0) {
      loadAllFkChoices();
    }
  }, [fields, fkChoices, loadFkChoicesForField]);
  
  // Si on est en mode édition, charger les données de l'enregistrement
  useEffect(() => {
    if (recordId && table) {
      const loadRecord = async () => {
        try {
          // Utiliser le service API centralisé
          const response = await fetch(`/api/database/records/${recordId}/`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });
          
          if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}`);
          }
          
          const record = await response.json();
          
          // Mettre à jour le formulaire avec les valeurs de l'enregistrement
          setFormData(record);
        } catch (err) {
          console.error(`Erreur lors de la récupération de l'enregistrement ${recordId}:`, err);
        }
      };
      
      loadRecord();
    }
  }, [recordId, table]);
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = value;
    
    // Traiter les valeurs selon le type d'entrée
    if (type === 'checkbox') {
      finalValue = checked;
    } else if (type === 'number') {
      finalValue = value === '' ? '' : Number(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
    
    // Effacer l'erreur pour ce champ
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  const validateForm = () => {
    const errors = {};
    
    // Vérifier les champs obligatoires
    fields.forEach(field => {
      if (field.is_required && 
          (formData[field.slug] === undefined || 
           formData[field.slug] === null || 
           formData[field.slug] === '')) {
        errors[field.slug] = 'Ce champ est obligatoire';
      }
    });
    
    return errors;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      let result;
      
      if (recordId) {
        // Mode édition - Utiliser la fonction du contexte
        result = await updateRecord(recordId, formData);
      } else {
        // Mode création - Utiliser la fonction du contexte
        result = await createRecord(tableId, formData);
      }
      
      if (result) {
        setSuccessMessage(
          recordId
            ? 'Enregistrement mis à jour avec succès'
            : 'Enregistrement créé avec succès'
        );
        
        // Redirection après un court délai
        setTimeout(() => {
          navigate(`/admin/database/tables/${tableId}/records`);
        }, 1500);
      }
    } catch (err) {
      console.error(
        recordId
          ? `Erreur lors de la mise à jour de l'enregistrement ${recordId}:`
          : `Erreur lors de la création d'un enregistrement dans la table ${tableId}:`,
        err
      );
      
      // Afficher l'erreur dans le formulaire
      setFormErrors({
        submit: err.message || 'Une erreur est survenue lors de la sauvegarde'
      });
    }
  };
  
  // Fonctions de rendu pour chaque type de champ
  const renderTextField = (field, value, error) => (
    <FormField
      key={field.id}
      id={field.slug}
      name={field.slug}
      label={field.name}
      type="text"
      value={value}
      onChange={handleChange}
      required={field.is_required}
      error={error}
      helperText={field.description}
    />
  );

  const renderLongTextField = (field, value, error) => (
    <div key={field.id} className="form-control w-full">
      <label className="label">
        <span className="label-text">
          {field.name}
          {field.is_required && <span className="text-error ml-1">*</span>}
        </span>
      </label>
      <textarea
        id={field.slug}
        name={field.slug}
        value={value}
        onChange={handleChange}
        required={field.is_required}
        className={`textarea textarea-bordered h-24 w-full ${error ? 'textarea-error' : ''}`}
        placeholder={`Saisir ${field.name.toLowerCase()}`}
      />
      {(error || field.description) && (
        <label className="label">
          {error ? (
            <span className="label-text-alt text-error">{error}</span>
          ) : (
            <span className="label-text-alt">{field.description}</span>
          )}
        </label>
      )}
    </div>
  );

  const renderNumberField = (field, value, error) => (
    <FormField
      key={field.id}
      id={field.slug}
      name={field.slug}
      label={field.name}
      type="number"
      value={value}
      onChange={handleChange}
      required={field.is_required}
      error={error}
      helperText={field.description}
      step={field.field_type === 'decimal' ? '0.01' : '1'}
    />
  );

  const renderDateField = (field, value, error, type = 'date') => (
    <FormField
      key={field.id}
      id={field.slug}
      name={field.slug}
      label={field.name}
      type={type}
      value={value}
      onChange={handleChange}
      required={field.is_required}
      error={error}
      helperText={field.description}
    />
  );

  const renderBooleanField = (field, value, error) => (
    <div key={field.id} className="form-control w-full">
      <label className="label cursor-pointer">
        <span className="label-text">
          {field.name}
          {field.is_required && <span className="text-error ml-1">*</span>}
        </span>
        <input
          type="checkbox"
          id={field.slug}
          name={field.slug}
          checked={Boolean(value)}
          onChange={handleChange}
          className="toggle toggle-primary"
        />
      </label>
      {(error || field.description) && (
        <label className="label">
          {error ? (
            <span className="label-text-alt text-error">{error}</span>
          ) : (
            <span className="label-text-alt">{field.description}</span>
          )}
        </label>
      )}
    </div>
  );

  const renderChoiceField = (field, value, error) => {
    try {
      const options = field.options ? JSON.parse(field.options) : [];
      return (
        <div key={field.id} className="form-control w-full">
          <label className="label">
            <span className="label-text">
              {field.name}
              {field.is_required && <span className="text-error ml-1">*</span>}
            </span>
          </label>
          <select
            id={field.slug}
            name={field.slug}
            value={value}
            onChange={handleChange}
            required={field.is_required}
            className={`select select-bordered w-full ${error ? 'select-error' : ''}`}
          >
            <option value="">Sélectionner une option</option>
            {Array.isArray(options) && options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {(error || field.description) && (
            <label className="label">
              {error ? (
                <span className="label-text-alt text-error">{error}</span>
              ) : (
                <span className="label-text-alt">{field.description}</span>
              )}
            </label>
          )}
        </div>
      );
    } catch (e) {
      console.error(`Erreur lors du parsing des options pour le champ ${field.name}:`, e);
      return (
        <Alert type="error" message={`Erreur: Options invalides pour le champ ${field.name}`} />
      );
    }
  };

  // CORRIGÉ: Rendu pour les champs de clé étrangère (sans hooks internes)
  const renderForeignKeyField = (field, value, error) => {
    const choices = fkChoices[field.id] || [];
    const loading = fkLoading[field.id] || false;
    
    return (
      <div key={field.id} className="form-control w-full">
        <label className="label">
          <span className="label-text">
            {field.name}
            {field.is_required && <span className="text-error ml-1">*</span>}
          </span>
        </label>
        
        {loading ? (
          <div className="flex items-center space-x-2 p-3 border border-base-300 rounded-lg">
            <span className="loading loading-spinner loading-sm"></span>
            <span>Chargement des options...</span>
          </div>
        ) : (
          <select
            id={field.slug}
            name={field.slug}
            value={value || ''}
            onChange={handleChange}
            required={field.is_required}
            className={`select select-bordered w-full ${error ? 'select-error' : ''}`}
          >
            <option value="">Sélectionner une option</option>
            {choices.map(choice => (
              <option key={choice.value} value={choice.value}>
                {choice.display}
              </option>
            ))}
          </select>
        )}
        
        {(error || field.description) && (
          <label className="label">
            {error ? (
              <span className="label-text-alt text-error">{error}</span>
            ) : (
              <span className="label-text-alt">{field.description}</span>
            )}
          </label>
        )}
      </div>
    );
  };

  // Fonction principale de rendu des champs
  const renderField = (field) => {
    const value = formData[field.slug] !== undefined ? formData[field.slug] : '';
    const error = formErrors[field.slug] || '';
    
    switch (field.field_type) {
      case 'text':
        return renderTextField(field, value, error);
      case 'long_text':
        return renderLongTextField(field, value, error);
      case 'number':
      case 'decimal':
        return renderNumberField(field, value, error);
      case 'date':
        return renderDateField(field, value, error);
      case 'datetime':
        return renderDateField(field, value, error, 'datetime-local');
      case 'boolean':
        return renderBooleanField(field, value, error);
      case 'choice':
        return renderChoiceField(field, value, error);
      case 'foreign_key':
        return renderForeignKeyField(field, value, error);
      default:
        return renderTextField(field, value, error);
    }
  };
  
  return (
    
    <Card
      title={recordId ? 'Modifier un enregistrement' : 'Créer un enregistrement'}
      subtitle={table ? `Table: ${table.name}` : 'Chargement...'}
      width="lg"
    >
      {error && (
        <Alert type="error" message={error} className="mb-4" />
      )}
      
      {formErrors.submit && (
        <Alert type="error" message={formErrors.submit} className="mb-4" />
      )}
      
      {successMessage && (
        <Alert type="success" message={successMessage} className="mb-4" />
      )}
      
      {isLoading && !table ? (
        <div className="flex justify-center p-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(field => renderField(field))}
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(`/admin/database/tables/${tableId}/records`)}
            >
              Annuler
            </Button>
            
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              isDisabled={isLoading}
            >
              {recordId ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

RecordForm.propTypes = {
  tableId: PropTypes.string.isRequired,
  recordId: PropTypes.string
};

export default RecordForm;