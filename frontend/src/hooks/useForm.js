import { useState } from 'react';

/**
 * Hook personnalisé pour gérer l'état et les validations des formulaires
 * 
 * @param {Object} initialValues - Valeurs initiales du formulaire
 * @param {Function} onSubmit - Fonction à exécuter lors de la soumission
 * @param {Function} validate - Fonction de validation (optionnelle)
 * @returns {Object} - Méthodes et propriétés pour gérer le formulaire
 */
function useForm(initialValues, onSubmit, validate) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Gestion des changements de valeurs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Effacer l'erreur si l'utilisateur modifie le champ
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  // Fonction de validation du formulaire
  const validateForm = () => {
    if (typeof validate === 'function') {
      const validationErrors = validate(values);
      setErrors(validationErrors);
      return Object.keys(validationErrors).length === 0;
    }
    return true;
  };
  
  // Gestion de la soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Valider le formulaire si une fonction de validation est fournie
    const isValid = validateForm();
    
    if (isValid) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (error) {
        console.error('Erreur lors de la soumission du formulaire:', error);
        // Gérer les erreurs de soumission
        if (error.errors) {
          setErrors(error.errors);
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  
  // Réinitialiser le formulaire
  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
  };
  
  // Définir une valeur spécifique
  const setValue = (name, value) => {
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  
  // Définir une erreur spécifique
  const setError = (name, errorMessage) => {
    setErrors((prev) => ({
      ...prev,
      [name]: errorMessage,
    }));
  };
  
  return {
    values,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    resetForm,
    setValue,
    setError,
  };
}

export default useForm;