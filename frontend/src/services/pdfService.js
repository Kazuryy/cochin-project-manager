import api from './api';

export const pdfService = {
  /**
   * Récupérer tous les fichiers PDF d'un projet
   * @param {number} projectId - ID du projet
   * @returns {Promise<Array>} Liste des fichiers PDF du projet
   */
  async getPdfsByProject(projectId) {
    try {
      const response = await api.get(`/api/database/project-pdfs/?project_id=${projectId}`);
      return response || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des PDFs:', error);
      throw error;
    }
  },

  /**
   * Uploader un nouveau fichier PDF pour un projet
   * @param {number} projectId - ID du projet
   * @param {File} file - Fichier PDF à uploader
   * @param {string} displayName - Nom d'affichage du fichier
   * @param {string} description - Description optionnelle
   * @returns {Promise<Object>} Fichier PDF créé
   */
  async uploadPdfForProject(projectId, file, displayName, description = '') {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('project_record', projectId);
      formData.append('display_name', displayName);
      formData.append('original_filename', file.name);
      
      if (description) {
        formData.append('description', description);
      }

      // Ne pas définir Content-Type manuellement pour FormData
      // Le navigateur le fera automatiquement avec le bon boundary
      const response = await api.post('/api/database/project-pdfs/', formData);

      return response.data || response;
    } catch (error) {
      console.error('Erreur lors de l\'upload du PDF:', error);
      throw error;
    }
  },

  /**
   * Mettre à jour les métadonnées d'un fichier PDF
   * @param {number} pdfId - ID du fichier PDF
   * @param {Object} updateData - Données à mettre à jour
   * @returns {Promise<Object>} Fichier PDF mis à jour
   */
  async updatePdf(pdfId, updateData) {
    try {
      const response = await api.patch(`/api/database/project-pdfs/${pdfId}/`, updateData);
      return response;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du PDF:', error);
      throw error;
    }
  },

  /**
   * Supprimer un fichier PDF
   * @param {number} pdfId - ID du fichier PDF
   * @returns {Promise<Object>} Résultat de la suppression
   */
  async deletePdf(pdfId) {
    try {
      const response = await api.delete(`/api/database/project-pdfs/${pdfId}/`);
      return response;
    } catch (error) {
      console.error('Erreur lors de la suppression du PDF:', error);
      throw error;
    }
  },

  /**
   * Mettre à jour l'ordre d'affichage d'un fichier PDF
   * @param {number} pdfId - ID du fichier PDF
   * @param {number} newOrder - Nouvel ordre
   * @returns {Promise<Object>} Fichier PDF mis à jour
   */
  async updatePdfOrder(pdfId, newOrder) {
    try {
      const response = await api.patch(`/api/database/project-pdfs/${pdfId}/update_order/`, {
        order: newOrder
      });
      return response;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'ordre:', error);
      throw error;
    }
  },

  /**
   * Réorganiser l'ordre de plusieurs fichiers PDF
   * @param {Array} pdfOrders - Liste des objets {id, order}
   * @returns {Promise<Object>} Résultat de la réorganisation
   */
  async reorderPdfs(pdfOrders) {
    try {
      const response = await api.post('/api/database/project-pdfs/reorder/', {
        pdf_orders: pdfOrders
      });
      return response;
    } catch (error) {
      console.error('Erreur lors de la réorganisation des PDFs:', error);
      throw error;
    }
  },

  /**
   * Obtenir l'URL de téléchargement d'un fichier PDF
   * @param {Object} pdfFile - Objet fichier PDF
   * @returns {string} URL du fichier
   */
  getPdfUrl(pdfFile) {
    return pdfFile.file_url || pdfFile.file;
  },

  /**
   * Valider un fichier avant upload
   * @param {File} file - Fichier à valider
   * @returns {Object} Résultat de la validation {valid, error}
   */
  validatePdfFile(file) {
    if (!file) {
      return { valid: false, error: 'Aucun fichier sélectionné' };
    }

    // Vérifier l'extension
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return { valid: false, error: 'Seuls les fichiers PDF sont autorisés' };
    }

    // Vérifier la taille (50 MB max)
    const maxSize = 50 * 1024 * 1024; // 50 MB
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB). Taille maximale: 50 MB` 
      };
    }

    return { valid: true };
  },

  /**
   * Formater la taille d'un fichier pour l'affichage
   * @param {number} bytes - Taille en bytes
   * @returns {string} Taille formatée
   */
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }
}; 