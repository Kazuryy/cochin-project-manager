// frontend/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { FiFilter, FiHeart, FiRefreshCw, FiUser, FiCalendar, FiPlus, FiDatabase, FiEye } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { useDynamicTables } from '../contexts/hooks/useDynamicTables';
import MultipleSelector from '../components/filters/MultiSelector';
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
  const [showFieldExplorer, setShowFieldExplorer] = useState(false);
  
  // Debug states
  const [debugInfo, setDebugInfo] = useState({
    tablesLoaded: false,
    tablesFound: {},
    projectsLoaded: false,
    contactsLoaded: false,
    tableNamesLoaded: false,
    rawData: {},
    fieldMappings: {}
  });

  // Tables IDs
  const [projectTableId, setProjectTableId] = useState(null);
  const [contactTableId, setContactTableId] = useState(null);
  const [tableNamesTableId, setTableNamesTableId] = useState(null);

  // DEBUG: Fonction pour logger les informations de debug
  const updateDebugInfo = (key, value) => {
    setDebugInfo(prev => ({
      ...prev,
      [key]: value
    }));
    console.log(`DEBUG [${key}]:`, value);
  };

  // Charger les tables et identifier les IDs
  useEffect(() => {
    const loadTables = async () => {
      console.log('DEBUG: Début du chargement des tables...');
      try {
        await fetchTables();
      } catch (err) {
        console.error('DEBUG: Erreur lors du chargement des tables:', err);
      }
    };
    loadTables();
  }, [fetchTables]);

  // DEBUG: Analyser les tables chargées
  useEffect(() => {
    console.log('DEBUG: Tables reçues:', tables);
    updateDebugInfo('tablesLoaded', tables.length > 0);
    updateDebugInfo('rawData', { ...debugInfo.rawData, allTables: tables });

    if (tables.length > 0) {
      console.log('DEBUG: Liste des tables disponibles:');
      tables.forEach((table, index) => {
        console.log(`  ${index + 1}. ID: ${table.id}, Name: "${table.name}", Slug: "${table.slug}"`);
      });
    }
  }, [tables]);

  // Trouver les IDs des tables nécessaires
  useEffect(() => {
    if (tables.length > 0) {
      console.log('=== DEBUG DASHBOARD - Tables disponibles ===');
      console.log('Nombre de tables:', tables.length);
      console.log('Tables:', tables.map(t => ({ id: t.id, name: t.name, slug: t.slug })));
      
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
      
      console.log('Table Projet trouvée:', projectTable);
      console.log('Table Contacts trouvée:', contactTable);
      console.log('Table TableNames trouvée:', tableNamesTable);
      
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
          console.log('=== DEBUG DASHBOARD - Chargement des projets ===');
          console.log('ID de la table projet:', projectTableId);
          const projectData = await fetchRecords(projectTableId);
          console.log('Données projets reçues:', projectData);
          console.log('Nombre de projets:', projectData?.length || 0);
          if (projectData && projectData.length > 0) {
            console.log('Premier projet:', projectData[0]);
            console.log('Structure values du premier projet:', projectData[0].values);
          }
          setProjects(projectData || []);
        } catch (err) {
          console.error('Erreur lors du chargement des projets:', err);
        }
      } else {
        console.log('=== DEBUG DASHBOARD - Pas d\'ID de table projet ===');
      }
    };
    loadProjects();
  }, [projectTableId, fetchRecords]);

  // Charger les contacts
  useEffect(() => {
    const loadContacts = async () => {
      if (contactTableId) {
        try {
          console.log('=== DEBUG DASHBOARD - Chargement des contacts ===');
          console.log('ID de la table contact:', contactTableId);
          const contactData = await fetchRecords(contactTableId);
          console.log('Données contacts reçues:', contactData);
          console.log('Nombre de contacts:', contactData?.length || 0);
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
          console.log('=== DEBUG DASHBOARD - Chargement des types ===');
          console.log('ID de la table types:', tableNamesTableId);
          const tableNamesData = await fetchRecords(tableNamesTableId);
          console.log('Données types reçues:', tableNamesData);
          console.log('Nombre de types:', tableNamesData?.length || 0);
          setTableNames(tableNamesData || []);
          
          // Extraire les types uniques pour les filtres
          const types = tableNamesData?.map(item => 
            getFieldValue(item, 'nom') || 'Type inconnu'
          ).filter(Boolean) || [];
          console.log('Types extraits pour filtres:', types);
          setProjectTypes([...new Set(types)]);
        } catch (err) {
          console.error('Erreur lors du chargement des types:', err);
        }
      }
    };
    loadTableNames();
  }, [tableNamesTableId, fetchRecords]);

  // Fonction améliorée pour extraire les valeurs
  const getFieldValue = (record, ...possibleFields) => {
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
  };

  // Fonction améliorée pour obtenir les informations de contact
  const getContactInfo = (contactId) => {
    console.log('DEBUG getContactInfo: contactId reçu:', contactId, 'Type:', typeof contactId);
    console.log('DEBUG getContactInfo: Nombre de contacts disponibles:', contacts.length);
    
    if (!contactId || !contacts.length) {
      console.log('DEBUG getContactInfo: contactId vide ou pas de contacts');
      return { nom: 'Contact inconnu', email: '' };
    }
    
    // Essayer de trouver le contact avec différentes méthodes de comparaison
    let contact = contacts.find(c => c.id === contactId);
    if (!contact) {
      contact = contacts.find(c => c.id.toString() === contactId.toString());
    }
    if (!contact) {
      contact = contacts.find(c => parseInt(c.id) === parseInt(contactId));
    }
    
    console.log('DEBUG getContactInfo: Contact trouvé:', contact);
    
    if (!contact) {
      console.log('DEBUG getContactInfo: Contact non trouvé, contacts disponibles:');
      contacts.forEach(c => {
        console.log(`  - Contact ID: ${c.id} (${typeof c.id})`);
      });
      return { nom: `Contact #${contactId} (non trouvé)`, email: '' };
    }
    
    // Essayer tous les champs possibles pour le nom avec debug
    console.log('DEBUG getContactInfo: Structure du contact trouvé:', contact);
    
    const possibleNameFields = ['nom', 'last_name', 'lastname', 'name', 'nom_complet', 'full_name'];
    const possibleFirstNameFields = ['prenom', 'first_name', 'firstname', 'fname'];
    const possibleEmailFields = ['email', 'mail', 'e_mail', 'courriel'];
    
    let nom = '';
    let prenom = '';
    let email = '';
    
    // Chercher le nom
    for (const field of possibleNameFields) {
      const value = getFieldValue(contact, field);
      if (value) {
        nom = value;
        console.log(`DEBUG getContactInfo: Nom trouvé via champ '${field}':`, value);
        break;
      }
    }
    
    // Chercher le prénom
    for (const field of possibleFirstNameFields) {
      const value = getFieldValue(contact, field);
      if (value) {
        prenom = value;
        console.log(`DEBUG getContactInfo: Prénom trouvé via champ '${field}':`, value);
        break;
      }
    }
    
    // Chercher l'email
    for (const field of possibleEmailFields) {
      const value = getFieldValue(contact, field);
      if (value) {
        email = value;
        console.log(`DEBUG getContactInfo: Email trouvé via champ '${field}':`, value);
        break;
      }
    }
    
    let displayName = `${prenom} ${nom.toUpperCase()}`.trim();
    
    if (!displayName) {
      // Si aucun nom trouvé, afficher tous les champs disponibles du contact
      console.log('DEBUG getContactInfo: Aucun nom trouvé, analyse complète du contact...');
      const availableData = [];
      
      // Champs directs
      Object.keys(contact).forEach(key => {
        if (contact[key] && key !== 'id' && key !== 'values' && typeof contact[key] === 'string') {
          availableData.push(`${key}: ${contact[key]}`);
          console.log(`DEBUG getContactInfo: Champ direct '${key}':`, contact[key]);
        }
      });
      
      // Champs dans values
      if (contact.values && Array.isArray(contact.values)) {
        contact.values.forEach(v => {
          if (v.value && typeof v.value === 'string') {
            availableData.push(`${v.field_slug}: ${v.value}`);
            console.log(`DEBUG getContactInfo: Champ value '${v.field_slug}':`, v.value);
          }
        });
      }
      
      displayName = availableData.length > 0 ? availableData.slice(0, 2).join(', ') : `Contact #${contactId}`;
      console.log('DEBUG getContactInfo: displayName généré:', displayName);
    }
    
    const result = {
      nom: displayName || `Contact #${contactId}`,
      email: email || ''
    };
    
    console.log('DEBUG getContactInfo: Résultat final:', result);
    return result;
  };

  // Fonction améliorée pour obtenir le type de projet
  const getProjectType = (typeId) => {
    if (!typeId || !tableNames.length) {
      return 'Type inconnu';
    }
    
    const typeRecord = tableNames.find(t => t.id.toString() === typeId.toString());
    if (!typeRecord) {
      return `${typeId}`;
    }
    
    // Essayer tous les champs possibles
    const typeName = getFieldValue(typeRecord, 'nom', 'name', 'title', 'titre', 'label', 'type_name');
    
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
  };

  // Fonction pour filtrer les projets
  const getFilteredProjects = () => {
    if (!projects.length) return [];
    
    return projects.filter((project) => {
      // Filtre par recherche - essayer tous les champs texte possibles
      if (searchTerm) {
        const searchableValues = [];
        
        // Champs directs
        Object.keys(project).forEach(key => {
          if (typeof project[key] === 'string') {
            searchableValues.push(project[key].toLowerCase());
          }
        });
        
        // Champs dans values
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
        const projectTypeId = getFieldValue(project, 'type_projet', 'type_id', 'type', 'category_id');
        const projectTypeName = getProjectType(projectTypeId);
        
        if (!selectedTypes.some(selectedType => projectTypeName.includes(selectedType))) {
          return false;
        }
      }
      
      return true;
    });
  };

  // Pagination
  const filteredProjects = getFilteredProjects();
  const totalPages = Math.ceil(filteredProjects.length / rowsPerPage);
  const startIndex = currentPage * rowsPerPage;
  const paginatedProjects = filteredProjects.slice(startIndex, startIndex + rowsPerPage);

  // Fonctions utilitaires pour les dates
  const formatDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Date invalide';
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return 'Date inconnue';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return "Aujourd'hui";
      if (diffDays === 1) return "Il y a 1 jour";
      if (diffDays < 30) return `Il y a ${diffDays} jours`;
      if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `Il y a ${months} mois`;
      }
      const years = Math.floor(diffDays / 365);
      return `Il y a ${years} an${years > 1 ? 's' : ''}`;
    } catch {
      return 'Date invalide';
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedTypes([]);
    setShowFavorites(false);
    setCurrentPage(0);
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
      {/* DEBUG PANEL - Amélioré */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <h3 className="font-bold text-yellow-800 mb-2">🐛 Informations de Debug</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p><strong>Tables chargées:</strong> {debugInfo.tablesLoaded ? '✅' : '❌'}</p>
            <p><strong>Tables trouvées:</strong></p>
            <ul className="ml-4">
              <li>Projet: {debugInfo.tablesFound?.project ? `✅ ${debugInfo.tablesFound.project.name} (ID: ${debugInfo.tablesFound.project.id})` : '❌'}</li>
              <li>Contact: {debugInfo.tablesFound?.contact ? `✅ ${debugInfo.tablesFound.contact.name} (ID: ${debugInfo.tablesFound.contact.id})` : '❌'}</li>
              <li>TableNames: {debugInfo.tablesFound?.tableNames ? `✅ ${debugInfo.tablesFound.tableNames.name} (ID: ${debugInfo.tablesFound.tableNames.id})` : '❌'}</li>
            </ul>
          </div>
          <div>
            <p><strong>Données chargées:</strong></p>
            <ul className="ml-4">
              <li>Projets: {debugInfo.projectsLoaded ? `✅ (${projects.length})` : '❌'}</li>
              <li>Contacts: {debugInfo.contactsLoaded ? `✅ (${contacts.length})` : '❌'}</li>
              <li>Types: {debugInfo.tableNamesLoaded ? `✅ (${tableNames.length})` : '❌'}</li>
            </ul>
            <p><strong>Projets filtrés:</strong> {filteredProjects.length}</p>
            <p><strong>Projets paginés:</strong> {paginatedProjects.length}</p>
          </div>
        </div>
        
        {/* Explorateur de champs */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-blue-800">🔍 Explorateur de Champs</h4>
            <button 
              onClick={() => setShowFieldExplorer(!showFieldExplorer)}
              className="btn btn-xs btn-outline"
            >
              <FiEye className="mr-1" />
              {showFieldExplorer ? 'Masquer' : 'Afficher'}
            </button>
          </div>
          
          {showFieldExplorer && debugInfo.fieldMappings.fullProjectStructure && (
            <div className="space-y-3">
              {/* Structure du projet */}
              <div>
                <h5 className="font-medium text-blue-700">Structure du Premier Projet:</h5>
                <div className="bg-white p-2 rounded text-xs overflow-auto max-h-40">
                  <pre>{JSON.stringify(debugInfo.fieldMappings.fullProjectStructure, null, 2)}</pre>
                </div>
              </div>
              
              {/* Structure du contact */}
              {debugInfo.fieldMappings.fullContactStructure && (
                <div>
                  <h5 className="font-medium text-blue-700">Structure du Premier Contact:</h5>
                  <div className="bg-white p-2 rounded text-xs overflow-auto max-h-40">
                    <pre>{JSON.stringify(debugInfo.fieldMappings.fullContactStructure, null, 2)}</pre>
                  </div>
                </div>
              )}
              
              {/* Structure des types */}
              {debugInfo.fieldMappings.fullTableNameStructure && (
                <div>
                  <h5 className="font-medium text-blue-700">Structure du Premier Type:</h5>
                  <div className="bg-white p-2 rounded text-xs overflow-auto max-h-40">
                    <pre>{JSON.stringify(debugInfo.fieldMappings.fullTableNameStructure, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Actions rapides */}
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <h4 className="font-semibold text-green-800 mb-2">🚀 Actions Rapides</h4>
          <div className="flex flex-wrap gap-2">
            {debugInfo.tablesFound?.project && (
              <Link 
                to={`/admin/database/tables/${debugInfo.tablesFound.project.id}/records/create`}
                className="btn btn-sm btn-primary"
              >
                <FiPlus className="mr-1" />
                Ajouter un projet
              </Link>
            )}
            {debugInfo.tablesFound?.tableNames && (
              <Link 
                to={`/admin/database/tables/${debugInfo.tablesFound.tableNames.id}/records/create`}
                className="btn btn-sm btn-secondary"
              >
                <FiPlus className="mr-1" />
                Ajouter un type
              </Link>
            )}
            {debugInfo.tablesFound?.project && (
              <Link 
                to={`/admin/database/tables/${debugInfo.tablesFound.project.id}/records`}
                className="btn btn-sm btn-outline"
              >
                <FiDatabase className="mr-1" />
                Voir les projets
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="text-sm breadcrumbs mb-4">
        <ul>
          <li><a href="/">Accueil</a></li>
          <li>Projets</li>
        </ul>
      </div>

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
                <a className="tab tab-active">Filtres</a>
                <a className="tab">Mes modèles</a>
              </div>

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

              <button className="btn btn-neutral w-full">
                Créer un nouveau modèle de recherche
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              {/* Table Controls */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span>Lignes par page :</span>
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
                  <button className="btn btn-sm btn-outline">
                    <FiHeart className="mr-2" />
                    Favoris uniquement
                  </button>
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
                      <th>Projet</th>
                      <th>Contact Principal</th>
                      <th>Dernière Activité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProjects.length > 0 ? (
                      paginatedProjects.map((project) => {
                        // Essayer de récupérer le nom du projet avec plusieurs variations
                        const projectName = getFieldValue(project, 
                          'nom_projet', 'nom', 'name', 'title', 'titre', 'project_name', 'libelle'
                        ) || 'Projet sans nom';
                        
                        // Essayer de récupérer la description
                        const projectDescription = getFieldValue(project, 
                          'description', 'desc', 'details', 'resume', 'summary'
                        ) || 'Aucune description';
                        
                        // Essayer de récupérer le numéro
                        const projectNumber = getFieldValue(project, 
                          'numero_projet', 'number', 'num', 'numero', 'code', 'reference'
                        ) || 'N/A';
                        
                        // Essayer de récupérer l'ID du contact avec debug détaillé
                        const contactIdFields = [
                          'contact_principal_id', 'contact_id', 'contact', 'client_id', 'responsable_id',
                          'contact_principal', 'id_contact', 'contactid', 'principal_contact'
                        ];
                        
                        let contactId = null;
                        for (const field of contactIdFields) {
                          const value = getFieldValue(project, field);
                          if (value) {
                            contactId = value;
                            console.log(`DEBUG: Contact ID trouvé via champ '${field}':`, value, 'Type:', typeof value);
                            break;
                          }
                        }
                        
                        if (!contactId) {
                          console.log('DEBUG: Aucun contact ID trouvé, champs disponibles dans le projet:');
                          Object.keys(project).forEach(key => {
                            if (project[key] !== null && project[key] !== '') {
                              console.log(`  - ${key}: ${project[key]} (${typeof project[key]})`);
                            }
                          });
                          if (project.values) {
                            project.values.forEach(v => {
                              if (v.value !== null && v.value !== '') {
                                console.log(`  - ${v.field_slug}: ${v.value} (${typeof v.value})`);
                              }
                            });
                          }
                        }
                        
                        // Essayer de récupérer l'ID du type
                        const typeId = getFieldValue(project, 
                          'type_projet', 'type_id', 'type', 'category_id', 'categorie_id'
                        );
                        
                        // Obtenir les informations dérivées
                        const contactInfo = getContactInfo(contactId);
                        const projectType = getProjectType(typeId);
                        
                        // Essayer de récupérer l'équipe
                        const equipe = getFieldValue(project, 
                          'equipe', 'team', 'groupe', 'department', 'service'
                        ) || 'Équipe inconnue';
                        
                        // DEBUG: Afficher toutes les données du projet pour ce projet
                        console.log(`DEBUG: Projet ${project.id} - Données complètes:`, {
                          projectName,
                          projectDescription,
                          projectNumber,
                          contactId,
                          typeId,
                          contactInfo,
                          projectType,
                          equipe,
                          fullProject: project
                        });
                        
                        return (
                          <tr key={project.id}>
                            <td>
                              <div className="flex items-center gap-4">
                                <div>
                                  <div className="font-bold">{projectName}</div>
                                  <div className="text-sm opacity-70 max-w-md">
                                    {projectDescription.length > 100 
                                      ? `${projectDescription.substring(0, 100)}...` 
                                      : projectDescription
                                    }
                                  </div>
                                  <div className="text-xs opacity-50 mt-1">
                                    N° {projectNumber}
                                  </div>
                                  <div className="mt-2">
                                    <div className="badge badge-primary mr-2">{projectType}</div>
                                    <div className="badge badge-outline mr-2">{equipe}</div>
                                  </div>
                                  

                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <FiUser className="text-sm" />
                                  <span className="font-medium">{contactInfo.nom}</span>
                                </div>
                                {contactInfo.email && (
                                  <div className="text-sm opacity-70">{contactInfo.email}</div>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <FiCalendar className="text-sm" />
                                <div className="flex flex-col">
                                  <span className="text-sm">{getTimeAgo(project.created_at)}</span>
                                  <span className="text-xs opacity-70">
                                    Créé le {formatDate(project.created_at)}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="3" className="text-center py-8">
                          {filteredProjects.length === 0 && projects.length > 0 
                            ? 'Aucun projet ne correspond aux filtres'
                            : projects.length === 0 
                              ? 'Aucun projet trouvé - Ajoutez des projets via les actions rapides ci-dessus'
                              : 'Aucun projet à afficher'
                          }
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
                  Affichage de {startIndex + 1} à {Math.min(startIndex + rowsPerPage, filteredProjects.length)} sur {filteredProjects.length} projet(s)
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