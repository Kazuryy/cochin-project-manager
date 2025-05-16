import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';

/**
 * Composant pour protéger les routes nécessitant une authentification
 * Version améliorée qui évite le "flash" de contenu avant la redirection
 */
function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const [isReady, setIsReady] = useState(false);
  
  // Utiliser useEffect pour confirmer la fin de la vérification d'authentification
  useEffect(() => {
    // Ne définir isReady à true que lorsque isLoading devient false
    if (!isLoading) {
      setIsReady(true);
    }
  }, [isLoading]);
  
  // Ne rien afficher tant que nous n'avons pas terminé la vérification d'authentification
  if (isLoading || !isReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }
  
  // Si l'utilisateur n'est pas authentifié, rediriger vers la page de connexion
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  
  // Si la route nécessite des droits d'administrateur et que l'utilisateur n'en a pas
  if (requireAdmin && user && !user.is_staff) {
    return <Navigate to="/" replace />;
  }
  
  // Si toutes les conditions sont remplies, afficher le composant enfant
  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requireAdmin: PropTypes.bool
};

ProtectedRoute.defaultProps = {
  requireAdmin: false
};

export default ProtectedRoute;