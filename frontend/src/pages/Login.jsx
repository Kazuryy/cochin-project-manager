import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Page from "../components/global/Page";
import { Card, Alert, Button, FormField } from '../components/ui';
import useForm from '../hooks/useForm';
import { useAuth } from '../hooks/useAuth';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, authError } = useAuth();
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [formError, setFormError] = useState('');
  
  // Récupérer l'URL de redirection depuis l'état de location
  const from = location.state?.from || '/dashboard';
  
  // Rediriger si déjà authentifié
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);
  
  // Fonction de validation du formulaire
  const validateForm = (values) => {
    const errors = {};
    
    if (!values.username) {
      errors.username = 'Le nom d\'utilisateur est requis';
    }
    
    if (!values.password) {
      errors.password = 'Le mot de passe est requis';
    }
    
    return errors;
  };
  
  // Fonction de soumission du formulaire
  const handleSubmit = async (values) => {
    if (loginAttempts >= 5) {
      setFormError('Trop de tentatives de connexion. Veuillez réessayer plus tard.');
      return;
    }
    
    setFormError('');
    
    try {
      // Ajout d'un délai artificiel de 1.5 secondes
      await new Promise(resolve => setTimeout(resolve, 1000));
      await login(values);
    } catch (error) {
      setLoginAttempts(prev => prev + 1);
      setFormError(error.message || 'Erreur lors de la connexion');
    }
  };
  
  // Initialiser le hook de formulaire
  const { 
    values, 
    errors, 
    isSubmitting, 
    handleChange, 
    handleSubmit: submitForm 
  } = useForm(
    { username: '', password: '' },
    handleSubmit,
    validateForm
  );
  
  return (
    <Page>
      <fieldset className="flex items-center justify-center py-2 pt-30">
        <Card
          title="Connexion"
          subtitle="Veuillez vous connecter pour accéder au dashboard"
          width="md"
          className="bg-base-200 border-base-300 rounded-box w-md border p-4"
        >
          {/* Afficher les erreurs */}
          {(formError || authError) && (
            <Alert 
              type="error" 
              message={formError || authError}
              className="mb-4"
            />
          )}
          
          {/* Si trop de tentatives, afficher un message d'alerte */}
          {loginAttempts >= 5 && (
            <Alert 
              type="warning" 
              message="Votre compte est temporairement verrouillé suite à plusieurs tentatives infructueuses. Veuillez réessayer plus tard ou contacter un administrateur."
              className="mb-4"
            />
          )}
          
          <form onSubmit={submitForm} className="space-y-6">
            <FormField
              id="username"
              name="username"
              label="Nom d'utilisateur"
              type="text"
              autoComplete="username"
              required
              value={values.username}
              onChange={handleChange}
              placeholder="nom.prenom"
              error={errors.username}
            />

            <FormField
              id="password"
              name="password"
              label="Mot de passe"
              type="password"
              autoComplete="current-password"
              required
              value={values.password}
              onChange={handleChange}
              placeholder="••••••••"
              error={errors.password}
            />

            <div className="mt-6 space-y-4">
              {isSubmitting && (
                <div className="flex justify-center">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
              )}
              
              <Button
                type="submit"
                variant="neutral"
                isDisabled={isSubmitting || loginAttempts >= 5}
                className="w-full transition-all duration-300"
              >
                {isSubmitting ? 'Connexion en cours...' : 'Se connecter'}
              </Button>
            </div>
          </form>
        </Card>
      </fieldset>
    </Page>
  );
}

export default Login;