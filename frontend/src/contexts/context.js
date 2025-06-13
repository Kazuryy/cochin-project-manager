import { createContext, useContext } from 'react';

/**
 * @typedef {Object} TableRecord
 * @property {string} id - Identifiant unique du record
 * @property {Object} data - Données du record
 */

/**
 * @typedef {Object} TableField
 * @property {string} id - Identifiant unique du champ
 * @property {string} name - Nom du champ
 * @property {string} type - Type de données du champ
 */

/**
 * @typedef {Object} Table
 * @property {string} id - Identifiant unique de la table
 * @property {string} name - Nom de la table
 * @property {TableField[]} fields - Champs de la table
 * @property {TableRecord[]} records - Records de la table
 */

/**
 * @typedef {Object} DynamicTableContextType
 * @property {Table[]} tables - Liste des tables
 * @property {boolean} isLoading - État de chargement
 * @property {Error|null} error - Erreur éventuelle
 * @property {Function} fetchTables - Récupère toutes les tables
 * @property {Function} fetchTableWithFields - Récupère une table avec ses champs
 * @property {Function} createTable - Crée une nouvelle table
 * @property {Function} updateTable - Met à jour une table existante
 * @property {Function} deleteTable - Supprime une table
 * @property {Function} addFieldToTable - Ajoute un champ à une table
 * @property {Function} fetchRecords - Récupère les records d'une table
 * @property {Function} createRecord - Crée un nouveau record
 * @property {Function} updateRecord - Met à jour un record existant
 * @property {Function} deleteRecord - Supprime un record
 */

// Valeurs par défaut pour le contexte
const DEFAULT_CONTEXT = {
  tables: [],
  isLoading: false,
  error: null,
  fetchTables: () => Promise.reject(new Error('fetchTables not implemented')),
  fetchTableWithFields: () => Promise.reject(new Error('fetchTableWithFields not implemented')),
  createTable: () => Promise.reject(new Error('createTable not implemented')),
  updateTable: () => Promise.reject(new Error('updateTable not implemented')),
  deleteTable: () => Promise.reject(new Error('deleteTable not implemented')),
  addFieldToTable: () => Promise.reject(new Error('addFieldToTable not implemented')),
  fetchRecords: () => Promise.reject(new Error('fetchRecords not implemented')),
  createRecord: () => Promise.reject(new Error('createRecord not implemented')),
  updateRecord: () => Promise.reject(new Error('updateRecord not implemented')),
  deleteRecord: () => Promise.reject(new Error('deleteRecord not implemented')),
};

// Création du contexte avec les valeurs par défaut
export const DynamicTableContext = createContext(DEFAULT_CONTEXT);

/**
 * Hook personnalisé pour utiliser le contexte des tables dynamiques
 * @returns {DynamicTableContextType} Le contexte des tables dynamiques
 */
export const useDynamicTableContext = () => {
  const context = useContext(DynamicTableContext);
  if (!context) {
    throw new Error('useDynamicTableContext must be used within a DynamicTableProvider');
  }
  return context;
}; 