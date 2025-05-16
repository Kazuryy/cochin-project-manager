import { createContext } from 'react';

// Créer un contexte pour l'authentification
export const AuthContext = createContext(null);

// Fonction pour récupérer le token CSRF des cookies
export const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}; 