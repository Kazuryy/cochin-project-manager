import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';

/**
 * Composant pour protéger les routes nécessitant une authentification
 * Gère automatiquement la redirection et l'affichage du chargement
 * 
 * @param {Object} props - Les propriétés du composant
 * @param {React.ReactNode} props.children - Le contenu à protéger
 * @param {boolean} props.requireAdmin - Si true, nécessite des droits administrateur
 */
function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  
  // Affichage du chargement pendant la vérification d'authentification
  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center h-screen"
        role="status"
        aria-label="Vérification de l'authentification en cours"
      >
        <div 
          className="loading loading-spinner loading-lg"
          aria-hidden="true"
        ></div>
        <span className="sr-only">Chargement...</span>
      </div>
    );
  }
  
  // Redirection si l'utilisateur n'est pas authentifié
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  
  // Vérification des droits d'administrateur si requis
  if (requireAdmin) {
    const isAdmin = user?.is_staff === true;
    if (!isAdmin) {
      return <Navigate to="/" replace />;
    }
  }
  
  // Affichage du contenu protégé
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