// frontend/src/pages/Dashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FiFilter, FiHeart, FiRefreshCw, FiUser, FiDatabase } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useDynamicTables } from '../contexts/hooks/useDynamicTables';
import { useAdvancedFilters } from '../hooks/useAdvancedFilters';
import { devisService } from '../services/devisService';
import MultipleSelector from '../components/filters/MultiSelector';
import AdvancedFilterPanel from '../components/filters/AdvancedFilterPanel';
import ColumnSelector from '../components/filters/ColumnSelector';
import PresetManager from '../components/filters/PresetManager';
import SortManager from '../components/filters/SortManager';
import ExportConfigModal from '../components/export/ExportConfigModal';
import { DynamicTableProvider } from '../contexts/DynamicTableProvider';
import { useActivityTracker } from '../hooks/useActivityTracker';

function DashboardContent() {
  const { tables, fetchTables, fetchRecords, isLoading, error } = useDynamicTables();
  const { trackActivity } = useActivityTracker();
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectTypes, setProjectTypes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [tableNames, setTableNames] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [detailsData, setDetailsData] = useState({});
  const [projectProgress, setProjectProgress] = useState({});

  // États de chargement global
  const [isDashboardReady, setIsDashboardReady] = useState(false);
  const [isFullyStabilized, setIsFullyStabilized] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    tables: true,
    projects: true,
    contacts: true,
    tableNames: true,
    detailsData: true,
    projectProgress: true
  });

  // Tables IDs
  const [projectTableId, setProjectTableId] = useState(null);
  const [contactTableId, setContactTableId] = useState(null);
  const [tableNamesTableId, setTableNamesTableId] = useState(null);

  // Fonction pour marquer une étape comme terminée
  const markStepComplete = useCallback((step) => {
    setLoadingStates(prev => {
      const updated = { ...prev, [step]: false };
      
      // Vérifier si TOUTES les étapes sont terminées (pas seulement les critiques)
      const allStepsComplete = Object.values(updated).every(state => !state);
      
      if (allStepsComplete && !isDashboardReady) {
        setIsDashboardReady(true);
        
        // Ajouter un délai de stabilisation plus long pour éviter complètement le clignotement
        setTimeout(() => {
          setIsFullyStabilized(true);
        }, 800); // Délai plus long pour s'assurer de la stabilité complète
      }
      
      return updated;
    });
  }, [isDashboardReady]);

  // Définition des colonnes disponibles
  const availableColumns = [
    { id: 'project_name', label: 'Nom du projet', description: 'Nom principal du projet' },
    { id: 'project_description', label: 'Description', description: 'Description du projet' },
    { id: 'project_number', label: 'Numéro', description: 'Numéro de référence' },
    { id: 'project_type', label: 'Type', description: 'Type/catégorie du projet' },
    { id: 'project_subtype', label: 'Sous-type', description: 'Sous-type du projet' },
    { id: 'contact_principal', label: 'Contact principal', description: 'Responsable du projet' },
    { id: 'email', label: 'Email contact', description: 'Email du contact' },
    { id: 'equipe', label: 'Équipe', description: 'Équipe assignée' },
    { id: 'date_creation', label: 'Date création', description: 'Date de création du projet' },
    { id: 'statut', label: 'Statut', description: 'Statut actuel du projet' },
    { id: 'progress', label: 'Progression', description: 'Avancement du projet basé sur les devis' }
  ];

  // Champs disponibles pour les filtres
  const availableFields = [
    { value: 'nom_projet', label: 'Nom du projet' },
    { value: 'description', label: 'Description' },
    { value: 'numero_projet', label: 'Numéro projet' },
    { value: 'type_projet', label: 'Type de projet' },
    { value: 'sous_type_projet', label: 'Sous-type de projet' },
    { value: 'contact_principal', label: 'Contact principal' },
    { value: 'equipe', label: 'Équipe' },
    { value: 'date_creation', label: 'Date de création' },
    { value: 'statut', label: 'Statut' },
    { value: 'termine', label: 'Terminé' },
    { value: 'actif', label: 'Actif' }
  ];

  // Fonction améliorée pour extraire les valeurs (définie avant useAdvancedFilters)
  const getFieldValueLegacy = useCallback((record, ...possibleFields) => {
    if (!record) return '';
    
    // Essayer les champs directs d'abord
    for (const field of possibleFields) {
      if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
        return record[field];
      }
    }
    
    // Puis essayer dans values
    if (record.values && Array.isArray(record.values)) {
      for (const field of possibleFields) {
        const valueField = record.values.find(v => v.field_slug === field);
        if (valueField && valueField.value !== undefined && valueField.value !== null && valueField.value !== '') {
          return valueField.value;
        }
      }
    }
    
    return '';
  }, []);

  // Fonction améliorée pour obtenir le type de projet
  const getProjectType = useCallback((typeId) => {
    if (!typeId || !tableNames.length) {
      return 'Type inconnu';
    }
    
    const typeRecord = tableNames.find(t => t.id.toString() === typeId.toString());
    if (!typeRecord) {
      return `${typeId}`;
    }
    
    // Essayer tous les champs possibles
    const typeName = getFieldValueLegacy(typeRecord, 'nom', 'name', 'title', 'titre', 'label', 'type_name');
    
    if (!typeName) {
      // Si aucun nom trouvé, afficher toutes les données disponibles
      const availableData = [];
      Object.keys(typeRecord).forEach(key => {
        if (typeRecord[key] && key !== 'id' && key !== 'values') {
          availableData.push(`${key}: ${typeRecord[key]}`);
        }
      });
      if (typeRecord.values) {
        typeRecord.values.forEach(v => {
          if (v.value) {
            availableData.push(`${v.field_slug}: ${v.value}`);
          }
        });
      }
      return availableData.length > 0 ? availableData.join(', ') : `Type #${typeId}`;
    }
    
    return typeName;
  }, [tableNames, getFieldValueLegacy]);

  // Fonction pour obtenir le sous-type de projet
  const getProjectSubtype = useCallback((project, projectTypeName) => {
    if (!project || !projectTypeName || !tables.length || projectTypeName === 'Type inconnu') {
      return 'Sous-type inconnu';
    }
    
    // Construire le nom de la table des détails : {Type}Details
    const detailsTableName = `${projectTypeName}Details`;
    
    // Trouver la table des détails
    const detailsTable = tables.find(t => 
      t.name === detailsTableName || 
      t.name.toLowerCase() === detailsTableName.toLowerCase()
    );
    
    if (!detailsTable) {
      return 'Table détails non trouvée';
    }
    
    // Récupérer les données de détails pour ce projet
    const projectDetailsData = detailsData[detailsTableName];
    if (!projectDetailsData) {
      return 'Données détails non chargées';
    }
    
    // Trouver l'enregistrement correspondant à ce projet
    const projectDetails = projectDetailsData.find(detail => {
      // Essayer différents champs pour lier au projet
      const projectId = getFieldValueLegacy(detail, 
        'projet_auto_id',  // Vu dans PrestationDetails
        'projet_id', 
        'project_id', 
        'id_projet', 
        'projet', 
        'project'
      );
      return projectId && projectId.toString() === project.id.toString();
    });
    
    if (!projectDetails) {
      return 'Détails projet non trouvés';
    }
    
    // Construire le nom du champ sous-type : sous_type_{type}
    const subtypeFieldName = `sous_type_${projectTypeName.toLowerCase()}`;
    
    // Récupérer le sous-type depuis les détails
    const subtypeValue = getFieldValueLegacy(projectDetails, 
      'sous_type',  // Champ principal vu dans les logs
      subtypeFieldName,
      `sous_type_${projectTypeName}`,
      'subtype',
      'sub_type'
    );
    
    return subtypeValue || 'Sous-type non défini';
  }, [tables, getFieldValueLegacy, detailsData]);

  // Fonction personnalisée pour extraire les valeurs (gère les champs complexes)
  const getFieldValue = useCallback((record, field) => {
    if (!record) return '';
    
    // Gestion des champs spéciaux qui nécessitent une logique particulière
    switch (field) {
      case 'type_projet': {
        const typeId = getFieldValueLegacy(record, 'type_projet', 'type_id', 'type', 'category_id');
        return getProjectType(typeId);
      }
      
      case 'sous_type_projet': {
        const typeId = getFieldValueLegacy(record, 'type_projet', 'type_id', 'type', 'category_id');
        const projectTypeName = getProjectType(typeId);
        return getProjectSubtype(record, projectTypeName);
      }
      
      case 'contact_principal': {
        const contactValue = getFieldValueLegacy(record, 
          'contact_principal', 'contact_principal_id', 'contact_id', 'contact', 'client_id', 'responsable_id'
        );
        
        if (!contactValue || contactValue === 'Contact non défini') {
          return 'Contact non défini';
        }
        
        // Si c'est une référence manquante, extraire le nom
        if (contactValue.startsWith('[Référence manquante:') && contactValue.endsWith(']')) {
          return contactValue.replace('[Référence manquante:', '').replace(']', '').trim();
        }
        
        // Essayer de trouver le contact correspondant
        const matchingContact = contacts.find(contact => {
          const contactName = getFieldValueLegacy(contact, 'nom', 'name', 'prenom', 'label') || `Contact #${contact.id}`;
          const contactPrenom = getFieldValueLegacy(contact, 'prenom', 'first_name', 'firstname');
          const fullName = contactPrenom ? `${contactPrenom} ${contactName}` : contactName;
          
          return fullName === contactValue || contactName === contactValue;
        });
        
        if (matchingContact) {
          const contactName = getFieldValueLegacy(matchingContact, 'nom', 'name', 'prenom', 'label');
          const contactPrenom = getFieldValueLegacy(matchingContact, 'prenom', 'first_name', 'firstname');
          return contactPrenom ? `${contactPrenom} ${contactName}` : contactName;
        }
        
        return contactValue;
      }
      
      case 'nom_projet':
        return getFieldValueLegacy(record, 'nom_projet', 'nom', 'name', 'title', 'titre', 'project_name', 'libelle');
      
      case 'description':
        return getFieldValueLegacy(record, 'description', 'desc', 'details', 'resume', 'summary');
      
      case 'numero_projet':
        return getFieldValueLegacy(record, 'numero_projet', 'number', 'num', 'numero', 'code', 'reference');
      
      case 'equipe':
        return getFieldValueLegacy(record, 'equipe', 'team', 'groupe', 'department', 'service');
      
      case 'date_creation':
        return getFieldValueLegacy(record, 'date_creation', 'created_at', 'date_created', 'creation_date');
      
      case 'statut':
        return getFieldValueLegacy(record, 'statut', 'status', 'etat', 'state');
      
      case 'progress': {
        const progressInfo = projectProgress[record.id];
        if (!progressInfo) return 0;
        // Retourner un score qui combine progression et proximité d'échéance
        let score = progressInfo.progress;
        if (progressInfo.nearestDeadline) {
          const now = new Date();
          const deadline = progressInfo.nearestDeadline;
          const daysUntilDeadline = Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));
          // Les projets avec échéance proche ont un score plus élevé pour être triés en premier
          score += (100 - Math.min(100, daysUntilDeadline));
        }
        return score;
      }
      
      // Pour les autres champs, utiliser la logique legacy standard
      default:
        return getFieldValueLegacy(record, field);
    }
  }, [getFieldValueLegacy, getProjectType, getProjectSubtype, contacts, projectProgress]);

  // Application des filtres legacy
  const applyLegacyFilters = useCallback((projectList) => {
    return projectList.filter((project) => {
      // Filtre par recherche
      if (searchTerm) {
        const searchableValues = [];
        
        // Ajouter les champs directs du projet
        Object.keys(project).forEach(key => {
          if (typeof project[key] === 'string') {
            searchableValues.push(project[key].toLowerCase());
          }
        });
        
        // Ajouter les valeurs du projet
        if (project.values) {
          project.values.forEach(v => {
            if (typeof v.value === 'string') {
              searchableValues.push(v.value.toLowerCase());
            }
          });
        }
        
        // Ajouter le contact principal au champ de recherche
        const contactValue = getFieldValue(project, 'contact_principal');
        if (contactValue && contactValue !== 'Contact non défini') {
          // Nettoyer le nom du contact (enlever [Référence manquante: xxx] si présent)
          let cleanContactName = contactValue;
          if (contactValue.startsWith('[Référence manquante:') && contactValue.endsWith(']')) {
            cleanContactName = contactValue.replace('[Référence manquante:', '').replace(']', '').trim();
          }
          searchableValues.push(cleanContactName.toLowerCase());
          
          // Essayer de trouver le contact complet dans la liste pour avoir plus d'infos
          const matchingContact = contacts.find(contact => {
            const contactName = getFieldValueLegacy(contact, 'nom', 'name', 'prenom', 'label') || `Contact #${contact.id}`;
            const contactPrenom = getFieldValueLegacy(contact, 'prenom', 'first_name', 'firstname');
            const fullName = contactPrenom ? `${contactPrenom} ${contactName}` : contactName;
            
            return fullName === cleanContactName || contactName === cleanContactName;
          });
          
          if (matchingContact) {
            // Ajouter le prénom et nom séparément si disponibles
            const nom = getFieldValueLegacy(matchingContact, 'nom', 'name', 'label');
            const prenom = getFieldValueLegacy(matchingContact, 'prenom', 'first_name', 'firstname');
            const email = getFieldValueLegacy(matchingContact, 'email', 'mail', 'e_mail', 'courriel');
            
            if (nom) searchableValues.push(nom.toLowerCase());
            if (prenom) searchableValues.push(prenom.toLowerCase());
            if (email) searchableValues.push(email.toLowerCase());
          }
        }
        
        // Ajouter les numéros/noms des devis du projet à la recherche
        const progressInfo = projectProgress[project.id];
        if (progressInfo && progressInfo.activeDevisNumbers && progressInfo.activeDevisNumbers.length > 0) {
          // Ajouter tous les numéros de devis actifs
          progressInfo.activeDevisNumbers.forEach(devisNumber => {
            if (devisNumber && typeof devisNumber === 'string') {
              searchableValues.push(devisNumber.toLowerCase());
              
              // Si le numéro contient "Devis #", ajouter aussi juste le numéro
              if (devisNumber.startsWith('Devis #')) {
                const justNumber = devisNumber.replace('Devis #', '').trim();
                if (justNumber) {
                  searchableValues.push(justNumber.toLowerCase());
                }
              }
              
              // Extraire des parties du numéro de devis pour une recherche plus flexible
              // Ex: "PRJ-2024-001" → ["PRJ", "2024", "001", "PRJ-2024", "2024-001"]
              const parts = devisNumber.split(/[-_\s]+/);
              if (parts.length > 1) {
                // Ajouter chaque partie individuellement
                parts.forEach(part => {
                  if (part && part.length >= 2) {
                    searchableValues.push(part.toLowerCase());
                  }
                });
                
                // Ajouter des combinaisons de parties adjacentes
                for (let i = 0; i < parts.length - 1; i++) {
                  const combination = `${parts[i]}-${parts[i + 1]}`;
                  searchableValues.push(combination.toLowerCase());
                }
              }
              
              // Extraire les nombres du numéro pour recherche numérique
              const numbers = devisNumber.match(/\d+/g);
              if (numbers) {
                numbers.forEach(num => {
                  if (num.length >= 2) { // Ignorer les nombres trop courts
                    searchableValues.push(num);
                  }
                });
              }
            }
          });
        }
        
        const matchesSearch = searchableValues.some(value => 
          value.includes(searchTerm.toLowerCase())
        );
        
        if (!matchesSearch) return false;
      }
      
      // Filtre par types sélectionnés
      if (selectedTypes.length > 0) {
        const projectTypeId = getFieldValueLegacy(project, 'type_projet', 'type_id', 'type', 'category_id');
        const projectTypeName = getProjectType(projectTypeId);
        
        if (!selectedTypes.some(selectedType => projectTypeName.includes(selectedType))) {
          return false;
        }
      }
      
      return true;
    });
  }, [searchTerm, selectedTypes, getFieldValueLegacy, getProjectType, getFieldValue, contacts, projectProgress]);

  // Données filtrées par les filtres legacy en premier
  const legacyFilteredProjects = useMemo(() => {
    return applyLegacyFilters(projects);
  }, [projects, applyLegacyFilters]);

  // Initialisation des filtres avancés avec les données pré-filtrées et fonction getFieldValue personnalisée
  const {
    filters,
    sorting,
    visibleColumns,
    presets,
    filteredData,
    addFilter,
    removeFilter,
    updateFilter,
    clearFilters,
    addSort,
    removeSort,
    clearSorting,
    setVisibleColumns,
    savePreset,
    loadPreset,
    deletePreset,
    loadPresetsFromStorage
  } = useAdvancedFilters(
    legacyFilteredProjects, 
    ['project_name', 'project_description', 'project_number', 'project_type', 'project_subtype', 'contact_principal', 'email', 'statut', 'progress'],
    getFieldValue  // Passer notre fonction personnalisée
  );

  // Données finales à afficher avec tri par défaut basé sur les échéances
  const finalFilteredProjects = useMemo(() => {
    let result;
    
    // Si des filtres avancés sont actifs OU si des tris sont actifs, utiliser filteredData
    if (filters.length > 0 || sorting.length > 0) {
      result = filteredData;
    } else {
      // Sinon, utiliser les données filtrées par les filtres legacy
      result = legacyFilteredProjects;
    }
    
    // Appliquer le tri par défaut uniquement si aucun tri personnalisé n'est actif
    if (sorting.length === 0) {
      result = [...result].sort((a, b) => {
        const progressA = projectProgress[a.id];
        const progressB = projectProgress[b.id];
        
        // Vérifier si les projets ont des devis actifs
        const hasActiveDevisA = progressA && progressA.activeDevis > 0;
        const hasActiveDevisB = progressB && progressB.activeDevis > 0;

        // 1. PRIORITÉ 1 : Les devis finis (progress = 100) avec devis actifs en premier
        const isFinishedA = hasActiveDevisA && progressA.progress === 100;
        const isFinishedB = hasActiveDevisB && progressB.progress === 100;
        
        if (isFinishedA && !isFinishedB) return -1;
        if (!isFinishedA && isFinishedB) return 1;

        // 2. PRIORITÉ 2 : Les devis en cours (progress entre 50 et 99) avec devis actifs ensuite
        const isInProgressA = hasActiveDevisA && progressA.progress >= 50 && progressA.progress < 100;
        const isInProgressB = hasActiveDevisB && progressB.progress >= 50 && progressB.progress < 100;
        
        if (isInProgressA && !isInProgressB) return -1;
        if (!isInProgressA && isInProgressB) return 1;

        // 3. PRIORITÉ 3 : Trier par statut dans l'ordre souhaité
        const statutA = getFieldValue(a, 'statut') || '';
        const statutB = getFieldValue(b, 'statut') || '';
        
        // Ordre de priorité des statuts : en cours, en attente, pas commencé, suspendu, terminé
        const statutOrder = {
          'en cours': 1,
          'en attente': 2,
          'pas commencé': 3,
          'non commencé': 3,
          'suspendu': 4,
          'terminé': 5,
          'termine': 5
        };
        
        const priorityA = statutOrder[statutA.toLowerCase()] || 99;
        const priorityB = statutOrder[statutB.toLowerCase()] || 99;
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // Si même statut, trier par proximité d'échéance (seulement si les projets ont des devis)
        if (hasActiveDevisA && hasActiveDevisB) {
          const deadlineA = progressA.nearestDeadline;
          const deadlineB = progressB.nearestDeadline;
          
          // Si seul A a une échéance, il passe en premier
          if (deadlineA && !deadlineB) return -1;
          if (!deadlineA && deadlineB) return 1;
          
          // Si les deux ont des échéances, trier par proximité (le plus proche en premier)
          if (deadlineA && deadlineB) {
            return deadlineA - deadlineB;
          }
        }
        
        // Enfin, trier par nom pour éviter les incohérences
        const nameA = getFieldValue(a, 'nom_projet') || '';
        const nameB = getFieldValue(b, 'nom_projet') || '';
        return nameA.localeCompare(nameB);
      });
    }
    
    return result;
  }, [filters.length, sorting.length, filteredData, legacyFilteredProjects, projectProgress, getFieldValue]);

  // Assurer que les colonnes visibles sont initialisées par défaut
  useEffect(() => {
    if (visibleColumns.length === 0) {
      setVisibleColumns(['project_name', 'project_description', 'project_number', 'project_type', 'project_subtype', 'contact_principal', 'email', 'statut', 'progress']);
    }
  }, [visibleColumns.length, setVisibleColumns]);

  // Forcer l'ajout de l'email aux colonnes visibles si elle n'y est pas
  useEffect(() => {
    if (visibleColumns.length > 0 && !visibleColumns.includes('email')) {
      setVisibleColumns(prev => [...prev, 'email']);
    }
  }, [visibleColumns, setVisibleColumns]);

  // Fonction pour calculer la progression d'un projet basée sur ses devis (inspirée de DevisManager)
  const calculateProjectProgress = useCallback(async (projectId) => {
    try {
      const devisList = await devisService.getDevisByProject(projectId);
      
      if (!devisList || devisList.length === 0) {
        return { 
          status: 'Aucun devis', 
          progress: 0, 
          color: 'bg-gray-400',
          activeDevis: 0,
          totalDevis: 0,
          nearestDeadline: null,
          nearestDeadlineDevis: null,
          activeDevisNumbers: []
        };
      }

      const progressData = devisList.map(devis => {
        const statutRaw = getFieldValueLegacy(devis, 'statut', 'status', 'etat', 'state');
        const dateDebut = getFieldValueLegacy(devis, 'date_debut', 'date_start', 'start_date');
        const dateRendu = getFieldValueLegacy(devis, 'date_rendu', 'date_end', 'end_date', 'date_fin');
        const numeroDevis = getFieldValueLegacy(devis, 'numero_devis', 'numero', 'number', 'num', 'reference', 'code') || `Devis #${devis.id}`;
        
        // Normaliser le statut boolean (même logique que DevisManager)
        let statut = false;
        if (typeof statutRaw === 'boolean') {
          statut = statutRaw;
        } else if (typeof statutRaw === 'string') {
          const lowerValue = statutRaw.toLowerCase();
          statut = lowerValue === 'true' || lowerValue === '1' || lowerValue === 'oui' || lowerValue === 'yes';
        } else if (typeof statutRaw === 'number') {
          statut = statutRaw === 1;
        }

        if (!statut) {
          return { progress: 0, isActive: false, deadline: null, devisNumber: numeroDevis, devis: devis };
        }

        if (!dateDebut || !dateRendu) {
          return { progress: 25, isActive: true, deadline: null, devisNumber: numeroDevis, devis: devis };
        }

        try {
          const now = new Date();
          const debut = new Date(dateDebut);
          const fin = new Date(dateRendu);
          
          if (isNaN(debut.getTime()) || isNaN(fin.getTime())) {
            return { progress: 25, isActive: true, deadline: null, devisNumber: numeroDevis, devis: devis };
          }
          
          if (now < debut) {
            return { progress: 50, isActive: true, deadline: fin, devisNumber: numeroDevis, devis: devis };
          } else if (now >= debut && now <= fin) {
            const totalDuration = fin - debut;
            const elapsed = now - debut;
            const progressPercent = Math.min(100, Math.max(50, ((elapsed / totalDuration) * 50) + 50));
            return { progress: progressPercent, isActive: true, deadline: fin, devisNumber: numeroDevis, devis: devis };
          } else {
            return { progress: 100, isActive: true, deadline: null, devisNumber: numeroDevis, devis: devis };
          }
        } catch {
          return { progress: 25, isActive: true, deadline: null, devisNumber: numeroDevis, devis: devis };
        }
      });

      const activeDevis = progressData.filter(p => p.isActive).length;
      const totalDevis = devisList.length;
      const averageProgress = progressData.reduce((sum, p) => sum + p.progress, 0) / progressData.length;
      
      // Récupérer les numéros des devis actifs
      const activeDevisNumbers = progressData
        .filter(p => p.isActive)
        .map(p => p.devisNumber);
      
      // Trouver la prochaine échéance avec son devis
      const upcomingDeadlines = progressData
        .filter(p => p.deadline && p.deadline > new Date())
        .sort((a, b) => a.deadline - b.deadline);
      
      const nearestDeadline = upcomingDeadlines.length > 0 ? upcomingDeadlines[0].deadline : null;
      const nearestDeadlineDevis = upcomingDeadlines.length > 0 ? upcomingDeadlines[0].devisNumber : null;

      let status = 'Aucun devis';
      let color = 'bg-gray-400';

      if (activeDevis === 0) {
        status = 'Aucun devis actif';
        color = 'bg-gray-400';
      } else if (averageProgress < 50) {
        status = 'Planification';
        color = 'bg-yellow-400';
      } else if (averageProgress < 100) {
        status = 'En cours';
        color = 'bg-blue-600';
      } else {
        status = 'Terminé';
        color = 'bg-green-600';
      }

      return {
        status,
        progress: Math.round(averageProgress),
        color,
        activeDevis,
        totalDevis,
        nearestDeadline,
        nearestDeadlineDevis,
        activeDevisNumbers
      };

    } catch (error) {
      console.error(`Erreur lors du calcul de progression pour le projet ${projectId}:`, error);
      return { 
        status: 'Erreur', 
        progress: 0, 
        color: 'bg-red-400',
        activeDevis: 0,
        totalDevis: 0,
        nearestDeadline: null,
        nearestDeadlineDevis: null,
        activeDevisNumbers: []
      };
    }
  }, [getFieldValueLegacy]);

  // Charger les tables et identifier les IDs
  useEffect(() => {
    let timeoutId;
    
    const loadTables = async () => {
      try {
        await fetchTables();
        markStepComplete('tables');
      } catch (err) {
        console.error('Erreur lors du chargement des tables:', err);
        markStepComplete('tables'); // Marquer comme terminé même en cas d'erreur
      }
    };

    loadTables();
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchTables, markStepComplete]);

  // Trouver les IDs des tables nécessaires
  useEffect(() => {
    if (tables.length > 0) {
      // Harmonisation avec CreateProject.jsx
      const projectTable = tables.find(t => 
        t.name === 'Projet' ||
        t.slug === 'projet'
      ) || tables.find(t => 
        t.name.toLowerCase() === 'projets' ||
        t.slug === 'projets'
      ) || tables.find(t => 
        t.name.toLowerCase().includes('project') &&
        !t.name.toLowerCase().includes('devis')
      );
      
      const contactTable = tables.find(t => t.name.toLowerCase().includes('contact') || t.slug === 'contacts');
      const tableNamesTable = tables.find(t => t.name.toLowerCase().includes('tablenames') || t.slug === 'table_names');
      
      if (projectTable) setProjectTableId(projectTable.id);
      if (contactTable) setContactTableId(contactTable.id);
      if (tableNamesTable) setTableNamesTableId(tableNamesTable.id);
    }
  }, [tables]);

  // Charger les données des projets
  useEffect(() => {
    const loadProjects = async () => {
      if (projectTableId) {
        try {
          const projectData = await fetchRecords(projectTableId);
          setProjects(projectData || []);
          markStepComplete('projects');
        } catch (err) {
          console.error('Erreur lors du chargement des projets:', err);
          markStepComplete('projects');
        }
      }
    };
    loadProjects();
  }, [projectTableId, fetchRecords, markStepComplete]);

  // Charger les contacts
  useEffect(() => {
    const loadContacts = async () => {
      if (contactTableId) {
        try {
          const contactData = await fetchRecords(contactTableId);
          setContacts(contactData || []);
          markStepComplete('contacts');
        } catch (err) {
          console.error('Erreur lors du chargement des contacts:', err);
          markStepComplete('contacts');
        }
      }
    };
    loadContacts();
  }, [contactTableId, fetchRecords, markStepComplete]);

  // Charger les types de projets (TableNames)
  useEffect(() => {
    const loadTableNames = async () => {
      if (tableNamesTableId) {
        try {
          const tableNamesData = await fetchRecords(tableNamesTableId);
          setTableNames(tableNamesData || []);
          
          // Extraire les types uniques pour les filtres
          const types = tableNamesData?.map(item => 
            getFieldValueLegacy(item, 'nom') || 'Type inconnu'
          ).filter(Boolean) || [];
          setProjectTypes([...new Set(types)]);
          markStepComplete('tableNames');
        } catch (err) {
          console.error('Erreur lors du chargement des types:', err);
          markStepComplete('tableNames');
        }
      }
    };
    loadTableNames();
  }, [tableNamesTableId, fetchRecords, getFieldValueLegacy, markStepComplete]);

  // Charger les données des tables de détails (non critique)
  useEffect(() => {
    const loadDetailsData = async () => {
      if (!tables.length) return;
      
      const detailsTableNames = ['CollaborationDetails', 'FormationDetails', 'PrestationDetails'];
      const newDetailsData = {};
      
      for (const tableName of detailsTableNames) {
        const table = tables.find(t => t.name === tableName);
        if (table) {
          try {
            const data = await fetchRecords(table.id);
            newDetailsData[tableName] = data || [];
          } catch (err) {
            console.error(`Erreur lors du chargement de ${tableName}:`, err);
            newDetailsData[tableName] = [];
          }
        }
      }
      
      setDetailsData(newDetailsData);
      markStepComplete('detailsData');
    };
    
    loadDetailsData();
  }, [tables, fetchRecords, markStepComplete]);

  // Charger les progressions des projets (non critique - se charge après affichage)
  useEffect(() => {
    const loadProjectProgressions = async () => {
      // Attendre que toutes les autres étapes critiques soient terminées avant de charger les progressions
      const criticalStepsComplete = !loadingStates.tables && !loadingStates.projects && !loadingStates.contacts && !loadingStates.tableNames && !loadingStates.detailsData;
      
      if (!projects.length || !criticalStepsComplete) return;

      const progressPromises = projects.map(async (project) => {
        try {
          const progress = await calculateProjectProgress(project.id);
          return { projectId: project.id, progress };
        } catch (err) {
          console.error(`Erreur lors du calcul de progression pour le projet ${project.id}:`, err);
          return { 
            projectId: project.id, 
            progress: { 
              status: 'Erreur', 
              progress: 0, 
              color: 'bg-red-400',
              activeDevis: 0,
              totalDevis: 0,
              nearestDeadline: null,
              nearestDeadlineDevis: null,
              activeDevisNumbers: []
            }
          };
        }
      });

      const progressResults = await Promise.all(progressPromises);
      const progressMap = {};
      progressResults.forEach(({ projectId, progress }) => {
        progressMap[projectId] = progress;
      });
      
      setProjectProgress(progressMap);
      markStepComplete('projectProgress');
    };

    loadProjectProgressions();
  }, [projects, calculateProjectProgress, loadingStates.tables, loadingStates.projects, loadingStates.contacts, loadingStates.tableNames, loadingStates.detailsData, markStepComplete]);

  const findFieldValue = useCallback((contact, fields) => {
    for (const field of fields) {
      const value = getFieldValueLegacy(contact, field);
      if (value) return value;
    }
    return '';
  }, [getFieldValueLegacy]);

  // Fonction pour obtenir les options d'un champ spécifique
  const getFieldOptions = useCallback((field) => {
    switch (field) {
      case 'type_projet':
        return projectTypes;
      case 'equipe':
        return [...new Set(projects.map(p => getFieldValueLegacy(p, 'equipe', 'team', 'groupe')).filter(Boolean))];
      case 'statut':
        return [...new Set(projects.map(p => getFieldValueLegacy(p, 'statut', 'status', 'etat')).filter(Boolean))];
      case 'contact_principal':
        return contacts.map(c => getFieldValueLegacy(c, 'nom', 'name', 'prenom') || `Contact #${c.id}`);
      default:
        return [];
    }
  }, [projectTypes, projects, contacts, getFieldValueLegacy]);

  // Pagination
  const totalPages = Math.ceil(finalFilteredProjects.length / rowsPerPage);
  const startIndex = currentPage * rowsPerPage;
  const paginatedProjects = finalFilteredProjects.slice(startIndex, startIndex + rowsPerPage);

  const resetFilters = useCallback(() => {
    // Signaler l'activité utilisateur
    trackActivity('reset_filters');
    
    // Réinitialiser tous les filtres et états
    setSearchTerm('');
    setSelectedTypes([]);
    setCurrentPage(0);
    setRowsPerPage(10); // Réinitialiser aussi le nombre de lignes par page
    
    // Réinitialiser les filtres avancés
    clearFilters();
    clearSorting();
    
    // Réinitialiser les colonnes visibles à leur état par défaut
          setVisibleColumns(['project_name', 'project_description', 'project_number', 'project_type', 'project_subtype', 'contact_principal', 'email', 'statut', 'progress']);
    
  }, [clearFilters, clearSorting, setVisibleColumns, trackActivity]);

  // Fonction helper pour les badges de statut
  const getStatusBadge = (statut) => {
    const statusConfig = {
      'Non commencé': { emoji: '🔄', color: 'badge-neutral', text: 'Non commencé' },
      'En cours': { emoji: '⚡', color: 'badge-info', text: 'En cours' },
      'Terminé': { emoji: '✅', color: 'badge-success', text: 'Terminé' },
      'En attente': { emoji: '⏸️', color: 'badge-warning', text: 'En attente' },
      'Suspendu': { emoji: '⚠️', color: 'badge-error', text: 'Suspendu' }
    };
    
    const config = statusConfig[statut] || { emoji: '❓', color: 'badge-ghost', text: statut || 'Inconnu' };
    
    return (
      <div className={`badge ${config.color} gap-1`}>
        <span>{config.emoji}</span>
        <span>{config.text}</span>
      </div>
    );
  };

  const getEmptyProjectsMessage = (filteredCount, totalCount) => {
    if (filteredCount === 0 && totalCount > 0) return 'Aucun projet ne correspond aux filtres';
    if (totalCount === 0) return 'Aucun projet trouvé - Ajoutez des projets via les actions rapides ci-dessus';
    return 'Aucun projet à afficher';
  };

  // Fonction pour ouvrir le modal d'export
  const openExportModal = useCallback(() => {
    if (finalFilteredProjects.length === 0) {
      alert('Aucun projet à exporter');
      return;
    }
    setShowExportModal(true);
  }, [finalFilteredProjects.length]);

  // Fonction pour exporter les données en TSV avec colonnes sélectionnées
  const exportToTSV = useCallback(async (selectedColumns) => {
    setIsExporting(true);
    trackActivity('export_tsv');
    
    try {
      // Petit délai pour montrer le feedback visuel
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mappage des colonnes vers les en-têtes et extracteurs de données
      const columnConfig = {
        'nom_projet': {
          header: 'Nom du projet',
          extract: (project) => getFieldValue(project, 'nom_projet') || 'Projet sans nom'
        },
        'description': {
          header: 'Description',
          extract: (project) => getFieldValue(project, 'description') || ''
        },
        'numero_projet': {
          header: 'Numéro projet',
          extract: (project) => getFieldValue(project, 'numero_projet') || ''
        },
        'type_projet': {
          header: 'Type de projet',
          extract: (project) => {
            const typeId = getFieldValueLegacy(project, 'type_projet', 'type_id', 'type', 'category_id');
            return getProjectType(typeId);
          }
        },
        'sous_type_projet': {
          header: 'Sous-type',
          extract: (project) => {
            const typeId = getFieldValueLegacy(project, 'type_projet', 'type_id', 'type', 'category_id');
            const projectType = getProjectType(typeId);
            return getProjectSubtype(project, projectType);
          }
        },
        'equipe': {
          header: 'Équipe',
          extract: (project) => getFieldValue(project, 'equipe') || ''
        },
        'contact_principal': {
          header: 'Contact principal',
          extract: (project) => {
            const contactValue = getFieldValue(project, 'contact_principal');
            if (!contactValue || contactValue === 'Contact non défini') return '';
            
            let cleanContactName = contactValue;
            if (contactValue.startsWith('[Référence manquante:') && contactValue.endsWith(']')) {
              cleanContactName = contactValue.replace('[Référence manquante:', '').replace(']', '').trim();
            }
            
            const matchingContact = contacts.find(contact => {
              const contactNom = getFieldValueLegacy(contact, 'nom', 'name', 'label') || '';
              const contactPrenom = getFieldValueLegacy(contact, 'prenom', 'first_name', 'firstname') || '';
              const fullName = contactPrenom ? `${contactPrenom} ${contactNom}` : contactNom;
              return fullName === cleanContactName || contactNom === cleanContactName;
            });
            
            if (matchingContact) {
              const nom = getFieldValueLegacy(matchingContact, 'nom', 'name', 'label') || '';
              const prenom = getFieldValueLegacy(matchingContact, 'prenom', 'first_name', 'firstname') || '';
              return prenom ? `${prenom} ${nom.toUpperCase()}` : nom;
            }
            return cleanContactName;
          }
        },
        'email_contact': {
          header: 'Email contact',
          extract: (project) => {
            const contactValue = getFieldValue(project, 'contact_principal');
            if (!contactValue || contactValue === 'Contact non défini') return '';
            
            let cleanContactName = contactValue;
            if (contactValue.startsWith('[Référence manquante:') && contactValue.endsWith(']')) {
              cleanContactName = contactValue.replace('[Référence manquante:', '').replace(']', '').trim();
            }
            
            const matchingContact = contacts.find(contact => {
              const contactNom = getFieldValueLegacy(contact, 'nom', 'name', 'label') || '';
              const contactPrenom = getFieldValueLegacy(contact, 'prenom', 'first_name', 'firstname') || '';
              const fullName = contactPrenom ? `${contactPrenom} ${contactNom}` : contactNom;
              return fullName === cleanContactName || contactNom === cleanContactName;
            });
            
            return matchingContact ? getFieldValueLegacy(matchingContact, 'email', 'mail', 'e_mail', 'courriel') || '' : '';
          }
        },
        'devis_actifs': {
          header: 'Devis actifs',
          extract: (project) => {
            const progressInfo = projectProgress[project.id];
            return progressInfo?.activeDevisNumbers?.join(', ') || '';
          }
        },
        'statut': {
          header: 'Statut',
          extract: (project) => getFieldValue(project, 'statut') || ''
        },
        'progression': {
          header: 'Progression (%)',
          extract: (project) => {
            const progressInfo = projectProgress[project.id];
            return progressInfo?.progress || 0;
          }
        },
        'echeance_prochaine': {
          header: 'Échéance prochaine',
          extract: (project) => {
            const progressInfo = projectProgress[project.id];
            if (progressInfo?.nearestDeadline && progressInfo?.nearestDeadlineDevis) {
              const dateStr = progressInfo.nearestDeadline.toLocaleDateString('fr-FR');
              return `${progressInfo.nearestDeadlineDevis} (${dateStr})`;
            }
            return '';
          }
        },
        'date_creation': {
          header: 'Date création',
          extract: (project) => {
            const dateValue = getFieldValue(project, 'date_creation');
            if (!dateValue) return '';
            try {
              return new Date(dateValue).toLocaleDateString('fr-FR');
            } catch {
              return dateValue;
            }
          }
        }
      };
      
      // Construire les en-têtes pour les colonnes sélectionnées
      const headers = selectedColumns.map(colId => columnConfig[colId]?.header || colId);
      
      // Préparer les données pour l'export
      const tsvData = finalFilteredProjects.map(project => {
        return selectedColumns.map(colId => {
          const config = columnConfig[colId];
          if (!config) return '';
          
          const value = config.extract(project);
          // Pour TSV, remplacer les tabulations et retours à la ligne par des espaces
          return String(value || '').replace(/[\t\n\r]/g, ' ');
        });
      });
      
      // Construire le contenu TSV
      const tsvContent = [
        headers.join('\t'),
        ...tsvData.map(row => row.join('\t'))
      ].join('\n');
      
      // Créer et télécharger le fichier
      const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        
        // Nom du fichier avec date et nombre de projets
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `projets_export_${finalFilteredProjects.length}_${timestamp}.tsv`;
        link.setAttribute('download', filename);
        
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Message de succès
        console.log(`✅ Export TSV réussi: ${finalFilteredProjects.length} projets exportés vers ${filename}`);
        
        // Feedback visuel temporaire
        const successMsg = document.createElement('div');
        successMsg.className = 'toast toast-top toast-end';
        successMsg.innerHTML = `
          <div class="alert alert-success">
            <span>📥 Export réussi: ${finalFilteredProjects.length} projets</span>
          </div>
        `;
        document.body.appendChild(successMsg);
        setTimeout(() => {
          if (document.body.contains(successMsg)) {
            document.body.removeChild(successMsg);
          }
        }, 3000);
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'export TSV:', error);
      
      // Feedback d'erreur temporaire
      const errorMsg = document.createElement('div');
      errorMsg.className = 'toast toast-top toast-end';
      errorMsg.innerHTML = `
        <div class="alert alert-error">
          <span>❌ Erreur lors de l'export TSV</span>
        </div>
      `;
      document.body.appendChild(errorMsg);
      setTimeout(() => {
        if (document.body.contains(errorMsg)) {
          document.body.removeChild(errorMsg);
        }
      }, 5000);
    } finally {
      setIsExporting(false);
    }
  }, [finalFilteredProjects, getFieldValue, getFieldValueLegacy, getProjectType, getProjectSubtype, contacts, projectProgress, trackActivity]);

  if (isLoading || !isFullyStabilized) {
    // Calculer le pourcentage de progression pour un meilleur feedback
    const totalSteps = Object.keys(loadingStates).length;
    const completedSteps = Object.values(loadingStates).filter(state => !state).length;
    const progressPercent = Math.round((completedSteps / totalSteps) * 100);
    
    // Messages de chargement selon l'étape
    let loadingMessage = 'Initialisation...';
    if (!loadingStates.tables) loadingMessage = 'Chargement des données...';
    if (!loadingStates.projects) loadingMessage = 'Chargement des projets...';
    if (!loadingStates.contacts) loadingMessage = 'Chargement des contacts...';
    if (!loadingStates.tableNames) loadingMessage = 'Chargement des détails...';
    if (!loadingStates.detailsData) loadingMessage = 'Calcul des progressions...';
    if (!loadingStates.projectProgress) loadingMessage = 'Finalisation...';
    if (isDashboardReady && !isFullyStabilized) loadingMessage = 'Préparation de l\'interface...';
    
    // Pendant la stabilisation, maintenir la barre à 98% pour éviter les à-coups
    const displayProgress = isDashboardReady ? 98 : progressPercent;
    
    return (
      <div className="fixed inset-0 bg-base-100 flex items-center justify-center z-50">
        <div className="text-center max-w-md">
          <div className="loading loading-spinner loading-lg mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Chargement du Dashboard</h3>
          <p className="text-base-content/70 mb-4">{loadingMessage}</p>
          
          {/* Barre de progression */}
          <div className="w-full bg-base-300 rounded-full h-2 mb-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${displayProgress}%` }}
            ></div>
          </div>
          <p className="text-sm text-base-content/50">{displayProgress}% terminé</p>
          
          {/* Message de stabilisation */}
          {isDashboardReady && !isFullyStabilized && (
            <div className="mt-4 p-3 bg-base-200 rounded-lg">
              <p className="text-xs text-base-content/60">
                🔄 Optimisation de l'affichage en cours...
              </p>
            </div>
          )}
          
          {/* Debug info (optionnel) */}
          <details className="mt-4">
            <summary className="text-xs cursor-pointer text-base-content/40">Détails du chargement</summary>
            <div className="text-xs mt-2 text-left">
              {Object.entries(loadingStates).map(([step, isLoading]) => (
                <div key={step} className="flex justify-between">
                  <span>{step}:</span>
                  <span className={isLoading ? 'text-warning' : 'text-success'}>
                    {isLoading ? '⏳' : '✅'}
                  </span>
                </div>
              ))}
              <div className="flex justify-between mt-1">
                <span>stabilisation:</span>
                <span className={isFullyStabilized ? 'text-success' : 'text-warning'}>
                  {isFullyStabilized ? '✅' : '⏳'}
                </span>
              </div>
            </div>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex gap-4">
        {/* Left Sidebar */}
        <div className="w-82">
          <div className="card bg-base-200 border border-base-300 shadow-sm">
            <div className="card-body p-6">
              {/* Header */}
              <div className="flex items-center gap-2 mb-6">
                <FiFilter className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">Filtres & Outils</h3>
              </div>

              {/* Search Section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-primary rounded"></div>
                  <h4 className="font-medium text-sm uppercase tracking-wide text-base-content/70">Recherche</h4>
                </div>
                <div className="input-group">
                  <input 
                    type="text" 
                    placeholder="Nom, description, contact, n° devis..." 
                    className="input input-bordered input-sm w-full"
                    value={searchTerm}
                    onChange={(e) => {
                      trackActivity('search_filter');
                      setSearchTerm(e.target.value);
                    }}
                  />
                  {searchTerm && (
                    <button 
                      className="btn btn-sm btn-square btn-ghost" 
                      onClick={() => {
                        trackActivity('clear_search');
                        setSearchTerm('');
                      }}
                      title="Effacer la recherche"
                    >
                      <span className="text-lg">×</span>
                    </button>
                  )}
                </div>
                {searchTerm && (
                  <div className="text-xs text-primary mt-1">
                    🔍 Recherche active : "{searchTerm}"
                  </div>
                )}
                {!searchTerm && (
                  <div className="text-xs text-base-content/50 mt-1">
                    💡 Astuce : vous pouvez rechercher par numéro de devis (ex: "PRJ-2024-001")
                  </div>
                )}
              </div>

              {/* Project Types Section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-secondary rounded"></div>
                  <h4 className="font-medium text-sm uppercase tracking-wide text-base-content/70">Types de projet</h4>
                  <div className="badge badge-outline badge-xs">{projectTypes.length} types</div>
                </div>
                  <MultipleSelector 
                  options={projectTypes}
                  selectedValues={selectedTypes}
                  onChange={(newTypes) => {
                    trackActivity('type_filter');
                    setSelectedTypes(newTypes);
                  }}
                  placeholder="Choisissez des types..."
                />
              </div>

              {/* Quick Actions */}
              <div className="mb-6">
                <button 
                  className={`btn btn-sm w-full gap-2 ${
                    filters.length > 0 || sorting.length > 0 || searchTerm || selectedTypes.length > 0 
                      ? 'btn-warning' 
                      : 'btn-outline'
                  }`}
                  onClick={resetFilters}
                  title="Effacer tous les filtres et réinitialiser la vue"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  Réinitialiser tout
                  {(filters.length > 0 || sorting.length > 0 || searchTerm || selectedTypes.length > 0) && (
                    <div className="badge badge-xs">
                      {filters.length + (searchTerm ? 1 : 0) + selectedTypes.length + sorting.length}
                    </div>
                  )}
                </button>
              </div>

              {/* Tools Section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-accent rounded"></div>
                  <h4 className="font-medium text-sm uppercase tracking-wide text-base-content/70">Outils d'affichage</h4>
                </div>
                
                <div className="space-y-3">
                  {/* Presets */}
                  <div>
                    <label className="block text-xs font-medium text-base-content/60 mb-1">Modèles sauvegardés</label>
                    <PresetManager
                      presets={presets}
                      onLoadPreset={loadPreset}
                      onDeletePreset={deletePreset}
                      onLoadPresetsFromStorage={loadPresetsFromStorage}
                      className="w-full"
                    />
              </div>

                  {/* Sort */}
                  <div>
                    <label className="block text-xs font-medium text-base-content/60 mb-1">Tri des données</label>
                    <SortManager
                      sorting={sorting}
                      availableFields={availableFields}
                      onAddSort={addSort}
                      onRemoveSort={removeSort}
                      onClearSorting={clearSorting}
                      className="w-full"
                    />
                  </div>
                  
                  {/* Columns */}
                  <div>
                    <label className="block text-xs font-medium text-base-content/60 mb-1">Colonnes visibles</label>
                    <ColumnSelector
                      availableColumns={availableColumns}
                      visibleColumns={visibleColumns}
                      onChange={setVisibleColumns}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Filters Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-warning rounded"></div>
                  <h4 className="font-medium text-sm uppercase tracking-wide text-base-content/70">Filtres avancés</h4>
                  {filters.length > 0 && (
                    <div className="badge badge-warning badge-xs">{filters.length} actif(s)</div>
                  )}
                </div>
                
                <AdvancedFilterPanel
                  filters={filters}
                  availableFields={availableFields}
                  onAddFilter={addFilter}
                  onUpdateFilter={updateFilter}
                  onRemoveFilter={removeFilter}
                  onClearFilters={clearFilters}
                  onSavePreset={savePreset}
                  getFieldOptions={getFieldOptions}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              {/* Table Controls */}
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Pagination Control */}
                  <div className="flex items-center gap-3 bg-base-200 rounded-lg px-4 py-2">
                    <span className="text-sm font-medium whitespace-nowrap">Lignes par page:</span>
                  <select 
                      className="select select-bordered select-sm min-w-20"
                    value={rowsPerPage}
                    onChange={(e) => {
                        trackActivity('change_page_size');
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(0);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                  
                  {/* Status indicators */}
                  <div className="text-sm text-base-content/60 bg-base-200 rounded-lg px-4 py-2">
                    <span className="font-medium">{finalFilteredProjects.length} projet(s)</span>
                    {(filters.length > 0 || sorting.length > 0 || searchTerm || selectedTypes.length > 0) && (
                      <span className="ml-2 text-primary font-medium">
                        • {filters.length + (searchTerm ? 1 : 0) + selectedTypes.length} filtre(s) actif(s)
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Export Button */}
                <div className="flex justify-end">
                  <button 
                    className={`btn btn-success btn-sm gap-2 ${isExporting ? 'loading' : ''}`}
                    onClick={openExportModal}
                    disabled={isExporting || finalFilteredProjects.length === 0}
                    title={`Exporter ${finalFilteredProjects.length} projet(s) en TSV`}
                  >
                    {isExporting ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Export en cours...
                      </>
                    ) : (
                      <>
                        <FiDatabase className="w-4 h-4" />
                        Exporter en TSV ({finalFilteredProjects.length})
                      </>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="alert alert-error mb-4">
                  <span>{error}</span>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      {visibleColumns.includes('project_name') && <th>Projet</th>}
                      {visibleColumns.includes('contact_principal') && <th>Contact Principal</th>}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProjects.length > 0 ? (
                      paginatedProjects.map((project) => {
                        // Essayer de récupérer le nom du projet avec plusieurs variations
                        const projectName = getFieldValue(project, 'nom_projet') || 'Projet sans nom';
                        
                        // Essayer de récupérer la description
                        const projectDescription = getFieldValue(project, 'description') || 'Aucune description';
                        
                        // Essayer de récupérer le numéro
                        const projectNumber = getFieldValue(project, 'numero_projet') || 'N/A';
                        
                        // Essayer de récupérer le contact principal
                        const contactValue = getFieldValue(project, 'contact_principal');
                        
                        // Gérer le contact : extraire le nom même si c'est "[Référence manquante: xxx]"
                        let contactInfo;
                        if (contactValue && contactValue !== 'Contact non défini') {
                          let cleanContactName = contactValue;
                          
                          // Si c'est une référence manquante, extraire le nom
                          if (contactValue.startsWith('[Référence manquante:') && contactValue.endsWith(']')) {
                            cleanContactName = contactValue.replace('[Référence manquante:', '').replace(']', '').trim();
                          }
                          
                          // Essayer de trouver le contact correspondant
                          const matchingContact = contacts.find(contact => {
                            const contactName = getFieldValueLegacy(contact, 'nom', 'name', 'prenom', 'label') || `Contact #${contact.id}`;
                            const contactPrenom = getFieldValueLegacy(contact, 'prenom', 'first_name', 'firstname');
                            const fullName = contactPrenom ? `${contactPrenom} ${contactName}` : contactName;
                            
                            return fullName === cleanContactName || contactName === cleanContactName;
                          });
                          
                          if (matchingContact) {
                            // Contact trouvé, récupérer l'email
                            const email = findFieldValue(matchingContact, ['email', 'mail', 'e_mail', 'courriel']);
                            contactInfo = {
                              nom: cleanContactName,
                              email: email || ''
                            };
                          } else {
                            // Contact non trouvé dans la liste, utiliser le nom nettoyé
                            contactInfo = {
                              nom: cleanContactName,
                              email: ''
                            };
                          }
                        } else {
                          contactInfo = {
                            nom: 'Contact non défini',
                            email: ''
                          };
                        }
                        
                        // Essayer de récupérer l'ID du type
                        const typeId = getFieldValueLegacy(project, 'type_projet', 'type_id', 'type', 'category_id');
                        
                        const projectType = getProjectType(typeId);
                        
                        const projectSubtype = getProjectSubtype(project, projectType);
                        
                        // Essayer de récupérer l'équipe
                        const equipe = getFieldValue(project, 'equipe') || 'Équipe inconnue';
                        
                        // Essayer de récupérer le statut
                        const statut = getFieldValue(project, 'statut') || 'Non commencé';
                        
                        // Récupérer la progression du projet
                        const progressInfo = projectProgress[project.id] || { 
                          status: 'Chargement...', 
                          progress: 0, 
                          color: 'bg-gray-400',
                          activeDevis: 0,
                          totalDevis: 0,
                          nearestDeadline: null,
                          nearestDeadlineDevis: null,
                          activeDevisNumbers: []
                        };
                        
                        return (
                          <tr key={project.id} className="hover">
                            {visibleColumns.includes('project_name') && (
                            <td>
                                <div className="w-full">
                                  <div className="w-full">
                                  <div className="font-bold text-lg">{projectName}</div>
                                    {visibleColumns.includes('project_description') && (
                                  <div className="text-sm opacity-70 max-w-md">
                                    {projectDescription.length > 100 
                                      ? `${projectDescription.substring(0, 100)}...` 
                                      : projectDescription
                                    }
                                  </div>
                                    )}
                                    {visibleColumns.includes('project_number') && (
                                  <div className="text-xs opacity-50 mt-1">
                                    N° {projectNumber}
                                  </div>
                                    )}
                                  <div className="mt-2">
                                      {visibleColumns.includes('project_type') && (
                                    <div className="badge badge-accent mr-2">{projectType}</div>
                                      )}
                                      {visibleColumns.includes('project_subtype') && (
                                        <div className="badge badge-outline badge-secondary mr-2">{projectSubtype}</div>
                                      )}
                                      {visibleColumns.includes('equipe') && (
                                    <div className="badge badge-outline badge-secondary mr-2">{equipe}</div>
                                      )}
                                  </div>
                                    
                                    {/* Barre de progression */}
                                    {visibleColumns.includes('progress') && progressInfo.totalDevis > 0 && (
                                      <div className="mt-4 max-w-md">
                                        <div className="flex justify-between items-center text-xs mb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">Avancement</span>
                                            <div className={`badge badge-xs text-white ${progressInfo.color}`}>
                                              {progressInfo.status}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold">{progressInfo.progress}%</span>
                                            {progressInfo.totalDevis > 0 && (
                                              <span className="text-gray-500 text-xs">
                                                ({progressInfo.activeDevis}/{progressInfo.totalDevis} devis)
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-3">
                                          <div
                                            className={`h-3 rounded-full transition-all duration-500 ease-out ${progressInfo.color}`}
                                            style={{ width: `${progressInfo.progress}%` }}
                                          ></div>
                                        </div>
                                        
                                        {/* Affichage des devis actifs */}
                                        {progressInfo.activeDevisNumbers && progressInfo.activeDevisNumbers.length > 0 && (
                                          <div className="text-xs text-blue-600 mt-2">
                                            <span className="font-medium">Devis actifs:</span> {progressInfo.activeDevisNumbers.join(', ')}
                                          </div>
                                        )}
                                        
                                        {/* Affichage de la prochaine échéance avec numéro de devis */}
                                        {progressInfo.nearestDeadline && progressInfo.nearestDeadlineDevis && (
                                          <div className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                                            <span>📅</span>
                                            <span>Échéance: <strong>{progressInfo.nearestDeadlineDevis}</strong> - {progressInfo.nearestDeadline.toLocaleDateString('fr-FR')}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                </div>
                              </div>
                            </td>
                            )}
                            {visibleColumns.includes('contact_principal') && (
                            <td>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <FiUser className="text-sm" />
                                  <span className="font-medium">{contactInfo.nom}</span>
                                </div>
                                  {contactInfo.email && visibleColumns.includes('email') && (
                                  <div className="text-sm opacity-70">{contactInfo.email}</div>
                                )}
                              </div>
                            </td>
                            )}
                            <td>
                              <div className="flex flex-col gap-2">
                                <Link 
                                  to={`/projects/${project.id}`} 
                                  className="btn btn-warning btn-sm"
                                >
                                  👁️ Voir détails
                                </Link>
                                {visibleColumns.includes('statut') && (
                                  <div className="flex justify-center">
                                    {getStatusBadge(statut)}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={Math.max(visibleColumns.length + 1, 3)} className="text-center py-8">
                          {getEmptyProjectsMessage(finalFilteredProjects.length, projects.length)}
                          {/* Debug info */}
                          <div className="text-xs text-gray-500 mt-2">
                            Debug: Projects: {projects.length}, Filtered: {finalFilteredProjects.length}, Visible columns: {visibleColumns.join(', ')}, Loading: {isLoading ? 'Oui' : 'Non'}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
              <div className="flex justify-center mt-4">
                <div className="join">
                    <button 
                      className="join-item btn"
                      disabled={currentPage === 0}
                      onClick={() => {
                        trackActivity('previous_page');
                        setCurrentPage(Math.max(0, currentPage - 1));
                      }}
                    >
                      «
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        className={`join-item btn ${currentPage === i ? 'btn-active' : ''}`}
                        onClick={() => {
                          trackActivity('goto_page');
                          setCurrentPage(i);
                        }}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button 
                      className="join-item btn"
                      disabled={currentPage === totalPages - 1}
                      onClick={() => {
                        trackActivity('next_page');
                        setCurrentPage(Math.min(totalPages - 1, currentPage + 1));
                      }}
                    >
                      »
                    </button>
                  </div>
                </div>
              )}

              {/* Statistiques */}
              <div className="flex justify-between items-center mt-4 text-sm opacity-70">
                <span>
                  Affichage de {startIndex + 1} à {Math.min(startIndex + rowsPerPage, finalFilteredProjects.length)} sur {finalFilteredProjects.length} projet(s)
                  {(filters.length > 0 || sorting.length > 0) && (
                    <span className="ml-2 text-primary">
                      • {filters.length} filtre(s) • {sorting.length} tri(s)
                </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal d'export */}
      <ExportConfigModal 
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={exportToTSV}
        projectCount={finalFilteredProjects.length}
      />
    </div>
  );
}

function Dashboard() {
  return (
    <DynamicTableProvider>
      <DashboardContent />
    </DynamicTableProvider>
  );
}

export default Dashboard;