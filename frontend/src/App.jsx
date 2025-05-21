// App.jsx optimisé avec meilleure gestion du chargement
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Navbar from './components/global/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DatabaseManager from './pages/Admin/DatabaseManager';
import ProtectedRoute from './components/routes/ProtectedRoute';
import PasswordChangeCheck from './components/auth/PasswordChangeCheck';
import { AuthProvider } from './hooks/AuthProvider';
import './App.css';
import DashboardAdmin from './pages/DashboardAdmin';
import Footer from './components/global/Footer';


// Contenu principal de l'application
function MainContent() {
  return (
    <div className="flex flex-col min-h-screen bg-base-100">
      <Navbar />
      <div className="flex-1 pt-16 pb-16">
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
                <DashboardAdmin />
              </ProtectedRoute>
            } 
          />
          
          {/* Routes pour la gestion des tables */}
          <Route
            path="/admin/database/*"
            element={
              <ProtectedRoute requireAdmin={true}>
                <DatabaseManager />
              </ProtectedRoute>
            }
          />
          
          {/* Redirection pour les routes inconnues */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </div>
      <Footer />
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