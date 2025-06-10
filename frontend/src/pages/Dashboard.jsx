// frontend/src/pages/Dashboard.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FiFilter, FiHeart, FiRefreshCw, FiUser, FiPlus, FiDatabase } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useDynamicTables } from '../contexts/hooks/useDynamicTables';
import { useAdvancedFilters } from '../hooks/useAdvancedFilters';
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
  const [showFavorites, setShowFavorites] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectTypes, setProjectTypes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [tableNames, setTableNames] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [detailsData, setDetailsData] = useState({});

  // Tables IDs
  const [projectTableId, setProjectTableId] = useState(null);
  const [contactTableId, setContactTableId] = useState(null);
  const [tableNamesTableId, setTableNamesTableId] = useState(null);

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
    { id: 'statut', label: 'Statut', description: 'Statut actuel' }
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
    { value: 'budget', label: 'Budget' },
    { value: 'montant', label: 'Montant' },
    { value: 'priorite', label: 'Priorité' },
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

  // Application des filtres legacy
  const applyLegacyFilters = useCallback((projectList) => {
    return projectList.filter((project) => {
      // Filtre par recherche
      if (searchTerm) {
        const searchableValues = [];
        
        Object.keys(project).forEach(key => {
          if (typeof project[key] === 'string') {
            searchableValues.push(project[key].toLowerCase());
          }
        });
        
        if (project.values) {
          project.values.forEach(v => {
            if (typeof v.value === 'string') {
              searchableValues.push(v.value.toLowerCase());
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
      
      // Filtre par favoris
      if (showFavorites) {
        const isFavorite = getFieldValueLegacy(project, 'favori', 'favorite', 'is_favorite');
        if (!isFavorite || isFavorite === 'false') return false;
      }
      
      return true;
    });
  }, [searchTerm, selectedTypes, showFavorites, getFieldValueLegacy, getProjectType]);

  // Données filtrées par les filtres legacy en premier
  const legacyFilteredProjects = useMemo(() => {
    return applyLegacyFilters(projects);
  }, [projects, applyLegacyFilters]);

  // Initialisation des filtres avancés avec les données pré-filtrées
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
  } = useAdvancedFilters(legacyFilteredProjects, ['project_name', 'project_description', 'project_type', 'project_subtype', 'contact_principal', 'contact_email']);

  // Données finales à afficher (soit filtres avancés, soit filtres legacy)
  const finalFilteredProjects = useMemo(() => {
    // Si des filtres avancés sont actifs, utiliser filteredData
    if (filters.length > 0) {
      return filteredData;
    }
    // Sinon, utiliser les données filtrées par les filtres legacy
    return legacyFilteredProjects;
  }, [filters.length, filteredData, legacyFilteredProjects]);

  // Assurer que les colonnes visibles sont initialisées par défaut
  useEffect(() => {
    if (visibleColumns.length === 0) {
      setVisibleColumns(['project_name', 'project_description', 'project_type', 'project_subtype', 'contact_principal', 'contact_email']);
    }
  }, [visibleColumns.length, setVisibleColumns]);

  // Charger les tables et identifier les IDs
  useEffect(() => {
    const loadTables = async () => {
      try {
        await fetchTables();
      } catch (err) {
        console.error('Erreur lors du chargement des tables:', err);
      }
    };
    loadTables();
  }, [fetchTables]);

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
        } catch (err) {
          console.error('Erreur lors du chargement des projets:', err);
        }
      }
    };
    loadProjects();
  }, [projectTableId, fetchRecords]);

  // Charger les contacts
  useEffect(() => {
    const loadContacts = async () => {
      if (contactTableId) {
        try {
          const contactData = await fetchRecords(contactTableId);
          setContacts(contactData || []);
        } catch (err) {
          console.error('Erreur lors du chargement des contacts:', err);
        }
      }
    };
    loadContacts();
  }, [contactTableId, fetchRecords]);

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
        } catch (err) {
          console.error('Erreur lors du chargement des types:', err);
        }
      }
    };
    loadTableNames();
  }, [tableNamesTableId, fetchRecords, getFieldValueLegacy]);

  // Charger les données des tables de détails
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
    };
    
    loadDetailsData();
  }, [tables, fetchRecords]);

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
    setShowFavorites(false);
    setCurrentPage(0);
    clearFilters();
    clearSorting();
  }, [clearFilters, clearSorting]);

  const getEmptyProjectsMessage = (filteredCount, totalCount) => {
    if (filteredCount === 0 && totalCount > 0) return 'Aucun projet ne correspond aux filtres';
    if (totalCount === 0) return 'Aucun projet trouvé - Ajoutez des projets via les actions rapides ci-dessus';
    return 'Aucun projet à afficher';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
        <div className="ml-4">
          <p>Chargement des tables...</p>
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
          <div className="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-3">
            <div className="card-body p-4">
              <div className="tabs tabs-boxed mb-4">
                <button 
                  className={`tab ${!showAdvancedFilters ? 'tab-active' : ''}`}
                  onClick={() => setShowAdvancedFilters(false)}
                >
                  Filtres
                </button>
                <button 
                  className={`tab ${showAdvancedFilters ? 'tab-active' : ''}`}
                  onClick={() => setShowAdvancedFilters(true)}
                >
                  Avancés
                </button>
              </div>

              {!showAdvancedFilters ? (
                <>
                  <h3 className="font-medium mb-3">Informations projet</h3>
                  
                  {/* Search */}
                  <div className="form-control mb-4">
                    <div className="input-group">
                      <input 
                        type="text" 
                        placeholder="Rechercher..." 
                        className="input input-bordered w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      {searchTerm && (
                        <button className="btn btn-square" onClick={() => setSearchTerm('')}>
                          <span className="text-lg">×</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter by project types */}
                  <div className="mb-4">
                    <span className="label-text">Types de projet ({projectTypes.length})</span>
                      <MultipleSelector 
                      options={projectTypes}
                      onChange={setSelectedTypes}
                    />
                  </div>

                  {/* Favorites */}
                  <div className="form-control mb-4">
                    <label className="label cursor-pointer">
                      <span className="label-text">Projets favoris uniquement</span>
                      <input 
                        type="checkbox" 
                        className="toggle"
                        checked={showFavorites}
                        onChange={(e) => setShowFavorites(e.target.checked)}
                      />
                    </label>
                  </div>

                  <button className="btn btn-outline w-full mb-4" onClick={resetFilters}>
                    <FiRefreshCw className="mr-2" />
                    Réinitialiser
                  </button>

                  <button 
                    className="btn btn-neutral w-full"
                    onClick={() => setShowAdvancedFilters(true)}
                  >
                    Filtres avancés
                  </button>
                </>
              ) : (
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
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              {/* Table Controls */}
              <div className="flex justify-between items-center mb-3">
                <div className="flex justify-between items-center gap-4">
                  <span className='w-full'>Lignes par page :</span>
                  <select 
                    className="select select-bordered select-sm"
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
                <div className="flex gap-2">
                  <PresetManager
                    presets={presets}
                    onLoadPreset={loadPreset}
                    onDeletePreset={deletePreset}
                    onLoadPresetsFromStorage={loadPresetsFromStorage}
                  />
                  <SortManager
                    sorting={sorting}
                    availableFields={availableFields}
                    onAddSort={addSort}
                    onRemoveSort={removeSort}
                    onClearSorting={clearSorting}
                  />
                  <ColumnSelector
                    availableColumns={availableColumns}
                    visibleColumns={visibleColumns}
                    onChange={setVisibleColumns}
                  />
                  
                  <button className="btn btn-sm btn-outline" onClick={resetFilters}>
                    <FiRefreshCw className="mr-2" />
                    Réinitialiser
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
                        const projectName = getFieldValueLegacy(project, 
                          'nom_projet', 'nom', 'name', 'title', 'titre', 'project_name', 'libelle'
                        ) || 'Projet sans nom';
                        
                        // Essayer de récupérer la description
                        const projectDescription = getFieldValueLegacy(project, 
                          'description', 'desc', 'details', 'resume', 'summary'
                        ) || 'Aucune description';
                        
                        // Essayer de récupérer le numéro
                        const projectNumber = getFieldValueLegacy(project, 
                          'numero_projet', 'number', 'num', 'numero', 'code', 'reference'
                        ) || 'N/A';
                        
                        // Essayer de récupérer le contact principal
                        const contactValue = getFieldValueLegacy(project, 
                          'contact_principal', 'contact_principal_id', 'contact_id', 'contact', 'client_id', 'responsable_id'
                        );
                        
                        // Gérer le contact : extraire le nom même si c'est "[Référence manquante: xxx]"
                        let contactInfo;
                        if (contactValue && contactValue !== 'Contact non défini') {
                          let cleanContactName = contactValue;
                          
                          // Si c'est une référence manquante, extraire le nom
                          if (contactValue.startsWith('[Référence manquante:') && contactValue.endsWith(']')) {
                            cleanContactName = contactValue.replace('[Référence manquante:', '').replace(']', '').trim();
                          }
                          
                          // Essayer de trouver le contact correspondant pour récupérer l'email
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
                        const typeId = getFieldValueLegacy(project, 
                          'type_projet', 'type_id', 'type', 'category_id', 'categorie_id'
                        );
                        
                        const projectType = getProjectType(typeId);
                        
                        const projectSubtype = getProjectSubtype(project, projectType);
                        
                        // Essayer de récupérer l'équipe
                        const equipe = getFieldValueLegacy(project, 
                          'equipe', 'team', 'groupe', 'department', 'service'
                        ) || 'Équipe inconnue';
                        
                        return (
                          <tr key={project.id} className="hover">
                            {visibleColumns.includes('project_name') && (
                              <td>
                                <div className="flex items-center gap-4">
                                  <div>
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
                              <div className="flex gap-2">
                                <Link 
                                  to={`/projects/${project.id}`} 
                                  className="btn btn-primary btn-sm"
                                >
                                  👁️ Voir détails
                                </Link>
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
                
              {/* Bouton Save to TSV */}
                <button className="btn btn-primary btn-sm">
                  Exporter en TSV
                </button>
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