import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PropTypes from 'prop-types';

/**
 * Composant pour protéger les routes nécessitant une authentification
 * Redirige vers la page de connexion si l'utilisateur n'est pas authentifié
 * 
 * @param {React.ReactNode} children - Composant enfant à afficher si authentifié
 * @param {boolean} requireAdmin - Si la route nécessite des droits d'administrateur
 */
function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  
  // Afficher un indicateur de chargement pendant la vérification de l'authentification
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }
  
  // Vérifier si l'utilisateur est authentifié
  if (!isAuthenticated) {
    // Rediriger vers la page de connexion avec l'URL de destination
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  
  // Vérifier si la route nécessite des droits d'administrateur
  if (requireAdmin && !user?.is_staff) {
    // Rediriger vers la page d'accueil si l'utilisateur n'est pas administrateur
    return <Navigate to="/" replace />;
  }
  
  // Si toutes les conditions sont remplies, afficher le composant enfant
  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requireAdmin: PropTypes.bool
};

export default ProtectedRoute;