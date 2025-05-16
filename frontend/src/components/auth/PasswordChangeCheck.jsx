// Correction de PasswordChangeCheck.jsx
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import PasswordChangeForm from '../auth/PasswordChangeForm';

/**
 * Composant qui vérifie si l'utilisateur doit changer son mot de passe
 * et affiche le formulaire de changement si nécessaire
 * 
 * @param {React.ReactNode} children - Contenu de l'application
 */
function PasswordChangeCheck({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Afficher un loader pendant le chargement
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  // Si l'utilisateur doit changer son mot de passe, afficher le formulaire à la place du contenu
  if (isAuthenticated && user?.require_password_change) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-base-200">
        <div className="max-w-md w-full">
          <h2 className="text-xl font-bold mb-4 text-center">Changement de mot de passe requis</h2>
          <p className="mb-4 text-base-content/70 text-center">
            Pour des raisons de sécurité, vous devez changer votre mot de passe avant de pouvoir continuer.
          </p>
          <PasswordChangeForm onSuccess={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  // Sinon, afficher le contenu normal
  return <>{children}</>;
}

PasswordChangeCheck.propTypes = {
  children: PropTypes.node.isRequired
};

export default PasswordChangeCheck;