import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { DynamicTableContext } from './context';
import api from '../services/api';

export function DynamicTableProvider({ children }) {
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fonction pour récupérer toutes les tables
  const fetchTables = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.get('/api/database/tables/');
      setTables(data);
    } catch (err) {
      console.error('Erreur lors de la récupération des tables:', err);
      setError(err.message || 'Une erreur est survenue lors de la récupération des tables');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction pour récupérer une table spécifique avec ses champs
  const fetchTableWithFields = useCallback(async (tableId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Récupération de la table
      const table = await api.get(`/api/database/tables/${tableId}/`);
      
      // Récupération des champs
      const fields = await api.get(`/api/database/tables/${tableId}/fields/`);
      
      // Combiner la table et ses champs
      return { ...table, fields };
    } catch (err) {
      console.error(`Erreur lors de la récupération de la table ${tableId}:`, err);
      setError(err.message || `Une erreur est survenue lors de la récupération de la table ${tableId}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction pour créer une nouvelle table
  const createTable = useCallback(async (tableData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Données à envoyer:", tableData);
      
      const newTable = await api.post('/api/database/tables/', tableData);
      
      // Mettre à jour la liste des tables
      setTables((prevTables) => [...prevTables, newTable]);
      
      return newTable;
    } catch (err) {
      console.error('Erreur lors de la création de la table:', err);
      setError(err.message || 'Une erreur est survenue lors de la création de la table');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction pour mettre à jour une table
  const updateTable = useCallback(async (tableId, tableData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const updatedTable = await api.patch(`/api/database/tables/${tableId}/`, tableData);
      
      // Mettre à jour la liste des tables
      setTables((prevTables) =>
        prevTables.map((table) => (table.id === tableId ? updatedTable : table))
      );
      
      return updatedTable;
    } catch (err) {
      console.error(`Erreur lors de la mise à jour de la table ${tableId}:`, err);
      setError(err.message || `Une erreur est survenue lors de la mise à jour de la table ${tableId}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction pour supprimer une table
  const deleteTable = useCallback(async (tableId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await api.delete(`/api/database/tables/${tableId}/`);
      
      // Mettre à jour la liste des tables
      setTables((prevTables) => prevTables.filter((table) => table.id !== tableId));
      
      return true;
    } catch (err) {
      console.error(`Erreur lors de la suppression de la table ${tableId}:`, err);
      setError(err.message || `Une erreur est survenue lors de la suppression de la table ${tableId}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction pour ajouter un champ à une table
  const addFieldToTable = useCallback(async (tableId, fieldData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const newField = await api.post(`/api/database/tables/${tableId}/add_field/`, fieldData);
      
      return newField;
    } catch (err) {
      console.error(`Erreur lors de l'ajout d'un champ à la table ${tableId}:`, err);
      setError(err.message || `Une erreur est survenue lors de l'ajout d'un champ à la table ${tableId}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction pour supprimer un champ
  const deleteField = useCallback(async (tableId, fieldId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Suppression du champ:', fieldId);
      
      // Utiliser le service API centralisé
      await api.delete(`/api/database/fields/${fieldId}/`);
      
      console.log('Champ supprimé avec succès');
      return true;
    } catch (err) {
      console.error(`Erreur lors de la suppression du champ ${fieldId}:`, err);
      setError(err.message || `Une erreur est survenue lors de la suppression du champ`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction pour mettre à jour un champ
  const updateField = useCallback(async (fieldId, fieldData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Mise à jour du champ:', fieldId, fieldData);
      
      const updatedField = await api.put(`/api/database/fields/${fieldId}/`, fieldData);
      
      console.log('Champ mis à jour avec succès');
      return updatedField;
    } catch (err) {
      console.error(`Erreur lors de la mise à jour du champ ${fieldId}:`, err);
      setError(err.message || `Une erreur est survenue lors de la mise à jour du champ`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction pour récupérer les enregistrements d'une table
  const fetchRecords = useCallback(async (tableId, filters = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let url = `/api/database/records/by_table/?table_id=${tableId}`;
      
      // Ajouter les filtres à l'URL
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url += `&field_${key}=${encodeURIComponent(value)}`;
        }
      });
      
      const records = await api.get(url);
      
      return records;
    } catch (err) {
      console.error(`Erreur lors de la récupération des enregistrements de la table ${tableId}:`, err);
      setError(err.message || `Une erreur est survenue lors de la récupération des enregistrements de la table ${tableId}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction pour créer un nouvel enregistrement
  const createRecord = useCallback(async (tableId, values) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Préparer les données au format attendu par le backend
      const dataToSend = {
        table_id: parseInt(tableId),
        values: {}
      };
      
      // Nettoyer les valeurs - convertir tout en string sauf les valeurs vides
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (typeof value === 'boolean') {
            dataToSend.values[key] = value ? 'true' : 'false';
          } else {
            dataToSend.values[key] = value.toString();
          }
        }
      });
      
      console.log('Création - Données envoyées:', dataToSend);
      
      const newRecord = await api.post('/api/database/records/create_with_values/', dataToSend);
      
      return newRecord;
    } catch (err) {
      console.error(`Erreur lors de la création d'un enregistrement dans la table ${tableId}:`, err);
      setError(err.message || `Une erreur est survenue lors de la création d'un enregistrement dans la table ${tableId}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction pour mettre à jour un enregistrement
  const updateRecord = useCallback(async (recordId, values) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Préparer les données au format attendu par le backend
      const dataToSend = {
        values: {}
      };
      
      // Filtrer les champs système et ne garder que les champs de la table dynamique
      const systemFields = ['id', 'created_at', 'updated_at'];
      
      // Nettoyer les valeurs - convertir tout en string sauf les valeurs vides
      Object.entries(values).forEach(([key, value]) => {
        // Ignorer les champs système
        if (systemFields.includes(key)) {
          return;
        }
        
        if (value !== undefined && value !== null && value !== '') {
          if (typeof value === 'boolean') {
            dataToSend.values[key] = value ? 'true' : 'false';
          } else {
            dataToSend.values[key] = value.toString();
          }
        }
      });
      
      console.log('Mise à jour - Record ID:', recordId);
      console.log('Mise à jour - Données envoyées:', dataToSend);
      
      const updatedRecord = await api.patch(`/api/database/records/${recordId}/update_with_values/`, dataToSend);
      
      console.log('Mise à jour - Réponse reçue:', updatedRecord);
      
      return updatedRecord;
    } catch (err) {
      console.error(`Erreur lors de la mise à jour de l'enregistrement ${recordId}:`, err);
      console.error('Détails de l\'erreur:', err);
      setError(err.message || `Une erreur est survenue lors de la mise à jour de l'enregistrement ${recordId}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction pour supprimer un enregistrement
  const deleteRecord = useCallback(async (recordId) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await api.delete(`/api/database/records/${recordId}/`);
      return true;
    } catch (err) {
      console.error(`Erreur lors de la suppression de l'enregistrement ${recordId}:`, err);
      setError(err.message || `Une erreur est survenue lors de la suppression de l'enregistrement ${recordId}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Charger les tables au montage du composant
  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Valeur du contexte
  const value = useMemo(() => ({
    tables,
    isLoading,
    error,
    fetchTables,
    fetchTableWithFields,
    createTable,
    updateTable,
    deleteTable,
    addFieldToTable,
    deleteField,
    updateField,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord,
  }), [
    tables,
    isLoading,
    error,
    fetchTables,
    fetchTableWithFields,
    createTable,
    updateTable,
    deleteTable,
    addFieldToTable,
    deleteField,
    updateField,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord
  ]);

  return (
    <DynamicTableContext.Provider value={value}>
      {children}
    </DynamicTableContext.Provider>
  );
}

DynamicTableProvider.propTypes = {
  children: PropTypes.node.isRequired,
};