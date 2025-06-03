import { useContext } from 'react';
import { DynamicTableContext } from '../context';

export const useDynamicTables = () => {
  const context = useContext(DynamicTableContext);
  
  if (context === undefined) {
    throw new Error('useDynamicTables must be used within a DynamicTableProvider');
  }
  
  return context;
}; 