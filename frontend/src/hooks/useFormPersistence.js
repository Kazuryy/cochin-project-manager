import { useEffect, useCallback } from 'react';

/**
 * Hook pour persister les données du formulaire dans le localStorage
 * @param {string} key - Clé unique pour identifier les données dans le localStorage
 * @param {object} formData - Données du formulaire à persister
 * @param {function} setFormData - Fonction pour mettre à jour les données du formulaire
 * @param {array} excludeFields - Liste des champs à exclure de la persistance
 */
export function useFormPersistence(key, formData, setFormData, excludeFields = []) {
  
  // Sauvegarder les données dans le localStorage
  const saveFormData = useCallback(() => {
    if (formData && Object.keys(formData).length > 0) {
      // Filtrer les champs exclus
      const dataToSave = Object.keys(formData).reduce((acc, fieldKey) => {
        if (!excludeFields.includes(fieldKey)) {
          acc[fieldKey] = formData[fieldKey];
        }
        return acc;
      }, {});
      
      // Ajouter un timestamp pour savoir quand les données ont été sauvegardées
      const dataWithTimestamp = {
        ...dataToSave,
        _savedAt: Date.now()
      };
      
      localStorage.setItem(key, JSON.stringify(dataWithTimestamp));
    }
  }, [key, formData, excludeFields]);

  // Restaurer les données depuis le localStorage
  const restoreFormData = useCallback(() => {
    try {
      const savedData = localStorage.getItem(key);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        
        // Vérifier si les données ne sont pas trop anciennes (24h)
        const oneDayInMs = 24 * 60 * 60 * 1000;
        const now = Date.now();
        
        if (parsedData._savedAt && (now - parsedData._savedAt) < oneDayInMs) {
          // Supprimer le timestamp avant de restaurer
          const { _savedAt, ...dataToRestore } = parsedData;
          
          // Fusionner avec les données actuelles (ne pas écraser complètement)
          setFormData(prevData => ({
            ...prevData,
            ...dataToRestore
          }));
          
          return true; // Indique que des données ont été restaurées
        } else {
          // Supprimer les données expirées
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('Erreur lors de la restauration des données du formulaire:', error);
      localStorage.removeItem(key);
    }
    return false;
  }, [key, setFormData]);

  // Effacer les données sauvegardées
  const clearSavedData = useCallback(() => {
    localStorage.removeItem(key);
  }, [key]);

  // Sauvegarder automatiquement les données quand elles changent
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveFormData();
    }, 1000); // Sauvegarder avec un délai pour éviter trop d'écritures

    return () => clearTimeout(timeoutId);
  }, [saveFormData]);

  // Fonction pour vérifier s'il y a des données sauvegardées
  const hasSavedData = useCallback(() => {
    try {
      const savedData = localStorage.getItem(key);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        const oneDayInMs = 24 * 60 * 60 * 1000;
        const now = Date.now();
        
        return parsedData._savedAt && (now - parsedData._savedAt) < oneDayInMs;
      }
    } catch {
      return false;
    }
    return false;
  }, [key]);

  return {
    saveFormData,
    restoreFormData,
    clearSavedData,
    hasSavedData
  };
} 