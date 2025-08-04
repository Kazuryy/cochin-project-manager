// frontend/src/components/tables/RecordForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useDynamicTables } from '../../contexts/hooks/useDynamicTables';
import { Card, Button, FormField, Alert } from '../ui';
import api from '../../services/api';

// Composants de rendu extraits
const TextField = React.memo(({ field, value, error, onChange }) => (
  <FormField
    key={field.id}
    id={field.slug}
    name={field.slug}
    label={field.name}
    type="text"
    value={value}
    onChange={onChange}
    required={field.is_required}
    error={error}
    helperText={field.description}
    aria-invalid={!!error}
    aria-describedby={error ? `${field.slug}-error` : undefined}
  />
));

const LongTextField = React.memo(({ field, value, error, onChange }) => (
  <div key={field.id} className="form-control w-full">
    <label className="label">
      <span className="label-text">
        {field.name}
        {field.is_required && <span className="text-error ml-1" aria-hidden="true">*</span>}
      </span>
    </label>
    <textarea
      id={field.slug}
      name={field.slug}
      value={value}
      onChange={onChange}
      required={field.is_required}
      className={`textarea textarea-bordered h-24 w-full ${error ? 'textarea-error' : ''}`}
      placeholder={`Saisir ${field.name.toLowerCase()}`}
      aria-invalid={!!error}
      aria-describedby={error ? `${field.slug}-error` : undefined}
    />
    {(error || field.description) && (
      <label className="label">
        {error ? (
          <span id={`${field.slug}-error`} className="label-text-alt text-error">{error}</span>
        ) : (
          <span className="label-text-alt">{field.description}</span>
        )}
      </label>
    )}
  </div>
));

const NumberField = React.memo(({ field, value, error, onChange }) => (
  <FormField
    key={field.id}
    id={field.slug}
    name={field.slug}
    label={field.name}
    type="number"
    value={value}
    onChange={onChange}
    required={field.is_required}
    error={error}
    helperText={field.description}
    step={field.field_type === 'decimal' ? '0.01' : '1'}
    aria-invalid={!!error}
    aria-describedby={error ? `${field.slug}-error` : undefined}
  />
));

const DateField = React.memo(({ field, value, error, onChange, type = 'date' }) => (
  <FormField
    key={field.id}
    id={field.slug}
    name={field.slug}
    label={field.name}
    type={type}
    value={value}
    onChange={onChange}
    required={field.is_required}
    error={error}
    helperText={field.description}
    aria-invalid={!!error}
    aria-describedby={error ? `${field.slug}-error` : undefined}
  />
));

const BooleanField = React.memo(({ field, value, error, onChange }) => (
  <div key={field.id} className="form-control w-full">
    <label className="label cursor-pointer">
      <span className="label-text">
        {field.name}
        {field.is_required && <span className="text-error ml-1" aria-hidden="true">*</span>}
      </span>
      <input
        type="checkbox"
        id={field.slug}
        name={field.slug}
        checked={Boolean(value)}
        onChange={onChange}
        className="toggle toggle-primary"
        aria-invalid={!!error}
        aria-describedby={error ? `${field.slug}-error` : undefined}
      />
    </label>
    {(error || field.description) && (
      <label className="label">
        {error ? (
          <span id={`${field.slug}-error`} className="label-text-alt text-error">{error}</span>
        ) : (
          <span className="label-text-alt">{field.description}</span>
        )}
      </label>
    )}
  </div>
));

const ChoiceField = React.memo(({ field, value, error, onChange }) => {
  try {
    const options = field.options ? JSON.parse(field.options) : [];
    return (
      <div key={field.id} className="form-control w-full">
        <label className="label">
          <span className="label-text">
            {field.name}
            {field.is_required && <span className="text-error ml-1" aria-hidden="true">*</span>}
          </span>
        </label>
        <select
          id={field.slug}
          name={field.slug}
          value={value}
          onChange={onChange}
          required={field.is_required}
          className={`select select-bordered w-full ${error ? 'select-error' : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${field.slug}-error` : undefined}
        >
          <option value="">Sélectionner une option</option>
          {Array.isArray(options) && options.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        {(error || field.description) && (
          <label className="label">
            {error ? (
              <span id={`${field.slug}-error`} className="label-text-alt text-error">{error}</span>
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
});

const ForeignKeyField = React.memo(({ field, value, error, onChange, fkState }) => {
  const fieldState = fkState[field.id] || { loading: false, choices: [] };
  
  return (
    <div key={field.id} className="form-control w-full">
      <label className="label">
        <span className="label-text">
          {field.name}
          {field.is_required && <span className="text-error ml-1" aria-hidden="true">*</span>}
        </span>
      </label>
      
      {fieldState.loading ? (
        <div className="flex items-center space-x-2 p-3 border border-base-300 rounded-lg">
          <span className="loading loading-spinner loading-sm"></span>
          <span>Chargement des options...</span>
        </div>
      ) : (
        <select
          id={field.slug}
          name={field.slug}
          value={value || ''}
          onChange={onChange}
          required={field.is_required}
          className={`select select-bordered w-full ${error ? 'select-error' : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${field.slug}-error` : undefined}
        >
          <option value="">Sélectionner une option</option>
          {fieldState.choices.map(choice => (
            <option key={choice.value} value={choice.value}>
              {choice.display}
            </option>
          ))}
        </select>
      )}
      
      {(error || field.description) && (
        <label className="label">
          {error ? (
            <span id={`${field.slug}-error`} className="label-text-alt text-error">{error}</span>
          ) : (
            <span className="label-text-alt">{field.description}</span>
          )}
        </label>
      )}
    </div>
  );
});

// Validation des props pour les composants de rendu
const fieldPropTypes = {
  field: PropTypes.shape({
    id: PropTypes.string.isRequired,
    slug: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    is_required: PropTypes.bool,
    description: PropTypes.string,
    field_type: PropTypes.string.isRequired,
    options: PropTypes.string
  }).isRequired,
  value: PropTypes.any,
  error: PropTypes.string,
  onChange: PropTypes.func.isRequired
};

TextField.propTypes = fieldPropTypes;
LongTextField.propTypes = fieldPropTypes;
NumberField.propTypes = fieldPropTypes;
DateField.propTypes = {
  ...fieldPropTypes,
  type: PropTypes.string
};
BooleanField.propTypes = fieldPropTypes;
ChoiceField.propTypes = fieldPropTypes;
ForeignKeyField.propTypes = {
  ...fieldPropTypes,
  fkState: PropTypes.object.isRequired
};

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
  const [fkState, setFkState] = useState({});

  // Fonction utilitaire pour extraire des valeurs d'un enregistrement avec fallbacks
  const getFieldValue = useCallback((record, ...possibleFields) => {
    if (!record) return '';
    
    for (const field of possibleFields) {
      if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
        return record[field];
      }
    }
    
    if (record.values && Array.isArray(record.values)) {
      for (const field of possibleFields) {
        const valueField = record.values.find(v => v.field_slug === field);
        if (valueField?.value && valueField.value !== undefined && valueField.value !== null && valueField.value !== '') {
          return valueField.value;
        }
      }
    }
    
    return '';
  }, []);

  // Fonctions utilitaires extraites (définies avant leur utilisation)
  const getTargetColumn = useCallback((field) => {
    const fieldNameLower = field.name.toLowerCase();
    
    if (fieldNameLower.includes('sous_type') || fieldNameLower.includes('soustype') || fieldNameLower.includes('sous type')) {
      const tableName = table?.name || '';
      
      // Extraire le type depuis le nom de la table (ex: "DetailsCollaboration" → "collaboration")
      const typeFromTable = tableName.replace('Details', '').toLowerCase();
      
      // Retourner le slug normalisé pour correspondre à la table Choix
      if (typeFromTable) {
        const targetSlug = `sous_type_${typeFromTable}`;
        console.log(`🎯 RecordForm - Champ sous-type détecté: ${field.name}`);
        console.log(`   - Table: ${tableName}`);
        console.log(`   - Type extrait: ${typeFromTable}`);
        console.log(`   - Slug cible: ${targetSlug}`);
        return targetSlug;
      }
      
      return 'sous_type'; // Fallback
    }
    
    return fieldNameLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }, [table]);

  const extractValue = useCallback((record, targetColumn, field) => {
    if (targetColumn) {
      const value = getFieldValue(record, targetColumn, field);
      if (value) return value;
    }
    
    const genericValue = getFieldValue(record, 'nom_projet', 'nom', 'name', 'label', 'title', 'value');
    if (genericValue) return genericValue;
    
    return getFieldValue(record, field.name, field.name.toLowerCase());
  }, [getFieldValue]);

  // Fonction pour trier les choix par ordre alphabétique
  const sortChoices = useCallback((choices) => {
    if (!Array.isArray(choices)) return [];
    return choices.sort((a, b) => a.display.localeCompare(b.display));
  }, []);

  // Optimisation du chargement des FK
  const loadFkChoicesForField = useCallback(async (field) => {
    setFkState(prev => ({ ...prev, [field.id]: { loading: true } }));
    
    try {
      const response = await api.get(`/api/database/tables/${field.related_table}/records`);
      const recordsList = response || [];
      
      const uniqueValues = new Set();
      const options = [];

      recordsList.forEach(record => {
        const targetColumn = getTargetColumn(field);
        const extractedValue = extractValue(record, targetColumn, field);
        
        if (extractedValue && typeof extractedValue === 'string') {
          const trimmedValue = extractedValue.trim();
          
          if (trimmedValue && !uniqueValues.has(trimmedValue)) {
            uniqueValues.add(trimmedValue);
            options.push({
              value: trimmedValue,
              label: trimmedValue
            });
          }
        }
      });

      const choices = options.map(option => ({
        value: option.value,
        display: option.label
      }));
      
      setFkState(prev => ({
        ...prev,
        [field.id]: {
          loading: false,
          choices: sortChoices(choices)
        }
      }));
      
    } catch (err) {
      console.error(`Erreur lors du chargement des choix FK pour ${field.name}:`, err);
      setFkState(prev => ({
        ...prev,
        [field.id]: {
          loading: false,
          choices: [],
          error: err.message
        }
      }));
    }
  }, [getTargetColumn, extractValue, sortChoices]);

  // Charger les données de la table et ses champs
  useEffect(() => {
    const loadTable = async () => {
      const tableData = await fetchTableWithFields(tableId);
      if (tableData) {
        setTable(tableData);
        setFields(tableData.fields || []);
        
        // N'initialiser le formulaire avec les valeurs par défaut que si on n'est PAS en mode édition
        if (!recordId) {
          const initialFormData = {};
          tableData.fields?.forEach(field => {
            initialFormData[field.slug] = field.default_value || '';
          });
          setFormData(initialFormData);
        }
      }
    };
    
    loadTable();
  }, [tableId, fetchTableWithFields, recordId]);

  // Charger les choix FK pour tous les champs FK
  useEffect(() => {
    const loadAllFkChoices = async () => {
      const fkFields = fields.filter(field => field.field_type === 'foreign_key');
      for (const field of fkFields) {
        if (field.related_table && !fkState[field.id]) {
          await loadFkChoicesForField(field);
        }
      }
    };
    
    if (fields.length > 0) {
      loadAllFkChoices();
    }
  }, [fields, fkState, loadFkChoicesForField]);
  
  // Si on est en mode édition, charger les données de l'enregistrement
  useEffect(() => {
    if (recordId && table && table.fields && table.fields.length > 0) {
      const loadRecord = async () => {
        try {
          console.log(`🔄 Chargement de l'enregistrement ${recordId}...`);
          
          // Utiliser le service API centralisé au lieu de fetch direct
          const record = await api.get(`/api/database/records/${recordId}/`);
          console.log(`📋 Données de l'enregistrement reçues:`, record);
          
          // Traiter les valeurs pour les FK
          const processedFormData = {};
          
          table.fields.forEach(field => {
            console.log(`🔍 Traitement du champ: ${field.name} (${field.slug}) - Type: ${field.field_type}`);
            
            if (field.field_type === 'foreign_key') {
              // Pour les FK, la valeur est déjà le texte affiché (ex: "Spatial", "Bonne")
              // Pas besoin de convertir, on utilise directement la valeur
              const fieldValue = record[field.slug] || '';
              processedFormData[field.slug] = fieldValue;
              
              console.log(`✅ FK ${field.slug}: "${fieldValue}"`);
            } else {
              // Pour les autres champs, utiliser la valeur directement
              processedFormData[field.slug] = record[field.slug] || '';
              
              console.log(`✅ Normal ${field.slug}: "${record[field.slug]}"`);
            }
          });
          
          console.log('🎯 Données du formulaire finales:', processedFormData);
          setFormData(processedFormData);
        } catch (err) {
          console.error(`Erreur lors de la récupération de l'enregistrement ${recordId}:`, err);
        }
      };
      
      loadRecord();
    }
  }, [recordId, table]); // Ajouter table comme dépendance complète
  
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
  
  // Fonction utilitaire pour valider les dates
  const isValidDate = useCallback((dateString) => {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }, []);

  // Validation des données
  const validateForm = useCallback(() => {
    const errors = {};
    
    fields.forEach(field => {
      const value = formData[field.slug];
      
      // Validation des champs obligatoires
      if (field.is_required && 
          (value === undefined || value === null || value === '')) {
        errors[field.slug] = 'Ce champ est obligatoire';
      }
      
      // Validation spécifique selon le type de champ
      if (value !== undefined && value !== null && value !== '') {
        switch (field.field_type) {
          case 'number':
          case 'decimal':
            if (isNaN(Number(value))) {
              errors[field.slug] = 'Veuillez entrer un nombre valide';
            }
            break;
          case 'date':
          case 'datetime':
            if (!isValidDate(value)) {
              errors[field.slug] = 'Veuillez entrer une date valide';
            }
            break;
          case 'foreign_key':
            if (!fkState[field.id]?.choices?.some(choice => choice.value === value)) {
              errors[field.slug] = 'Veuillez sélectionner une option valide';
            }
            break;
          default:
            break;
        }
      }
    });
    
    return errors;
  }, [fields, formData, fkState, isValidDate]);

  // Gestion des erreurs API
  const handleApiError = useCallback((error, context) => {
    console.error(`Erreur ${context}:`, error);
    
    let errorMessage = 'Une erreur est survenue';
    
    if (error.response) {
      // Erreur avec réponse du serveur
      const { data, status } = error.response;
      
      if (data?.detail) {
        errorMessage = data.detail;
      } else if (data?.message) {
        errorMessage = data.message;
      } else if (status === 404) {
        errorMessage = 'La ressource demandée n\'existe pas';
      } else if (status === 403) {
        errorMessage = 'Vous n\'avez pas les droits nécessaires';
      } else if (status === 401) {
        errorMessage = 'Vous devez être connecté pour effectuer cette action';
      }
    } else if (error.request) {
      // Erreur sans réponse du serveur
      errorMessage = 'Le serveur ne répond pas';
    }
    
    setFormErrors(prev => ({
      ...prev,
      submit: errorMessage
    }));
  }, []);

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
        result = await updateRecord(recordId, formData);
      } else {
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
      handleApiError(err, recordId ? 'lors de la mise à jour' : 'lors de la création');
    }
  };
  
  // Fonction principale de rendu des champs
  const renderField = (field) => {
    const value = formData[field.slug] !== undefined ? formData[field.slug] : '';
    const error = formErrors[field.slug] || '';
    
    const commonProps = {
      field,
      value,
      error,
      onChange: handleChange
    };
    
    switch (field.field_type) {
      case 'text':
        return <TextField {...commonProps} />;
      case 'long_text':
        return <LongTextField {...commonProps} />;
      case 'number':
      case 'decimal':
        return <NumberField {...commonProps} />;
      case 'date':
        return <DateField {...commonProps} />;
      case 'datetime':
        return <DateField {...commonProps} type="datetime-local" />;
      case 'boolean':
        return <BooleanField {...commonProps} />;
      case 'choice':
        return <ChoiceField {...commonProps} />;
      case 'foreign_key':
        return <ForeignKeyField {...commonProps} fkState={fkState} />;
      default:
        return <TextField {...commonProps} />;
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
          {fields.map(field => (
            <div key={field.id}>
              {renderField(field)}
            </div>
          ))}
          
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