/**
 * Modals Components Barrel Export
 * 
 * Ce fichier centralise tous les exports des composants modaux
 * pour faciliter les imports et maintenir une API cohérente.
 * 
 * Usage:
 * import { CreateTypeModal } from '@/components/modals';
 */

// Export principal du composant
export { default as CreateTypeModal } from './CreateTypeModal';

/**
 * Liste des composants modaux disponibles
 * Utile pour la documentation automatique
 */
export const AVAILABLE_MODALS = [
  'CreateTypeModal'
];

/**
 * Helper pour vérifier si un modal est disponible
 * @param {string} modalName - Le nom du modal à vérifier
 * @returns {boolean} - True si le modal existe
 */
export const isModalAvailable = (modalName) => {
  return AVAILABLE_MODALS.includes(modalName);
};

/**
 * Metadata des modaux pour usage avancé
 */
export const MODAL_METADATA = {
  CreateTypeModal: {
    name: 'CreateTypeModal',
    description: 'Modal pour créer un nouveau type avec ses colonnes',
    category: 'creation'
  }
};