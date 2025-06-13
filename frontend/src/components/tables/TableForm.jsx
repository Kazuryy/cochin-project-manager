// frontend/src/components/tables/TableForm.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useDynamicTables } from '../../contexts/hooks/useDynamicTables';
import { Card, Button, FormField, Alert } from '../ui';

function TableForm({ tableId }) {
  const navigate = useNavigate();
  const { 
    fetchTableWithFields, 
    createTable, 
    updateTable, 
    isLoading, 
    error
  } = useDynamicTables();
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    is_active: true
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Charger les données de la table si on est en mode édition
  useEffect(() => {
    if (tableId) {
      const loadTable = async () => {
        try {
          const table = await fetchTableWithFields(tableId);
          if (table) {
            setFormData({
              name: table.name || '',
              slug: table.slug || '',
              description: table.description || '',
              is_active: table.is_active
            });
          }
        } catch (err) {
          setFormErrors(prev => ({
            ...prev,
            general: `Erreur lors du chargement de la table: ${err.message}`
          }));
        }
      };
      
      loadTable();
    }
  }, [tableId, fetchTableWithFields]);
  
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Effacer l'erreur pour ce champ
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  }, [formErrors]);
  
  const validateForm = useCallback(() => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Le nom de la table est requis';
    } else if (formData.name.length > 50) {
      errors.name = 'Le nom ne doit pas dépasser 50 caractères';
    }
    
    if (tableId && !formData.slug.trim()) {
      errors.slug = "L'identifiant de la table est requis";
    } else if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
      errors.slug = "L'identifiant ne doit contenir que des lettres minuscules, des chiffres et des tirets";
    }
    
    return errors;
  }, [formData, tableId]);
  
  const generateSlug = useCallback((name) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }, []);
  
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsSubmitting(false);
      return;
    }

    try {
      const dataToSubmit = { ...formData };
      
      if (!tableId) {
        dataToSubmit.slug = generateSlug(formData.name);
        if (!dataToSubmit.slug) {
          dataToSubmit.slug = 'table';
        }
      }
      
      const result = tableId 
        ? await updateTable(tableId, formData)
        : await createTable(dataToSubmit);
      
      if (result) {
        setSuccessMessage(tableId ? 'Table mise à jour avec succès' : 'Table créée avec succès');
        
        setTimeout(() => {
          navigate('/admin/database/tables');
        }, 1500);
      }
    } catch (err) {
      setFormErrors(prev => ({
        ...prev,
        general: `Une erreur est survenue lors de l'enregistrement: ${err.message}`
      }));
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, tableId, validateForm, generateSlug, updateTable, createTable, navigate]);
  
  const isFormValid = useMemo(() => {
    return Object.keys(validateForm()).length === 0;
  }, [validateForm]);
  
  return (
    <Card
      title={tableId ? 'Modifier la table' : 'Créer une nouvelle table'}
      width="lg"
    >
      {error && (
        <Alert type="error" message={error} className="mb-4" />
      )}
      
      {formErrors.general && (
        <Alert type="error" message={formErrors.general} className="mb-4" />
      )}
      
      {successMessage && (
        <Alert type="success" message={successMessage} className="mb-4" />
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          id="name"
          name="name"
          label="Nom de la table"
          type="text"
          value={formData.name}
          onChange={handleChange}
          error={formErrors.name}
          required
          maxLength={50}
        />
        
        {tableId && (
          <FormField
            id="slug"
            name="slug"
            label="Identifiant (slug)"
            type="text"
            value={formData.slug}
            onChange={handleChange}
            error={formErrors.slug}
            helperText="Identifiant unique utilisé dans l'API"
            required
            pattern="[a-z0-9-]+"
          />
        )}
        
        <FormField
          id="description"
          name="description"
          label="Description"
          type="textarea"
          value={formData.description}
          onChange={handleChange}
          error={formErrors.description}
          maxLength={500}
        />
        
        <div className="form-control">
          <label className="label cursor-pointer">
            <span className="label-text">Table active</span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
            />
          </label>
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/admin/database/tables')}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading || isSubmitting}
            isDisabled={isLoading || isSubmitting || !isFormValid}
          >
            {tableId ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

TableForm.propTypes = {
  tableId: PropTypes.string
};

export default TableForm;