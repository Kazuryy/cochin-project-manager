// frontend/src/contexts/DynamicTableContext.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { DynamicTableContext } from './context';
import api from '../services/api';

/**
 * @typedef {Object} Table
 * @property {number} id - Identifiant unique de la table
 * @property {string} name - Nom de la table
 * @property {Array<Field>} fields - Champs de la table
 */

/**
 * @typedef {Object} Field
 * @property {number} id - Identifiant unique du champ
 * @property {string} name - Nom du champ
 * @property {string} type - Type du champ
 */

/**
 * Provider du contexte pour la gestion des tables dynamiques
 * @param {Object} props - Propriétés du composant
 * @param {React.ReactNode} props.children - Composants enfants
 */
export function DynamicTableProvider({ children }) {
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cache, setCache] = useState(new Map());

  // Fonction pour récupérer toutes les tables
  const fetchTables = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.get('/api/database/tables/');
      setTables(data);
      // Mise en cache des tables
      setCache(prev => {
        const newCache = new Map(prev);
        data.forEach(table => newCache.set(`table_${table.id}`, table));
        return newCache;
      });
    } catch (err) {
      console.error('Erreur lors de la récupération des tables:', err);
      setError(err.message || 'Une erreur est survenue lors de la récupération des tables');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fonction pour récupérer une table spécifique avec ses champs
  const fetchTableWithFields = useCallback(async (tableId) => {
    const cacheKey = `table_${tableId}_with_fields`;
    
    // Vérifier le cache
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const [table, fields] = await Promise.all([
        api.get(`/api/database/tables/${tableId}/`),
        api.get(`/api/database/tables/${tableId}/fields/`)
      ]);
      
      const result = { ...table, fields };
      
      // Mise en cache
      setCache(prev => {
        const newCache = new Map(prev);
        newCache.set(cacheKey, result);
        return newCache;
      });
      
      return result;
    } catch (err) {
      console.error(`Erreur lors de la récupération de la table ${tableId}:`, err);
      setError(err.message || `Une erreur est survenue lors de la récupération de la table ${tableId}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [cache]);

  // Fonction pour créer une nouvelle table
  const createTable = useCallback(async (tableData) => {
    if (!tableData?.name) {
      setError('Le nom de la table est requis');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newTable = await api.post('/api/database/tables/', tableData);
      
      setTables(prevTables => [...prevTables, newTable]);
      setCache(prev => {
        const newCache = new Map(prev);
        newCache.set(`table_${newTable.id}`, newTable);
        return newCache;
      });
      
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

  // Valeur du contexte optimisée
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