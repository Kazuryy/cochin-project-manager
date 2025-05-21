// frontend/src/components/tables/TableForm.jsx
import React, { useState, useEffect } from 'react';
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
  
  // Charger les données de la table si on est en mode édition
  useEffect(() => {
    if (tableId) {
      const loadTable = async () => {
        const table = await fetchTableWithFields(tableId);
        if (table) {
          setFormData({
            name: table.name || '',
            slug: table.slug || '',
            description: table.description || '',
            is_active: table.is_active
          });
        }
      };
      
      loadTable();
    }
  }, [tableId, fetchTableWithFields]);
  
  const handleChange = (e) => {
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
  };
  
  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Le nom de la table est requis';
    }
    
    if (tableId && !formData.slug.trim()) {
      errors.slug = "L'identifiant de la table est requis";
    }
    
    return errors;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Créer une copie des données du formulaire
    const dataToSubmit = { ...formData };
    
    // Générer automatiquement le slug si on est en mode création
    if (!tableId) {
      // Version simple : juste le nom en minuscules avec traitement basique
      dataToSubmit.slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')  // Caractères non alphanumériques → tirets
        .replace(/(^-|-$)/g, '');     // Enlever tirets au début/fin
        
      // Fallback pour les cas extrêmes
      if (!dataToSubmit.slug) {
        dataToSubmit.slug = 'table';
      }
    }
    
    let result;
    if (tableId) {
      // Mode édition
      result = await updateTable(tableId, formData);
    } else {
      // Mode création
      result = await createTable(dataToSubmit);
      console.log(dataToSubmit)
    }
    
    if (result) {
      setSuccessMessage(tableId ? 'Table mise à jour avec succès' : 'Table créée avec succès');
      
      setTimeout(() => {
        navigate('/admin/database/tables');
      }, 1500);
    }
  };
  
  return (
    <Card
      title={tableId ? 'Modifier la table' : 'Créer une nouvelle table'}
      width="lg"
    >
      {error && (
        <Alert type="error" message={error} className="mb-4" />
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
            onClick={() => navigate('/admin/tables')}
          >
            Annuler
          </Button>
          
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            isDisabled={isLoading}
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