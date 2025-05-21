import { useContext } from 'react';
import { DynamicTableContext } from '../DynamicTableContext';

export function useDynamicTables() {
  const context = useContext(DynamicTableContext);
  if (!context) {
    throw new Error('useDynamicTables doit être utilisé à l\'intérieur d\'un DynamicTableProvider');
  }
  return context;
} 