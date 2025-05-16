import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Navbar from './components/global/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import ProtectedRoute from './components/routes/ProtectedRoute';
import PasswordChangeCheck from './components/auth/PasswordChangeCheck';
import { AuthProvider } from './hooks/AuthProvider';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <PasswordChangeCheck>
        <div className="min-h-screen bg-base-100">
          <Navbar />
          <div className="container mx-auto px-4">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              
              {/* Routes protégées */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                    <div className="p-6">
                      <h1 className="text-2xl font-bold">Tableau de bord</h1>
                      <p>Cette page n'est accessible qu'aux utilisateurs authentifiés.</p>
                    </div>
                  </ProtectedRoute>
                } 
              />
              
              {/* Route pour l'administration - nécessite des droits d'admin */}
              <Route 
                path="/admin-dashboard" 
                element={
                  <ProtectedRoute requireAdmin={true}>
                    {/* Ici, vous importerez votre composant d'administration */}
                    <div className="p-6">
                      <h1 className="text-2xl font-bold">Administration</h1>
                      <p>Cette page n'est accessible qu'aux administrateurs.</p>
                    </div>
                  </ProtectedRoute>
                } 
              />
              
              {/* Redirection pour les routes inconnues */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
        </PasswordChangeCheck>
      </Router>
    </AuthProvider>
  );
}

export default App;