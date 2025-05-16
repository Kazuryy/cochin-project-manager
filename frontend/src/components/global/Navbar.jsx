import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui';

function Navbar() {
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  const handleLogout = async () => {
    await logout();
    // Pas besoin de rediriger car la protection des routes s'en chargera
  };

  const renderAuthSection = () => {
    if (isLoading) {
      return <span className="loading loading-spinner loading-sm"></span>;
    }
    if (isAuthenticated) {
      return (
        <div className="dropdown dropdown-end">
          <button tabIndex={0} className="btn btn-ghost btn-circle avatar">
            <div className="w-10 rounded-full bg-primary text-primary-content flex items-center justify-center">
              <span className="text-lg font-bold">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
          </button>
          <ul className="mt-3 z-10 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
            <li className="menu-title font-medium px-2 pt-2">
              <span>{user?.username}</span>
            </li>
            <li><Link to="/profile">Profil</Link></li>
            {user?.is_staff && (
              <li><Link to="/admin-dashboard">Administration</Link></li>
            )}
            <li className="mt-2">
              <button onClick={handleLogout} className="text-error">
                Déconnexion
              </button>
            </li>
          </ul>
        </div>
      );
    }
    return (
      <Link to="/login">
        <Button variant="ghost">Se connecter</Button>
      </Link>
    );
  };

  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="navbar-start">
        <Link to="/" className="btn btn-ghost text-xl">Cochin Project Manager</Link>
      </div>
      
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1">
          <li><Link to="/">Accueil</Link></li>
          {isAuthenticated && <li><Link to="/dashboard">Tableau de bord</Link></li>}
          {isAuthenticated && user?.is_staff && (
            <li><Link to="/admin-dashboard">Administration</Link></li>
          )}
        </ul>
      </div>
      
      <div className="navbar-end">
        {renderAuthSection()}
      </div>
    </div>
  );
}

export default Navbar;