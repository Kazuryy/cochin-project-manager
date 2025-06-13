import { useEffect, useCallback } from 'react';

// Constantes
const STORAGE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 heures
const SAVE_DELAY_MS = 1000; // 1 seconde

/**
 * Hook pour persister les données du formulaire dans le localStorage
 * @param {string} key - Clé unique pour identifier les données dans le localStorage
 * @param {object} formData - Données du formulaire à persister
 * @param {function} setFormData - Fonction pour mettre à jour les données du formulaire
 * @param {array} excludeFields - Liste des champs à exclure de la persistance
 * @returns {object} - Objet contenant les fonctions de gestion de la persistance
 */
export function useFormPersistence(key, formData, setFormData, excludeFields = []) {
  // Sauvegarder les données dans le localStorage
  const saveFormData = useCallback(() => {
    try {
      if (!formData || Object.keys(formData).length === 0) {
        return;
      }

      // Filtrer les champs exclus
      const dataToSave = Object.keys(formData).reduce((acc, fieldKey) => {
        if (!excludeFields.includes(fieldKey)) {
          acc[fieldKey] = formData[fieldKey];
        }
        return acc;
      }, {});
      
      const dataWithTimestamp = {
        ...dataToSave,
        _savedAt: Date.now()
      };
      
      localStorage.setItem(key, JSON.stringify(dataWithTimestamp));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des données:', error);
    }
  }, [key, formData, excludeFields]);

  // Restaurer les données depuis le localStorage
  const restoreFormData = useCallback(() => {
    try {
      const savedData = localStorage.getItem(key);
      if (!savedData) {
        return false;
      }

      const parsedData = JSON.parse(savedData);
      const now = Date.now();
      
      if (parsedData._savedAt && (now - parsedData._savedAt) < STORAGE_EXPIRY_MS) {
        const { _savedAt, ...dataToRestore } = parsedData;
        
        setFormData(prevData => ({
          ...prevData,
          ...dataToRestore
        }));
        
        return true;
      }
      
      // Supprimer les données expirées
      localStorage.removeItem(key);
      return false;
    } catch (error) {
      console.error('Erreur lors de la restauration des données:', error);
      localStorage.removeItem(key);
      return false;
    }
  }, [key, setFormData]);

  // Effacer les données sauvegardées
  const clearSavedData = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Erreur lors de la suppression des données:', error);
    }
  }, [key]);

  // Sauvegarder automatiquement les données quand elles changent
  useEffect(() => {
    const timeoutId = setTimeout(saveFormData, SAVE_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [saveFormData]);

  // Vérifier s'il y a des données sauvegardées
  const hasSavedData = useCallback(() => {
    try {
      const savedData = localStorage.getItem(key);
      if (!savedData) {
        return false;
      }

      const parsedData = JSON.parse(savedData);
      const now = Date.now();
      
      return parsedData._savedAt && (now - parsedData._savedAt) < STORAGE_EXPIRY_MS;
    } catch {
      return false;
    }
  }, [key]);

  return {
    saveFormData,
    restoreFormData,
    clearSavedData,
    hasSavedData
  };
} 