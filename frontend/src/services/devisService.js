import api from './api';

export const devisService = {
  /**
   * Récupérer tous les devis d'un projet
   * @param {number} projectId - ID du projet
   * @returns {Promise<Array>} Liste des devis du projet
   */
  async getDevisByProject(projectId) {
    try {
      console.log(`🔍 Récupération des devis pour le projet ${projectId}`);
      
      // 1. Récupérer les liens dans DevisParProjet
      const devisParProjetTable = await this.findDevisParProjetTable();
      if (!devisParProjetTable) {
        throw new Error('Table DevisParProjet introuvable');
      }
      
      const liens = await api.get(`/api/database/records/by_table/?table_id=${devisParProjetTable.id}`);
      console.log(`📋 Liens trouvés:`, liens);
      
      // 2. Filtrer les liens pour ce projet
      const projectLinks = liens.filter(link => {
        const projetId = link.projet_id || link.Projet_ID;
        return String(projetId) === String(projectId);
      });
      
      console.log(`🎯 Liens pour le projet ${projectId}:`, projectLinks);
      
      if (projectLinks.length === 0) {
        return [];
      }
      
      // 3. Extraire les IDs des devis
      const devisIds = [];
      projectLinks.forEach(link => {
        const lienDevis = link.lien_devis || link['Lien Devis'] || '';
        if (lienDevis) {
          // Gérer format "40,68" ou "40" 
          const ids = lienDevis.split(',').map(id => id.trim()).filter(Boolean);
          devisIds.push(...ids);
        }
      });
      
      console.log(`📊 IDs devis à récupérer:`, devisIds);
      
      if (devisIds.length === 0) {
        return [];
      }
      
      // 4. Récupérer les devis complets
      const devisTable = await this.findDevisTable();
      if (!devisTable) {
        throw new Error('Table Devis introuvable');
      }
      
      const allDevis = await api.get(`/api/database/records/by_table/?table_id=${devisTable.id}`);
      
      // 5. Filtrer les devis selon les IDs
      const projectDevis = allDevis.filter(devis => {
        // Vérifier que le devis a un ID valide
        if (!devis || !devis.id) {
          console.warn('⚠️ Devis sans ID ignoré:', devis);
          return false;
        }
        return devisIds.includes(String(devis.id));
      });
      
      console.log(`✅ Devis récupérés pour le projet ${projectId}:`, projectDevis);
      return projectDevis;
      
    } catch (error) {
      console.error('Erreur lors de la récupération des devis:', error);
      throw error;
    }
  },

  /**
   * Créer un nouveau devis et l'associer à un projet
   * @param {number} projectId - ID du projet
   * @param {Object} devisData - Données du devis
   * @returns {Promise<Object>} Devis créé
   */
  async createDevisForProject(projectId, devisData) {
    try {
      console.log(`🆕 Création d'un devis pour le projet ${projectId}:`, devisData);
      
      // 1. Valider les données selon le statut
      const validatedData = this.validateDevisData(devisData);
      
      // 2. Créer le devis
      const devisTable = await this.findDevisTable();
      if (!devisTable) {
        throw new Error('Table Devis introuvable');
      }
      
      const newDevis = await api.post('/api/database/records/create_with_values/', {
        table_id: devisTable.id,
        values: validatedData
      });
      
      console.log(`✅ Devis créé:`, newDevis);
      
      // Vérifier que le devis a bien été créé avec un ID
      if (!newDevis || !newDevis.id) {
        console.error('❌ Erreur: Le devis créé n\'a pas d\'ID:', newDevis);
        throw new Error('Le devis a été créé mais aucun ID n\'a été retourné');
      }
      
      // 3. Créer ou mettre à jour la liaison dans DevisParProjet
      await this.linkDevisToProject(projectId, newDevis.id);
      
      return newDevis;
      
    } catch (error) {
      console.error('Erreur lors de la création du devis:', error);
      throw error;
    }
  },

  /**
   * Mettre à jour un devis existant
   * @param {number} devisId - ID du devis
   * @param {Object} devisData - Nouvelles données
   * @returns {Promise<Object>} Devis mis à jour
   */
  async updateDevis(devisId, devisData) {
    try {
      console.log(`🔄 Mise à jour du devis ${devisId}:`, devisData);
      
      // Valider les données selon le statut
      const validatedData = this.validateDevisData(devisData);
      console.log('📋 Données validées:', validatedData);
      
      const requestPayload = {
        values: validatedData
      };
      console.log('📤 Payload à envoyer:', requestPayload);
      
      const updatedDevis = await api.put(`/api/database/records/${devisId}/update_with_values/`, requestPayload);
      
      console.log(`✅ Devis mis à jour:`, updatedDevis);
      return updatedDevis;
      
    } catch (error) {
      console.error('Erreur lors de la mise à jour du devis:', error);
      throw error;
    }
  },

  /**
   * Supprimer un devis et ses liaisons
   * @param {number} projectId - ID du projet
   * @param {number} devisId - ID du devis
   * @returns {Promise<boolean>} Succès de la suppression
   */
  async deleteDevisFromProject(projectId, devisId) {
    try {
      console.log(`🗑️ Suppression du devis ${devisId} du projet ${projectId}`);
      
      // 1. Supprimer la liaison dans DevisParProjet
      await this.unlinkDevisFromProject(projectId, devisId);
      
      // 2. Supprimer le devis lui-même
      await api.delete(`/api/database/records/${devisId}/`);
      
      console.log(`✅ Devis ${devisId} supprimé`);
      return true;
      
    } catch (error) {
      console.error('Erreur lors de la suppression du devis:', error);
      throw error;
    }
  },

  /**
   * Valider les données d'un devis selon son statut
   * @param {Object} devisData - Données à valider
   * @returns {Object} Données validées
   */
  validateDevisData(devisData) {
    const validated = {
      numero_devis: devisData.numero_devis || '',
      montant: devisData.montant || 0,
      statut: devisData.statut ? 'True' : 'False'  // Convertir en string pour Django
    };
    
    // Si statut = true (ON), les champs sont obligatoires
    if (devisData.statut) {
      if (!devisData.date_debut) {
        throw new Error('Date de début requise quand le devis est actif');
      }
      if (!devisData.date_rendu) {
        throw new Error('Date de rendu requise quand le devis est actif');
      }
      if (!devisData.agent_plateforme) {
        throw new Error('Agent de plateforme requis quand le devis est actif');
      }
      
      validated.date_debut = devisData.date_debut;
      validated.date_rendu = devisData.date_rendu;
      validated.agent_plateforme = devisData.agent_plateforme;
    } else {
      // Si statut = false (OFF), vider les champs optionnels
      validated.date_debut = '';
      validated.date_rendu = '';
      validated.agent_plateforme = '';
    }
    
    return validated;
  },

  /**
   * Lier un devis à un projet dans la table DevisParProjet
   * @param {number} projectId - ID du projet
   * @param {number} devisId - ID du devis
   */
  async linkDevisToProject(projectId, devisId) {
    try {
      const devisParProjetTable = await this.findDevisParProjetTable();
      if (!devisParProjetTable) {
        throw new Error('Table DevisParProjet introuvable');
      }
      
      // Vérifier si une liaison existe déjà pour ce projet
      const existingLinks = await api.get(`/api/database/records/by_table/?table_id=${devisParProjetTable.id}`);
      const projectLink = existingLinks.find(link => {
        const projetId = link.projet_id || link.Projet_ID;
        return String(projetId) === String(projectId);
      });
      
      if (projectLink) {
        // Ajouter le nouvel ID à la liste existante
        const currentLinks = projectLink.lien_devis || projectLink['Lien Devis'] || '';
        const linkIds = currentLinks.split(',').map(id => id.trim()).filter(Boolean);
        
        if (!linkIds.includes(String(devisId))) {
          linkIds.push(String(devisId));
          const newLinks = linkIds.join(',');
          
          await api.put(`/api/database/records/${projectLink.id}/update_with_values/`, {
            values: {
              lien_devis: newLinks
            }
          });
          
          console.log(`✅ Devis ${devisId} ajouté à la liaison existante du projet ${projectId}`);
        }
      } else {
        // Créer une nouvelle liaison
        await api.post('/api/database/records/create_with_values/', {
          table_id: devisParProjetTable.id,
          values: {
            projet_id: projectId,
            lien_devis: String(devisId)
          }
        });
        
        console.log(`✅ Nouvelle liaison créée: projet ${projectId} ↔ devis ${devisId}`);
      }
      
    } catch (error) {
      console.error('Erreur lors de la liaison devis/projet:', error);
      throw error;
    }
  },

  /**
   * Supprimer la liaison entre un devis et un projet
   * @param {number} projectId - ID du projet
   * @param {number} devisId - ID du devis
   */
  async unlinkDevisFromProject(projectId, devisId) {
    try {
      const devisParProjetTable = await this.findDevisParProjetTable();
      if (!devisParProjetTable) {
        throw new Error('Table DevisParProjet introuvable');
      }
      
      const existingLinks = await api.get(`/api/database/records/by_table/?table_id=${devisParProjetTable.id}`);
      const projectLink = existingLinks.find(link => {
        const projetId = link.projet_id || link.Projet_ID;
        return String(projetId) === String(projectId);
      });
      
      if (projectLink) {
        const currentLinks = projectLink.lien_devis || projectLink['Lien Devis'] || '';
        const linkIds = currentLinks.split(',').map(id => id.trim()).filter(Boolean);
        const updatedIds = linkIds.filter(id => id !== String(devisId));
        
        if (updatedIds.length === 0) {
          // Supprimer complètement la liaison si plus de devis
          await api.delete(`/api/database/records/${projectLink.id}/`);
          console.log(`✅ Liaison supprimée pour le projet ${projectId}`);
        } else {
          // Mettre à jour la liaison avec les IDs restants
          await api.put(`/api/database/records/${projectLink.id}/update_with_values/`, {
            values: {
              lien_devis: updatedIds.join(',')
            }
          });
          console.log(`✅ Devis ${devisId} retiré de la liaison du projet ${projectId}`);
        }
      }
      
    } catch (error) {
      console.error('Erreur lors de la suppression de liaison:', error);
      throw error;
    }
  },

  /**
   * Trouver la table Devis
   * @returns {Promise<Object>} Table Devis
   */
  async findDevisTable() {
    try {
      const tables = await api.get('/api/database/tables/');
      return tables.find(table => 
        table.name === 'Devis' || 
        table.slug === 'devis'
      );
    } catch (error) {
      console.error('Erreur lors de la recherche de la table Devis:', error);
      return null;
    }
  },

  /**
   * Trouver la table DevisParProjet
   * @returns {Promise<Object>} Table DevisParProjet
   */
  async findDevisParProjetTable() {
    try {
      const tables = await api.get('/api/database/tables/');
      return tables.find(table => 
        table.name === 'DevisParProjet' || 
        table.slug === 'devisparprojet'
      );
    } catch (error) {
      console.error('Erreur lors de la recherche de la table DevisParProjet:', error);
      return null;
    }
  }
};

export default devisService; 