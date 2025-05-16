import { useState } from 'react';
import PropTypes from 'prop-types';
import { Card, Alert, Button, FormField } from '../ui';
import useForm from '../../hooks/useForm';

function PasswordChangeForm({ onSuccess }) {
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fonction de validation du formulaire
  const validateForm = (values) => {
    const errors = {};
    
    if (!values.currentPassword) {
      errors.currentPassword = 'Le mot de passe actuel est requis';
    }
    
    if (!values.newPassword) {
      errors.newPassword = 'Le nouveau mot de passe est requis';
    } else if (values.newPassword.length < 12) {
      errors.newPassword = 'Le mot de passe doit contenir au moins 12 caractères';
    } else if (!/[A-Z]/.test(values.newPassword)) {
      errors.newPassword = 'Le mot de passe doit contenir au moins une majuscule';
    } else if (!/[a-z]/.test(values.newPassword)) {
      errors.newPassword = 'Le mot de passe doit contenir au moins une minuscule';
    } else if (!/\d/.test(values.newPassword)) {
      errors.newPassword = 'Le mot de passe doit contenir au moins un chiffre';
    } else if (!/[^A-Za-z0-9]/.test(values.newPassword)) {
      errors.newPassword = 'Le mot de passe doit contenir au moins un caractère spécial';
    }
    
    if (!values.confirmPassword) {
      errors.confirmPassword = 'La confirmation du mot de passe est requise';
    } else if (values.newPassword !== values.confirmPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    
    return errors;
  };
  
  // Fonction de soumission du formulaire
  const handleSubmit = async (values) => {
    setFormError('');
    setSuccessMessage('');
    
    try {
      const response = await fetch('/api/auth/change-password/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': (/csrftoken=([^;]+)/).exec(document.cookie)?.[1] || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          current_password: values.currentPassword,
          new_password: values.newPassword,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Échec du changement de mot de passe');
      }
      
      setSuccessMessage('Mot de passe modifié avec succès');
      resetForm();
      
      // Appeler la fonction de callback si fournie
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (error) {
      setFormError(error.message || 'Une erreur est survenue');
    }
  };
  
  // Initialiser le hook de formulaire
  const { 
    values, 
    errors, 
    isSubmitting, 
    handleChange, 
    handleSubmit: submitForm,
    resetForm
  } = useForm(
    { 
      currentPassword: '', 
      newPassword: '', 
      confirmPassword: '' 
    },
    handleSubmit,
    validateForm
  );
  
  return (
    <Card
      title="Changement de mot de passe"
      subtitle="Votre mot de passe doit être modifié pour des raisons de sécurité"
      width="md"
    >
      {/* Afficher les erreurs */}
      {formError && (
        <Alert 
          type="error" 
          message={formError}
          className="mb-4"
        />
      )}
      
      {/* Afficher le message de succès */}
      {successMessage && (
        <Alert 
          type="success" 
          message={successMessage}
          className="mb-4"
        />
      )}
      
      <form onSubmit={submitForm} className="space-y-6">
        <FormField
          id="currentPassword"
          name="currentPassword"
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          required
          value={values.currentPassword}
          onChange={handleChange}
          error={errors.currentPassword}
        />

        <FormField
          id="newPassword"
          name="newPassword"
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          required
          value={values.newPassword}
          onChange={handleChange}
          error={errors.newPassword}
          helperText="Le mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial."
        />

        <FormField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirmer le nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          required
          value={values.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />

        <div className="mt-6">
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            isDisabled={isSubmitting}
            className="w-full"
          >
            Changer mon mot de passe
          </Button>
        </div>
      </form>
    </Card>
  );
}

PasswordChangeForm.propTypes = {
  onSuccess: PropTypes.func
};

PasswordChangeForm.defaultProps = {
  onSuccess: undefined
};

export default PasswordChangeForm;