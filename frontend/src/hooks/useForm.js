import { useState, useCallback } from 'react';

/**
 * Hook personnalisé pour gérer l'état et les validations des formulaires
 * 
 * @param {Object} initialValues - Valeurs initiales du formulaire
 * @param {Function} validate - Fonction de validation (optionnelle)
 * @param {Function} onSubmit - Fonction à exécuter lors de la soumission (optionnelle)
 * @returns {Object} - Méthodes et propriétés pour gérer le formulaire
 */
function useFormHook(initialValues = {}, validate, onSubmit) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Gère les changements de valeurs des champs du formulaire
   * @param {Event} e - Événement de changement
   */
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    
    if (!name) {
      console.warn('Champ sans attribut name détecté');
      return;
    }

    const newValue = type === 'checkbox' ? checked : value;
    
    setValues((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));

    // Effacer l'erreur si l'utilisateur modifie le champ
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [errors]);

  /**
   * Valide le formulaire avec la fonction de validation fournie
   * @returns {boolean} - Indique si le formulaire est valide
   */
  const validateForm = useCallback(() => {
    if (typeof validate === 'function') {
      const validationErrors = validate(values);
      setErrors(validationErrors);
      return Object.keys(validationErrors).length === 0;
    }
    return true;
  }, [validate, values]);

  /**
   * Valide un champ spécifique
   * @param {string} name - Nom du champ à valider
   * @returns {boolean} - Indique si le champ est valide
   */
  const validateField = useCallback((name) => {
    if (typeof validate === 'function') {
      const validationErrors = validate(values);
      if (validationErrors[name]) {
        setErrors((prev) => ({
          ...prev,
          [name]: validationErrors[name]
        }));
        return false;
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
        return true;
      }
    }
    return true;
  }, [validate, values]);

  /**
   * Gère la soumission du formulaire
   * @param {Event} e - Événement de soumission
   */
  const handleSubmit = useCallback(async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    const isValid = validateForm();
    
    if (isValid && onSubmit) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (error) {
        console.error('Erreur lors de la soumission du formulaire:', error);
        if (error.errors) {
          setErrors(error.errors);
        } else {
          setErrors({ submit: 'Une erreur est survenue lors de la soumission' });
        }
      } finally {
        setIsSubmitting(false);
      }
    }

    return isValid;
  }, [onSubmit, validateForm, values]);

  /**
   * Réinitialise le formulaire à son état initial
   */
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  /**
   * Définit une valeur spécifique pour un champ
   * @param {string} name - Nom du champ
   * @param {any} value - Nouvelle valeur
   */
  const setValue = useCallback((name, value) => {
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  /**
   * Définit une erreur spécifique pour un champ
   * @param {string} name - Nom du champ
   * @param {string} errorMessage - Message d'erreur
   */
  const setError = useCallback((name, errorMessage) => {
    setErrors((prev) => ({
      ...prev,
      [name]: errorMessage,
    }));
  }, []);

  /**
   * Alias pour setError pour compatibilité
   * @param {string} name - Nom du champ
   * @param {string} errorMessage - Message d'erreur
   */
  const setFieldError = useCallback((name, errorMessage) => {
    setError(name, errorMessage);
  }, [setError]);

  /**
   * Efface l'erreur d'un champ spécifique
   * @param {string} name - Nom du champ
   */
  const clearFieldError = useCallback((name) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  }, []);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleSubmit,
    resetForm,
    setValue,
    setError,
    setFieldError,
    clearFieldError,
    validateField,
    validateForm
  };
}

// Export par défaut et named export pour compatibilité
export default useFormHook;
export { useFormHook as useForm };