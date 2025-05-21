import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { DynamicTableContext } from './context';

export function DynamicTableProvider({ children }) {
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fonction pour récupérer toutes les tables
  const fetchTables = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/database/tables/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      
      const data = await response.json();
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
      const tableResponse = await fetch(`/api/database/tables/${tableId}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!tableResponse.ok) {
        throw new Error(`Erreur HTTP ${tableResponse.status}`);
      }
      
      const table = await tableResponse.json();
      
      const fieldsResponse = await fetch(`/api/database/tables/${tableId}/fields/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!fieldsResponse.ok) {
        throw new Error(`Erreur HTTP ${fieldsResponse.status}`);
      }
      
      const fields = await fieldsResponse.json();
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
      // Obtenir un token CSRF
      const csrfResponse = await fetch('/api/auth/csrf/', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!csrfResponse.ok) {
        throw new Error(`Erreur lors de l'obtention du token CSRF: ${csrfResponse.status}`);
      }
      
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrfToken;
      
      // S'assurer que les données sont complètes
      const completeTableData = {
        ...tableData,
        // Ajouter d'autres champs par défaut si nécessaire
      };
      
      console.log("Données complètes à envoyer:", completeTableData);
      
      const response = await fetch('/api/database/tables/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(completeTableData),
      });
      
      if (!response.ok) {
        // Essayer de récupérer des informations d'erreur plus détaillées
        try {
          const errorData = await response.json();
          console.error("Détails de l'erreur du serveur:", errorData);
          throw new Error(errorData.detail || JSON.stringify(errorData) || `Erreur HTTP ${response.status}`);
        } catch {
          throw new Error(`Erreur HTTP ${response.status}`);
        }
      }
      
      const newTable = await response.json();
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
      const response = await fetch(`/api/database/tables/${tableId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(tableData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Erreur HTTP ${response.status}`);
      }
      
      const updatedTable = await response.json();
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
      const response = await fetch(`/api/database/tables/${tableId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Erreur HTTP ${response.status}`);
      }
      
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
      const response = await fetch(`/api/database/tables/${tableId}/add_field/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(fieldData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Erreur HTTP ${response.status}`);
      }
      
      const newField = await response.json();
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
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url += `&field_${key}=${encodeURIComponent(value)}`;
        }
      });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      
      const records = await response.json();
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
      const response = await fetch('/api/database/records/create_with_values/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          table_id: tableId,
          values: values,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Erreur HTTP ${response.status}`);
      }
      
      const newRecord = await response.json();
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
      const response = await fetch(`/api/database/records/${recordId}/update_with_values/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          values: values,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Erreur HTTP ${response.status}`);
      }
      
      const updatedRecord = await response.json();
      return updatedRecord;
    } catch (err) {
      console.error(`Erreur lors de la mise à jour de l'enregistrement ${recordId}:`, err);
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
      const response = await fetch(`/api/database/records/${recordId}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Erreur HTTP ${response.status}`);
      }
      
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