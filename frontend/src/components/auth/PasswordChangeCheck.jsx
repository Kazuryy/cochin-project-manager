import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../ui';
import PasswordChangeForm from '../auth/PasswordChangeForm';

/**
 * Composant qui vérifie si l'utilisateur doit changer son mot de passe
 * et affiche le formulaire de changement si nécessaire
 * 
 * @param {React.ReactNode} children - Contenu de l'application
 */
function PasswordChangeCheck({ children }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  
  // Vérifier si l'utilisateur doit changer son mot de passe
  useEffect(() => {
    if (isAuthenticated && !isLoading && user?.require_password_change) {
      setShowPasswordChangeModal(true);
    } else {
      setShowPasswordChangeModal(false);
    }
  }, [isAuthenticated, isLoading, user]);
  
  // Gérer la soumission réussie du formulaire de changement de mot de passe
  const handlePasswordChangeSuccess = () => {
    // Le modal se fermera automatiquement lorsque l'état de l'utilisateur sera mis à jour
  };
  
  return (
    <>
      {children}
      
      {/* Modal de changement de mot de passe */}
      <Modal
        isOpen={showPasswordChangeModal}
        onClose={() => {}} // Ne rien faire, car la fermeture est empêchée
        title="Changement de mot de passe requis"
        preventClosing={true}
        showCloseButton={false}
        size="md"
      >
        <div className="p-2">
          <p className="mb-4 text-base-content/70">
            Pour des raisons de sécurité, vous devez changer votre mot de passe avant de pouvoir continuer.
          </p>
          
          <PasswordChangeForm onSuccess={handlePasswordChangeSuccess} />
        </div>
      </Modal>
    </>
  );
}

PasswordChangeCheck.propTypes = {
  children: PropTypes.node.isRequired
};

export default PasswordChangeCheck;