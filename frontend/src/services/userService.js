/**
 * Service pour la gestion des utilisateurs
 * Utilise le module api.js central pour toutes les requêtes
 */

import api from './api.js';

/**
 * Service de gestion des utilisateurs
 */
export const userService = {
  
  /**
   * Récupère la liste des utilisateurs avec pagination et filtres
   * @param {Object} params - Paramètres de requête
   * @param {number} params.page - Numéro de page
   * @param {number} params.limit - Nombre d'éléments par page
   * @param {string} params.search - Recherche textuelle
   * @param {string} params.status - Filtre par statut
   * @param {string} params.is_staff - Filtre par statut admin
   * @param {string} params.groups - Filtre par groupes
   */
  async getUsers(params = {}) {
    const queryParams = new URLSearchParams();
    
    // Ajouter les paramètres de requête
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // Exclure les valeurs booléennes false (ne les envoyer que si true)
        if (typeof value === 'boolean' && value === false) {
          return;
        }
        queryParams.append(key, value);
      }
    });
    
    const url = `/api/auth/users/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return await api.get(url);
  },

  /**
   * Récupère les détails d'un utilisateur
   * @param {number} userId - ID de l'utilisateur
   */
  async getUser(userId) {
    return await api.get(`/api/auth/users/${userId}/`);
  },

  /**
   * Crée un nouvel utilisateur
   * @param {Object} userData - Données de l'utilisateur
   */
  async createUser(userData) {
    return await api.post('/api/auth/users/', userData);
  },

  /**
   * Met à jour un utilisateur
   * @param {number} userId - ID de l'utilisateur
   * @param {Object} userData - Données à mettre à jour
   */
  async updateUser(userId, userData) {
    return await api.put(`/api/auth/users/${userId}/`, userData);
  },

  /**
   * Supprime un utilisateur
   * @param {number} userId - ID de l'utilisateur
   */
  async deleteUser(userId) {
    return await api.delete(`/api/auth/users/${userId}/`);
  },

  /**
   * Exécute des actions en lot sur les utilisateurs
   * @param {Object} actionData - Données de l'action
   * @param {string} actionData.action - Type d'action
   * @param {number[]} actionData.user_ids - IDs des utilisateurs
   * @param {number} actionData.duration_minutes - Durée (pour verrouillage)
   */
  async bulkAction(actionData) {
    return await api.post('/api/auth/users/bulk_actions/', actionData);
  },

  /**
   * Récupère les statistiques des utilisateurs
   */
  async getUserStats() {
    return await api.get('/api/auth/users/stats/');
  },

  /**
   * Récupère la liste des groupes
   */
  async getGroups() {
    return await api.get('/api/auth/groups/');
  },

  /**
   * Actions spécifiques pour les utilisateurs
   */
  actions: {
    /**
     * Déverrouille des comptes utilisateur
     * @param {number[]} userIds - IDs des utilisateurs
     */
    async unlock(userIds) {
      return await userService.bulkAction({
        action: 'unlock',
        user_ids: userIds
      });
    },

    /**
     * Verrouille des comptes utilisateur
     * @param {number[]} userIds - IDs des utilisateurs
     * @param {number} durationMinutes - Durée du verrouillage en minutes
     */
    async lock(userIds, durationMinutes = 15) {
      return await userService.bulkAction({
        action: 'lock',
        user_ids: userIds,
        duration_minutes: durationMinutes
      });
    },

    /**
     * Réinitialise les tentatives de connexion
     * @param {number[]} userIds - IDs des utilisateurs
     */
    async resetAttempts(userIds) {
      return await userService.bulkAction({
        action: 'reset_attempts',
        user_ids: userIds
      });
    },

    /**
     * Force le changement de mot de passe
     * @param {number[]} userIds - IDs des utilisateurs
     */
    async forcePasswordChange(userIds) {
      return await userService.bulkAction({
        action: 'force_password_change',
        user_ids: userIds
      });
    },

    /**
     * Active des comptes utilisateur
     * @param {number[]} userIds - IDs des utilisateurs
     */
    async activate(userIds) {
      return await userService.bulkAction({
        action: 'activate',
        user_ids: userIds
      });
    },

    /**
     * Désactive des comptes utilisateur
     * @param {number[]} userIds - IDs des utilisateurs
     */
    async deactivate(userIds) {
      return await userService.bulkAction({
        action: 'deactivate',
        user_ids: userIds
      });
    },

    /**
     * Donne les droits administrateur
     * @param {number[]} userIds - IDs des utilisateurs
     */
    async makeStaff(userIds) {
      return await userService.bulkAction({
        action: 'make_staff',
        user_ids: userIds
      });
    },

    /**
     * Retire les droits administrateur
     * @param {number[]} userIds - IDs des utilisateurs
     */
    async removeStaff(userIds) {
      return await userService.bulkAction({
        action: 'remove_staff',
        user_ids: userIds
      });
    }
  }
};

/**
 * Utilitaires pour la gestion des utilisateurs
 */
export const userUtils = {
  /**
   * Formate le statut d'un utilisateur pour l'affichage
   * @param {Object} user - Objet utilisateur
   */
  formatStatus(user) {
    const statusMap = {
      'actif': { text: 'Actif', class: 'badge-success' },
      'inactif': { text: 'Inactif', class: 'badge-error' },
      'verrouillé': { text: 'Verrouillé', class: 'badge-warning' },
      'mot_de_passe_expiré': { text: 'Mot de passe expiré', class: 'badge-warning' },
      'changement_requis': { text: 'Changement requis', class: 'badge-info' }
    };
    
    return statusMap[user.status] || { text: user.status, class: 'badge-neutral' };
  },

  /**
   * Formate les permissions d'un utilisateur
   * @param {Object} user - Objet utilisateur
   */
  formatPermissions(user) {
    const permissions = [];
    
    if (user.is_superuser) {
      permissions.push('Super Admin');
    } else if (user.is_staff) {
      permissions.push('Admin');
    }
    
    if (user.groups_display && user.groups_display.length > 0) {
      permissions.push(...user.groups_display);
    }
    
    return permissions.length > 0 ? permissions : ['Utilisateur'];
  },

  /**
   * Formate la date de dernière connexion
   * @param {string} lastLogin - Date de dernière connexion
   */
  formatLastLogin(lastLogin) {
    if (!lastLogin) return 'Jamais connecté';
    
    const date = new Date(lastLogin);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Aujourd\'hui';
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
    
    return date.toLocaleDateString('fr-FR');
  },

  /**
   * Valide les données d'un utilisateur avant soumission
   * @param {Object} userData - Données utilisateur
   */
  validateUser(userData) {
    const errors = {};
    
    // Validation du nom d'utilisateur
    if (!userData.username || userData.username.trim().length < 3) {
      errors.username = 'Le nom d\'utilisateur doit contenir au moins 3 caractères';
    }
    
    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!userData.email || !emailRegex.test(userData.email)) {
      errors.email = 'L\'adresse email n\'est pas valide';
    }
    
    // Validation du mot de passe (pour création)
    if (userData.password) {
      if (userData.password.length < 12) {
        errors.password = 'Le mot de passe doit contenir au moins 12 caractères';
      }
      
      if (userData.password !== userData.password_confirm) {
        errors.password_confirm = 'Les mots de passe ne correspondent pas';
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
}; 