// App.jsx optimisé avec meilleure gestion du chargement
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Navbar from './components/global/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/routes/ProtectedRoute';
import PasswordChangeCheck from './components/auth/PasswordChangeCheck';
import { AuthProvider } from './hooks/AuthProvider';
import './App.css';



// Contenu principal de l'application
function MainContent() {
  return (
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
  );
}

// Composant wrapper qui gère l'état de chargement global
function AppContent() {
  return (
    <PasswordChangeCheck>
      <MainContent />
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