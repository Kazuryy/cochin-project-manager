import api from './api';

/**
 * Service pour gérer les types et leurs tables associées
 */
export const typeService = {
  /**
   * Créer un nouveau type avec ses colonnes
   * @param {string} typeName - Nom du type (sera capitalisé)
   * @param {Array} columns - Liste des colonnes à créer
   * @returns {Promise} Résultat de la création
   */
  async createNewType(typeName, columns = []) {
    try {
      const response = await api.post('/api/database/tables/create_new_type/', {
        type_name: typeName,
        columns: columns.map(col => ({
          name: col.name,
          type: col.type,
          is_required: col.is_required || false,
          is_choice_field: col.is_choice_field || false,
          choice_column_name: col.choice_column_name || ''
        }))
      });

      return {
        success: true,
        data: response,
        message: response.message || `Type "${typeName}" créé avec succès`
      };
    } catch (error) {
      console.error('Erreur lors de la création du type:', error);
      
      let errorMessage = 'Erreur lors de la création du type';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  },

  /**
   * Vérifier si un type existe déjà
   * @param {string} typeName - Nom du type à vérifier
   * @returns {Promise<boolean>} True si le type existe
   */
  async typeExists(typeName) {
    // Cette fonction pourrait être étendue pour vérifier l'existence
    // Pour l'instant, on laisse l'API gérer cette vérification
    console.log('Vérification du type:', typeName);
    return false;
  },

  /**
   * Obtenir la liste des types existants
   * @returns {Promise<Array>} Liste des types
   */
  async getExistingTypes() {
    // Ceci nécessiterait une API pour récupérer les types depuis TableNames
    // Pour l'instant, retourner un tableau vide
    return [];
  }
};

export default typeService; 