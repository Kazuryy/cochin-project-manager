// frontend/src/pages/Dashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FiFilter, FiHeart, FiRefreshCw, FiUser, FiPlus, FiDatabase } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useDynamicTables } from '../contexts/hooks/useDynamicTables';
import { useAdvancedFilters } from '../hooks/useAdvancedFilters';
import { devisService } from '../services/devisService';
import MultipleSelector from '../components/filters/MultiSelector';
import AdvancedFilterPanel from '../components/filters/AdvancedFilterPanel';
import ColumnSelector from '../components/filters/ColumnSelector';
import PresetManager from '../components/filters/PresetManager';
import SortManager from '../components/filters/SortManager';
import { DynamicTableProvider } from '../contexts/DynamicTableProvider';

function DashboardContent() {
  const { tables, fetchTables, fetchRecords, isLoading, error } = useDynamicTables();
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
    { id: 'contact_email', label: 'Email contact', description: 'Email du contact' },
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
  }, [searchTerm, selectedTypes, getFieldValueLegacy, getProjectType, getFieldValue, contacts]);

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
    ['project_name', 'project_description', 'project_number', 'project_type', 'project_subtype', 'contact_principal', 'statut', 'progress'],
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
        
        // Si un projet n'a pas de données de progression, le mettre à la fin
        if (!progressA && !progressB) return 0;
        if (!progressA) return 1;
        if (!progressB) return -1;
        
        // Prioriser les projets avec des devis actifs
        const hasActiveA = progressA.activeDevis > 0;
        const hasActiveB = progressB.activeDevis > 0;
        
        // Si seul A a des devis actifs, il passe en premier
        if (hasActiveA && !hasActiveB) return -1;
        if (!hasActiveA && hasActiveB) return 1;
        
        // Si aucun n'a de devis actifs, trier par nom
        if (!hasActiveA && !hasActiveB) {
          const nameA = getFieldValue(a, 'nom_projet') || '';
          const nameB = getFieldValue(b, 'nom_projet') || '';
          return nameA.localeCompare(nameB);
        }
        
        // Si les deux ont des devis actifs, trier par proximité d'échéance
        const deadlineA = progressA.nearestDeadline;
        const deadlineB = progressB.nearestDeadline;
        
        // Si seul A a une échéance, il passe en premier
        if (deadlineA && !deadlineB) return -1;
        if (!deadlineA && deadlineB) return 1;
        
        // Si aucun n'a d'échéance, trier par progression (plus faible en premier pour urgence)
        if (!deadlineA && !deadlineB) {
          return progressA.progress - progressB.progress;
        }
        
        // Si les deux ont des échéances, trier par proximité (le plus proche en premier)
        return deadlineA - deadlineB;
      });
    }
    
    return result;
  }, [filters.length, sorting.length, filteredData, legacyFilteredProjects, projectProgress, getFieldValue]);

  // Assurer que les colonnes visibles sont initialisées par défaut
  useEffect(() => {
    if (visibleColumns.length === 0) {
      setVisibleColumns(['project_name', 'project_description', 'project_number', 'project_type', 'project_subtype', 'contact_principal', 'statut', 'progress']);
    }
  }, [visibleColumns.length, setVisibleColumns]);

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
    setSearchTerm('');
    setSelectedTypes([]);
    setCurrentPage(0);
    clearFilters();
    clearSorting();
  }, [clearFilters, clearSorting]);

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
      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button className="btn btn-sm btn-outline">
          <FiFilter className="mr-2" />
          Projets récents
        </button>
        <button className="btn btn-sm btn-outline">Projets en cours</button>
        <button className="btn btn-sm btn-outline">Projets terminés</button>
        <button className="btn btn-sm btn-outline">Mes projets</button>
        <button className="btn btn-sm btn-outline btn-circle">+</button>
      </div>

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
                    placeholder="Nom, description, contact..." 
                    className="input input-bordered input-sm w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button 
                      className="btn btn-sm btn-square btn-ghost" 
                      onClick={() => setSearchTerm('')}
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
                  onChange={setSelectedTypes}
                  placeholder="Choisissez des types..."
                />
                {selectedTypes.length > 0 && (
                  <div className="text-xs text-secondary mt-1">
                    📂 {selectedTypes.length} type(s) sélectionné(s)
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="mb-6">
                <button 
                  className="btn btn-outline btn-sm w-full gap-2" 
                  onClick={resetFilters}
                  title="Effacer tous les filtres et réinitialiser la vue"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  Réinitialiser tout
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
                  <button className="btn btn-success btn-sm">
                    Exporter en TSV
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
                        const typeId = getFieldValueLegacy(project, 'type_projet', 'type_id', 'type', 'category_id', 'categorie_id');
                        
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
                                  {contactInfo.email && visibleColumns.includes('contact_email') && (
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
                      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    >
                      «
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        className={`join-item btn ${currentPage === i ? 'btn-active' : ''}`}
                        onClick={() => setCurrentPage(i)}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button 
                      className="join-item btn"
                      disabled={currentPage === totalPages - 1}
                      onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
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