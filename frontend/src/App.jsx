import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Navbar from './components/global/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/routes/ProtectedRoute';
import PasswordChangeCheck from './components/auth/PasswordChangeCheck';
import { AuthProvider } from './hooks/AuthProvider';
import { useAuth } from './hooks/useAuth';
import './App.css';

// Composant wrapper qui gère l'état de chargement global
function AppContent() {
  const { isLoading } = useAuth();
  
  // Afficher un écran de chargement durant la vérification initiale d'authentification
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg mb-4"></div>
          <p className="text-base-content/70">Chargement de l'application...</p>
        </div>
      </div>
    );
  }
  
  return (
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
                </ProtectedRoute>
              } 
            />
            
            {/* Route pour l'administration - nécessite des droits d'admin */}
            <Route 
              path="/admin-dashboard" 
              element={
                <ProtectedRoute requireAdmin={true}>
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
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;