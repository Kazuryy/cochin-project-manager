import { useContext } from 'react';
import { DynamicTableContext } from '../context';

/**
 * Hook personnalisé pour accéder au contexte des tables dynamiques
 * @returns {Object} Le contexte des tables dynamiques
 * @throws {Error} Si le hook est utilisé en dehors d'un DynamicTableProvider
 */
export const useDynamicTables = () => {
  const context = useContext(DynamicTableContext);
  
  if (context === undefined) {
    throw new Error(
      'useDynamicTables doit être utilisé à l\'intérieur d\'un DynamicTableProvider. ' +
      'Veuillez vérifier que votre composant est bien enveloppé dans un DynamicTableProvider.'
    );
  }
  
  return context;
}; 