import { createContext } from 'react';

export const DynamicTableContext = createContext({
  tables: [],
  isLoading: false,
  error: null,
  fetchTables: () => {},
  fetchTableWithFields: () => {},
  createTable: () => {},
  updateTable: () => {},
  deleteTable: () => {},
  addFieldToTable: () => {},
  fetchRecords: () => {},
  createRecord: () => {},
  updateRecord: () => {},
  deleteRecord: () => {},
}); 