import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook pour gérer le reset automatique de la position de scroll lors de la navigation
 * 
 * @param {Object} options - Options de configuration
 * @param {boolean} options.enabled - Active/désactive le reset automatique (défaut: true)
 * @param {string[]} options.excludeRoutes - Routes à exclure du reset automatique
 * @param {number} options.delay - Délai en ms avant le reset (défaut: 0)
 * @param {boolean} options.smooth - Utilise un scroll smooth au lieu d'instant (défaut: false)
 */
export function useScrollReset(options = {}) {
  const {
    enabled = true,
    excludeRoutes = [],
    delay = 0,
    smooth = false
  } = options;
  
  const location = useLocation();

  useEffect(() => {
    if (!enabled) return;

    // Vérifier si la route actuelle doit être exclue
    const shouldExclude = excludeRoutes.some(route => 
      location.pathname.includes(route)
    );

    if (shouldExclude) {
      return;
    }

    const resetScroll = () => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: smooth ? 'smooth' : 'instant'
      });
    };

    if (delay > 0) {
      const timeoutId = setTimeout(resetScroll, delay);
      return () => clearTimeout(timeoutId);
    } else {
      resetScroll();
    }
  }, [location.pathname, enabled, excludeRoutes, delay, smooth]);
}

/**
 * Hook pour sauvegarder et restaurer la position de scroll pour des routes spécifiques
 * Utile pour maintenir la position lors du retour à une page (ex: Dashboard -> Détails -> Dashboard)
 */
export function useScrollMemory(options = {}) {
  const {
    saveRoutes = ['/dashboard'], // Routes pour lesquelles on sauvegarde la position
    restoreRoutes = ['/dashboard'], // Routes pour lesquelles on restaure la position
    storageKey = 'scrollPosition',
    enabled = true
  } = options;
  
  const location = useLocation();

  useEffect(() => {
    if (!enabled) return;

    // Restaurer la position en arrivant sur certaines routes
    if (restoreRoutes.includes(location.pathname)) {
      const savedPosition = sessionStorage.getItem(`${storageKey}_${location.pathname}`);
      if (savedPosition) {
        const position = parseInt(savedPosition, 10);
        setTimeout(() => {
          window.scrollTo({
            top: position,
            behavior: 'instant'
          });
        }, 150); // Délai pour laisser le contenu se charger
      }
    }

    // Fonction pour sauvegarder la position lors du changement de route
    const saveCurrentPosition = () => {
      if (saveRoutes.includes(location.pathname)) {
        const scrollPosition = window.pageYOffset;
        sessionStorage.setItem(`${storageKey}_${location.pathname}`, scrollPosition.toString());
      }
    };

    // Sauvegarder la position avant de quitter la page
    window.addEventListener('beforeunload', saveCurrentPosition);
    
    // Cleanup: sauvegarder la position et nettoyer les événements
    return () => {
      saveCurrentPosition();
      window.removeEventListener('beforeunload', saveCurrentPosition);
    };
  }, [location.pathname, saveRoutes, restoreRoutes, storageKey, enabled]);
}

/**
 * Hook combiné qui gère à la fois le reset et la mémoire de scroll
 * Configuration intelligente selon les routes
 */
export function useSmartScrollManagement() {
  const location = useLocation();

  // Configuration des routes qui doivent conserver leur position
  const persistentRoutes = ['/dashboard'];
  
  // Configuration des routes qui doivent toujours remonter en haut
  const resetRoutes = ['/projects', '/admin', '/login'];

  // Déterminer le comportement selon la route actuelle
  const shouldPersist = persistentRoutes.some(route => 
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  const shouldReset = resetRoutes.some(route => 
    location.pathname.startsWith(route)
  );

  // Utiliser la mémoire de scroll pour les routes persistantes
  useScrollMemory({
    enabled: shouldPersist,
    saveRoutes: persistentRoutes,
    restoreRoutes: persistentRoutes
  });

  // Utiliser le reset pour les autres routes
  useScrollReset({
    enabled: shouldReset || !shouldPersist,
    delay: 50 // Petit délai pour laisser le contenu se charger
  });
} 