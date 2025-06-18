import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui';
import { FiPlus } from 'react-icons/fi';

/**
 * Icônes pour le sélecteur de thème
 */
const SunIcon = () => (
  <svg
    className="swap-off h-10 w-10 fill-current"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
  </svg>
);

const MoonIcon = () => (
  <svg
    className="swap-on h-10 w-10 fill-current"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" />
  </svg>
);

const UserMenuIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    className="inline-block h-5 w-5 stroke-current"
    aria-hidden="true"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      strokeWidth="2" 
      d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
    />
  </svg>
);

/**
 * Composant de navigation principal
 * Barre de navigation fixe avec authentification, thème et menu utilisateur
 */
function Navbar() {
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  /**
   * Gestionnaire de déconnexion optimisé avec useCallback
   */
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      // La redirection est gérée automatiquement par la protection des routes
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      // En cas d'erreur, on force quand même la déconnexion côté client
      window.location.href = '/login';
    }
  }, [logout]);

  /**
   * Section d'authentification mémorisée pour éviter les re-renders
   */
  const authSection = useMemo(() => {
    if (isLoading) {
      return (
        <span 
          className="loading loading-spinner loading-sm" 
          aria-label="Chargement de l'état d'authentification"
        />
      );
    }

    if (isAuthenticated) {
      return (
        <div className="dropdown dropdown-end">
          <button 
            tabIndex={0} 
            className="btn btn-ghost btn-circle avatar"
            aria-label="Menu utilisateur"
            aria-haspopup="true"
            aria-expanded="false"
          >
            <UserMenuIcon />
          </button>
          <ul 
            className="mt-3 z-10 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52"
            aria-label="Options utilisateur"
          >
            {user?.is_staff && (
              <>
                <li>
                  <Link to="/admin">
                    Admin
                  </Link>
                </li>
                <li>
                  <Link to="/admin/backup">
                    Backup
                  </Link>
                </li>
                <li>
                  <Link to="/admin/logs">
                    Logs
                  </Link>
                </li>
              </>
            )}
            <li className="mt-2">
              <button 
                onClick={handleLogout} 
                className="text-error"
                aria-label="Se déconnecter de l'application"
              >
                Déconnexion
              </button>
            </li>
          </ul>
        </div>
      );
    }

    return (
      <Link to="/login">
        <Button variant="ghost" aria-label="Se connecter à l'application">
          Se connecter
        </Button>
      </Link>
    );
  }, [isLoading, isAuthenticated, user, handleLogout]);

  /**
   * Menu de navigation mémorisé
   */
  const navigationMenu = useMemo(() => (
    <ul className="menu menu-horizontal px-1">
      <li>
        <Link to="/" aria-label="Aller à la page d'accueil">
          Accueil
        </Link>
      </li>
      {isAuthenticated && (
        <li>
          <Link to="/dashboard" aria-label="Aller au tableau de bord">
            Tableau de bord
          </Link>
        </li>
      )}
      {isAuthenticated && user?.is_staff && (
        <li>
          <Link to="/admin" aria-label="Aller à l'administration">
            Administration
          </Link>
        </li>
      )}
    </ul>
  ), [isAuthenticated, user?.is_staff]);

  /**
   * Bouton nouveau projet mémorisé
   */
  const newProjectButton = useMemo(() => {
    if (!isAuthenticated) return null;

    return (
      <Link to="/projects/create" className="mr-4">
        <Button 
          variant="info" 
          size="sm"
          aria-label="Créer un nouveau projet"
        >
          <FiPlus className="mr-2" aria-hidden="true" />
          Nouveau Projet
        </Button>
      </Link>
    );
  }, [isAuthenticated]);

  return (
    <nav 
      className="navbar bg-base-100 shadow-sm fixed top-0 z-50" 
      role="navigation"
      aria-label="Navigation principale"
    >
      {/* Logo et titre */}
      <div className="navbar-start">
        <Link 
          to="/dashboard" 
          className="btn btn-ghost text-xl"
          aria-label="Cochin Project Manager - Retour à l'accueil"
        >
          Cochin Project Manager
        </Link>
      </div>
      
      {/* Menu principal - caché sur mobile */}
      <div className="navbar-center hidden lg:flex">
        {navigationMenu}
      </div>
      
      {/* Actions utilisateur */}
      <div className="navbar-end">
        {/* Bouton Nouveau Projet */}
        {newProjectButton}
        
        {/* Sélecteur de thème */}
        <label className="swap swap-rotate pr-4">
          <input
            type="checkbox"
            checked={isDark}
            onChange={toggleTheme}
            className="theme-controller sr-only"
            aria-label={`Basculer vers le thème ${isDark ? 'clair' : 'sombre'}`}
          />
          <SunIcon />
          <MoonIcon />
        </label>

        {/* Section authentification */}
        {authSection}
      </div>
    </nav>
  );
}

export default React.memo(Navbar);