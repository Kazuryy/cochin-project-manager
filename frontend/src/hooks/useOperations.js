import { useState, useCallback, useRef } from 'react';
import { useToast } from '../components/common/Toast';

/**
 * Hook personnalisé pour gérer les opérations asynchrones avec état de chargement et gestion des erreurs
 * 
 * @param {Function} loadData - Fonction à appeler après une opération réussie pour recharger les données
 * @returns {Object} Objet contenant l'état de chargement, la fonction pour exécuter une opération, et les fonctions pour afficher des messages
 */
const useOperations = (loadData) => {
  const [actionLoading, setActionLoading] = useState(null);
  const { addToast } = useToast();
  const mountedRef = useRef(true);
  const pendingOperationsRef = useRef(new Set());

  // Fonction helper sécurisée pour les toasts avec mémorisation
  const safeAddToast = useCallback((message, type) => {
    if (mountedRef.current && addToast) {
      console.log(`🔔 [OPERATIONS] Affichage toast ${type}:`, message);
      addToast(message, type);
    } else {
      console.warn(`⚠️ [OPERATIONS] Impossible d'afficher le toast (composant démonté ou pas de addToast)`, { message, type });
    }
  }, [addToast]);

  const success = useCallback((message) => {
    console.log('✅ [OPERATIONS] Message de succès:', message);
    safeAddToast(message, 'success');
  }, [safeAddToast]);

  const error = useCallback((message) => {
    console.log('❌ [OPERATIONS] Message d\'erreur:', message);
    safeAddToast(message, 'error');
  }, [safeAddToast]);

  // Version optimisée avec suivi des opérations en cours
  const executeOperation = useCallback(async (itemId, operation, successMessage) => {
    console.log('🔄 [OPERATIONS] Tentative d\'exécution d\'opération pour l\'élément:', itemId);
    
    if (!mountedRef.current) {
      console.warn('⚠️ [OPERATIONS] Composant démonté, opération annulée');
      return;
    }
    
    // Éviter les opérations dupliquées
    const operationKey = `${itemId}-${Date.now()}`;
    if (pendingOperationsRef.current.has(operationKey)) {
      console.log('⚠️ [OPERATIONS] Opération déjà en cours, ignorée:', operationKey);
      return;
    }
    
    console.log('🚀 [OPERATIONS] Début de l\'opération:', operationKey);
    pendingOperationsRef.current.add(operationKey);
    
    try {
      setActionLoading(itemId);
      console.log('⏳ [OPERATIONS] État de chargement défini pour l\'élément:', itemId);
      
      console.log('🔄 [OPERATIONS] Exécution de la fonction d\'opération...');
      const result = await operation();
      console.log('✅ [OPERATIONS] Opération terminée avec succès:', operationKey, result);
      
      if (mountedRef.current) {
        if (loadData) {
          console.log('🔄 [OPERATIONS] Rechargement des données après opération réussie');
          await loadData();
        } else {
          console.log('ℹ️ [OPERATIONS] Pas de fonction loadData fournie, pas de rechargement');
        }
        
        console.log('✅ [OPERATIONS] Affichage du message de succès:', successMessage);
        success(successMessage);
      } else {
        console.warn('⚠️ [OPERATIONS] Composant démonté pendant l\'opération, pas de mise à jour UI');
      }
      
      return result;
    } catch (err) {
      console.error('❌ [OPERATIONS] Erreur lors de l\'opération:', operationKey, err);
      console.error('❌ [OPERATIONS] Détails de l\'erreur:', {
        message: err.message,
        status: err.status || err.response?.status,
        responseData: err.response?.data
      });
      
      if (mountedRef.current) {
        // Extraction plus précise du message d'erreur
        const errorMessage = 
          (err.response?.data?.detail) || 
          (err.response?.data?.message) || 
          err.message || 
          'Erreur lors de l\'opération';
          
        console.error('❌ [OPERATIONS] Message d\'erreur affiché:', errorMessage);
        error(errorMessage);
      } else {
        console.warn('⚠️ [OPERATIONS] Composant démonté pendant l\'opération, erreur non affichée');
      }
      
      throw err;
    } finally {
      if (mountedRef.current) {
        console.log('🏁 [OPERATIONS] Fin de l\'opération, nettoyage:', operationKey);
        setActionLoading(null);
        pendingOperationsRef.current.delete(operationKey);
      } else {
        console.log('🏁 [OPERATIONS] Fin de l\'opération (composant démonté):', operationKey);
      }
    }
  }, [loadData, success, error]);

  // Nettoyage lors du démontage avec annulation des opérations en cours
  // Remarque: Ceci doit être appelé dans un useEffect du composant qui utilise ce hook
  const cleanup = () => {
    console.log('🧹 [OPERATIONS] Nettoyage des opérations, composant démonté');
    mountedRef.current = false;
    pendingOperationsRef.current.clear();
  };

  return {
    actionLoading,
    executeOperation,
    success,
    error,
    setActionLoading,
    cleanup
  };
};

export default useOperations; 