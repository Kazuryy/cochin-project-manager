import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDynamicTables } from '../contexts/hooks/useDynamicTables';
import { DynamicTableProvider } from '../contexts/DynamicTableProvider';
import SelectWithAddOption from '../components/SelectWithAddOption';
import { typeService } from '../services/typeService';
import { useFormPersistence } from '../hooks/useFormPersistence';

function CreateProjectContent() {
  const navigate = useNavigate();
  const { tables, fetchTables, fetchRecords, createRecord, isLoading } = useDynamicTables();
  
  const [formData, setFormData] = useState({
    nom_projet: '',
    numero_projet: '',
    contact_principal: '',
    type_projet: '',
    equipe: '',
    description: '',
    // Champs conditionnels dynamiques
    conditionalFields: {}
  });
  
  // Hook de persistance du formulaire
  const { 
    restoreFormData, 
    clearSavedData, 
    hasSavedData 
  } = useFormPersistence(
    'createProject_formData', 
    formData, 
    setFormData,
    ['conditionalFields'] // Exclure les champs conditionnels de la persistance
  );
  
  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [contacts, setContacts] = useState([]);
  const [projectTypes, setProjectTypes] = useState([]);
  const [projectTableId, setProjectTableId] = useState(null);
  const [contactTableId, setContactTableId] = useState(null);
  const [tableNamesTableId, setTableNamesTableId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [showRestoreDataAlert, setShowRestoreDataAlert] = useState(false);
  
  // États pour les champs conditionnels
  const [conditionalFields, setConditionalFields] = useState([]);
  
  // États pour la modal d'ajout de contact personnalisée
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactData, setNewContactData] = useState({
    prenom: '',
    nom: '',
    email: '',
    equipe: ''
  });

  // Vérifier s'il y a des données à restaurer au chargement
  useEffect(() => {
    if (hasSavedData()) {
      setShowRestoreDataAlert(true);
    }
  }, [hasSavedData]);

  // Fonction pour restaurer les données
  const handleRestoreData = () => {
    const restored = restoreFormData();
    if (restored) {
      showToast('Données du formulaire restaurées', 'success');
    }
    setShowRestoreDataAlert(false);
  };

  // Fonction pour ignorer la restauration
  const handleIgnoreRestore = () => {
    clearSavedData();
    setShowRestoreDataAlert(false);
  };

  // Charger les tables et identifier les IDs
  useEffect(() => {
    const loadTables = async () => {
      fetchTables().then(() => {
        // Tables chargées
      }).catch(err => {
        console.error('Erreur lors du chargement des tables:', err);
      });
    };
    loadTables();
  }, [fetchTables]);

  // Trouver les IDs des tables nécessaires
  useEffect(() => {
    if (tables.length > 0) {
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
      
      const contactTable = tables.find(t => 
        t.name.toLowerCase().includes('contact') || 
        t.slug === 'contacts' ||
        t.slug === 'contact'
      );
      
      const tableNamesTable = tables.find(t => 
        t.name.toLowerCase().includes('tablename') || 
        t.slug === 'table_names' ||
        t.slug === 'tablenames' ||
        t.name.toLowerCase().includes('type')
      );
      
      if (projectTable) setProjectTableId(projectTable.id);
      if (contactTable) setContactTableId(contactTable.id);
      if (tableNamesTable) setTableNamesTableId(tableNamesTable.id);
    }
  }, [tables]);

  // Charger les contacts
  useEffect(() => {
    const loadContacts = async () => {
      if (contactTableId) {
        try {
          fetchRecords(contactTableId).then(contactData => {
            setContacts(contactData || []);
          }).catch(err => {
            console.error('Erreur lors du chargement des contacts:', err);
          });
        } catch (err) {
          console.error('Erreur lors du chargement des contacts:', err);
        }
      }
    };
    loadContacts();
  }, [contactTableId, fetchRecords]);

  // Charger les types de projets
  useEffect(() => {
    const loadProjectTypes = async () => {
      if (tableNamesTableId) {
        try {
          fetchRecords(tableNamesTableId).then(typeData => {
            setProjectTypes(typeData || []);
          }).catch(err => {
            console.error('Erreur lors du chargement des types:', err);
          });
        } catch (err) {
          console.error('Erreur lors du chargement des types:', err);
        }
      }
    };
    loadProjectTypes();
  }, [tableNamesTableId, fetchRecords]);

  // Fonction utilitaire pour extraire les valeurs des champs dynamiques
  const getFieldValue = useCallback((record, ...possibleFields) => {
    if (!record) return '';
    
    for (const field of possibleFields) {
      if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
        return record[field];
      }
    }
    
    if (record.values && Array.isArray(record.values)) {
      for (const field of possibleFields) {
        const valueField = record.values.find(v => v.field_slug === field);
        if (valueField?.value && valueField.value !== undefined && valueField.value !== null && valueField.value !== '') {
          return valueField.value;
        }
      }
    }
    
    return '';
  }, []);

  // Fonctions utilitaires pour réduire la complexité cognitive
  const findSelectedType = useCallback((typeId) => {
    return projectTypes.find(type => type.id.toString() === typeId.toString());
  }, [projectTypes]);

  const fetchTableData = useCallback(async (tableId) => {
    const response = await fetch(`/api/database/tables/${tableId}/`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Impossible de récupérer les champs de la table');
    return response.json();
  }, []);

  const findTypeField = useCallback((tableData) => {
    return tableData.fields?.find(field => 
      field.name === 'Type Projet' || field.name.toLowerCase().includes('type')
    );
  }, []);

  const fetchConditionalRules = useCallback(async (fieldId, typeName) => {
    const response = await fetch(`/api/conditional-fields/rules/by_field_and_value/?parent_field_id=${fieldId}&parent_value=${encodeURIComponent(typeName)}`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('API conditionnelle a retourné une erreur');
    return response.json();
  }, []);

  const transformRulesToFields = useCallback((rules) => {
    return rules.map(rule => ({
      name: rule.conditional_field_name,
      label: rule.conditional_field_label,
      required: rule.is_required,
      options: rule.options || []
    }));
  }, []);

  // Fonction améliorée pour recharger les champs conditionnels
  const reloadConditionalFields = useCallback(async () => {
    console.log('🔄 reloadConditionalFields appelée:', { 
      type_projet: formData.type_projet, 
      projectTypes_length: projectTypes.length, 
      projectTableId 
    });

    if (!formData.type_projet || !projectTypes.length || !projectTableId) {
      console.log('❌ Conditions non remplies pour charger les champs conditionnels');
      setConditionalFields([]);
      return;
    }

    try {
      const selectedType = findSelectedType(formData.type_projet);
      console.log('🎯 Type sélectionné:', selectedType);
      
      if (!selectedType) {
        console.log('❌ Aucun type sélectionné trouvé');
        setConditionalFields([]);
        return;
      }

      const typeName = getFieldValue(selectedType, 'nom', 'name', 'title', 'titre', 'label');
      console.log('📝 Nom du type:', typeName);
      
      const tableData = await fetchTableData(projectTableId);
      console.log('📊 Données de table:', tableData);
      
      const typeField = findTypeField(tableData);
      console.log('🏷️ Champ type trouvé:', typeField);
      
      if (!typeField) {
        console.warn('❌ Champ Type Projet non trouvé');
        setConditionalFields([]);
        return;
      }

      console.log('📡 Appel API règles conditionnelles:', { fieldId: typeField.id, typeName });
      const rules = await fetchConditionalRules(typeField.id, typeName);
      console.log('📋 Règles reçues:', rules);
      
      const fieldsConfig = transformRulesToFields(rules);
      console.log('⚙️ Configuration des champs:', fieldsConfig);
      
      setConditionalFields(fieldsConfig);

      // Réinitialiser les champs conditionnels quand on change de type
      setFormData(prev => ({
        ...prev,
        conditionalFields: {}
      }));

    } catch (err) {
      console.error('❌ Erreur lors du chargement des champs conditionnels:', err);
      setConditionalFields([]);
    }
  }, [formData.type_projet, projectTypes, projectTableId, findSelectedType, getFieldValue, fetchTableData, findTypeField, fetchConditionalRules, transformRulesToFields]);

  // Logique pour les champs conditionnels
  useEffect(() => {
    reloadConditionalFields();
  }, [reloadConditionalFields]);

  // Fonction pour ouvrir la modal contact personnalisée
  const openAddContactModal = () => {
    setNewContactData({
      prenom: '',
      nom: '',
      email: '',
      equipe: ''
    });
    setShowAddContactModal(true);
  };

  // Fonction pour ajouter un nouveau contact avec tous les champs
  const addNewContactWithDetails = async () => {
    if (!contactTableId) {
      showToast('Table des contacts non trouvée', 'error');
      return;
    }

    if (!newContactData.prenom.trim() || !newContactData.nom.trim()) {
      showToast('Le prénom et le nom sont requis', 'error');
      return;
    }

    try {
      const contactData = {
        prenom: newContactData.prenom.trim(),
        nom: newContactData.nom.trim(),
        email: newContactData.email.trim(),
        equipe: newContactData.equipe.trim()
      };

      createRecord(contactTableId, contactData).then(result => {
        if (result) {
          // Recharger les contacts
          fetchRecords(contactTableId).then(contactData => {
            setContacts(contactData || []);
            showToast(`Contact "${newContactData.prenom} ${newContactData.nom}" ajouté avec succès`, 'success');
            
            // Fermer la modal et réinitialiser
            setShowAddContactModal(false);
            setNewContactData({
              prenom: '',
              nom: '',
              email: '',
              equipe: ''
            });
          });
        }
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout du contact:', error);
      showToast('Erreur lors de l\'ajout du contact', 'error');
    }
  };

  // Fonction pour ajouter un nouveau type de projet avec le nouveau système
  const addNewProjectType = async (typeName, columns = []) => {
    try {
      const result = await typeService.createNewType(typeName, columns);
      
      if (result.success) {
        showToast(result.message, 'success');
        
        // Recharger les types depuis TableNames
        if (tableNamesTableId) {
          fetchRecords(tableNamesTableId).then(typeData => {
            setProjectTypes(typeData || []);
            
            // Auto-sélectionner le nouveau type créé
            if (result.data?.type_record) {
              setFormData(prev => ({
                ...prev,
                type_projet: result.data.type_record.id
              }));
              
              // Forcer le rechargement des champs conditionnels
              setTimeout(() => {
                // Les champs conditionnels se rechargeront automatiquement via useEffect
              }, 500);
            }
          });
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Erreur lors de la création du type:', error);
      showToast(error.message || 'Erreur lors de la création du type', 'error');
      throw error; // Re-lancer l'erreur pour que le modal puisse la gérer
    }
  };

  // Fonction pour ajouter une nouvelle option
  const addNewOption = async (fieldName, optionLabel) => {
    if (!optionLabel.trim()) {
      showToast('Veuillez remplir le libellé', 'error');
      return;
    }

    try {
      // Trouver la règle conditionnelle correspondante
      const currentField = conditionalFields.find(field => field.name === fieldName);
      if (!currentField) {
        showToast('Champ non trouvé', 'error');
        return;
      }

      // Récupérer l'ID de la règle depuis l'API (au lieu de hardcoder)
      if (!formData.type_projet || !projectTableId) {
        showToast('Sélectionnez d\'abord un type de projet', 'error');
        return;
      }

      // Trouver le type sélectionné
      const selectedType = projectTypes.find(type => type.id.toString() === formData.type_projet.toString());
      if (!selectedType) {
        showToast('Type de projet non trouvé', 'error');
        return;
      }

      const typeName = getFieldValue(selectedType, 'nom', 'name', 'title', 'titre', 'label');

      // Récupérer l'ID du champ "Type Projet"
      const tableResponse = await fetch(`/api/database/tables/${projectTableId}/`, {
        credentials: 'include',
      });

      if (!tableResponse.ok) {
        showToast('Erreur lors de la récupération des informations de table', 'error');
        return;
      }

      const tableData = await tableResponse.json();
      const typeField = tableData.fields?.find(field => 
        field.name === 'Type Projet' || field.name.toLowerCase().includes('type')
      );

      if (!typeField) {
        showToast('Champ Type Projet non trouvé', 'error');
        return;
      }

      // Récupérer les règles pour trouver le bon rule_id
      const rulesResponse = await fetch(`/api/conditional-fields/rules/by_field_and_value/?parent_field_id=${typeField.id}&parent_value=${encodeURIComponent(typeName)}`, {
        credentials: 'include',
      });

      if (!rulesResponse.ok) {
        showToast('Erreur lors de la récupération des règles', 'error');
        return;
      }

      const rules = await rulesResponse.json();
      const targetRule = rules.find(rule => rule.conditional_field_name === fieldName);

      if (!targetRule) {
        showToast('Règle non trouvée', 'error');
        return;
      }

      // Ajouter l'option via l'API avec le bon rule_id
      const response = await fetch('/api/conditional-fields/add-option/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          rule_id: targetRule.id, // Utiliser le vrai ID de la règle
          value: optionLabel,
          label: optionLabel
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Mettre à jour la liste locale
        setConditionalFields(prev => prev.map(field => 
          field.name === fieldName 
            ? { 
                ...field, 
                options: [...field.options, { 
                  value: result.option.value, 
                  label: result.option.label 
                }] 
              }
            : field
        ));
        
        showToast(`Option "${optionLabel}" ajoutée avec succès`, 'success');
      } else {
        const errorData = await response.json();
        showToast(errorData.error || 'Erreur lors de l\'ajout de l\'option', 'error');
      }
    } catch (err) {
      console.error('Erreur lors de l\'ajout de l\'option:', err);
      showToast('Erreur lors de l\'ajout de l\'option', 'error');
    }
  };

  // Générer un numéro de projet automatique
  const generateProjectNumber = () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PRJ-${year}${month}-${random}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Gérer les champs conditionnels séparément
    if (name.startsWith('conditional_')) {
      const fieldName = name.replace('conditional_', '');
      setFormData(prev => ({
        ...prev,
        conditionalFields: {
          ...prev.conditionalFields,
          [fieldName]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.nom_projet.trim()) {
      errors.nom_projet = 'Le nom du projet est requis';
    }
    
    if (!formData.numero_projet.trim()) {
      errors.numero_projet = 'Le numéro du projet est requis';
    }
    
    if (!formData.contact_principal) {
      errors.contact_principal = 'Le contact principal est requis';
    }
    
    if (!formData.type_projet) {
      errors.type_projet = 'Le type de projet est requis';
    }
    
    if (!formData.equipe.trim()) {
      errors.equipe = 'L\'équipe est requise';
    }
    
    if (!formData.description.trim()) {
      errors.description = 'La description est requise';
    }
    
    // Validation des champs conditionnels obligatoires
    conditionalFields.forEach(field => {
      if (field.required && !formData.conditionalFields[field.name]) {
        errors[`conditional_${field.name}`] = `${field.label} est requis`;
      }
    });
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    // Préparer les données pour la soumission
    const submitData = {
      nom_projet: formData.nom_projet,
      numero_projet: formData.numero_projet || generateProjectNumber(),
      contact_principal: formData.contact_principal,
      equipe: formData.equipe,
      description: formData.description,
      type_projet: formData.type_projet,
      // Ajouter les champs conditionnels
      ...formData.conditionalFields
    };

    createRecord(projectTableId, submitData).then(result => {
      if (result) {
        setSuccessMessage('Projet créé avec succès !');
        
        // Effacer les données sauvegardées après succès
        clearSavedData();
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    }).catch(error => {
      console.error('Erreur lors de la création du projet:', error);
      setFormErrors({ 
        submit: error.message || 'Erreur lors de la création du projet. Veuillez réessayer.' 
      });
    }).finally(() => {
      setIsSubmitting(false);
    });
  };

  const showToast = (message, type = 'info', duration = 2000) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), duration);
  };

  if (isLoading) {
    return (
      <div className="hero min-h-screen">
        <div className="hero-content text-center">
          <div>
            <span className="loading loading-spinner loading-lg"></span>
            <p className="py-6">Chargement des données...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="container mx-auto p-6 max-w-2xl">
        
        {/* Alert pour restaurer les données */}
        {showRestoreDataAlert && (
          <div className="alert alert-info mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <h3 className="font-bold">Données sauvegardées trouvées</h3>
              <div className="text-xs">Voulez-vous restaurer les données précédemment saisies ?</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary btn-xs" onClick={handleRestoreData}>
                Restaurer
              </button>
              <button className="btn btn-ghost btn-xs" onClick={handleIgnoreRestore}>
                Ignorer
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="breadcrumbs text-sm mb-4">
            <ul>
              <li><Link to="/" className="link link-hover">Accueil</Link></li>
              <li><Link to="/dashboard" className="link link-hover">Projets</Link></li>
              <li>Nouveau projet</li>
            </ul>
          </div>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2">Nouveau Projet</h1>
            <p className="text-base-content/70">Créez un nouveau projet en remplissant le formulaire ci-dessous</p>
          </div>
        </div>

        {/* Messages d'état */}
        {successMessage && (
          <div className="alert alert-success mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {formErrors.submit && (
          <div className="alert alert-error mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formErrors.submit}</span>
          </div>
        )}

        {/* Formulaire */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Section: Informations générales */}
              <div>
                <h2 className="card-title text-2xl mb-6 flex items-center gap-2">
                  📋 Informations générales
                </h2>
                
                {/* Nom du projet */}
                <div className="form-control w-full mb-4">
                  <label className="label" htmlFor="nom_projet">
                    <span className="label-text font-medium">Nom du projet <span className="text-error">*</span></span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M12 4.354a4 4 0 110-5.292M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      id="nom_projet"
                      name="nom_projet"
                      value={formData.nom_projet}
                      onChange={handleChange}
                      placeholder="Saisir le nom du projet"
                      className={`input input-bordered w-full pl-10 ${formErrors.nom_projet ? 'input-error' : ''}`}
                      required
                    />
                  </div>
                  {formErrors.nom_projet && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formErrors.nom_projet}</span>
                    </label>
                  )}
                </div>

                {/* Numéro du projet */}
                <div className="form-control w-full mb-4">
                  <label className="label" htmlFor="numero_projet">
                    <span className="label-text font-medium">Numéro du projet <span className="text-error">*</span></span>
                  </label>
                  <div className="join w-full">
                    <input
                      type="text"
                      id="numero_projet"
                      name="numero_projet"
                      value={formData.numero_projet}
                      onChange={handleChange}
                      placeholder="PRJ-202401-001"
                      className={`input input-bordered join-item flex-1 ${formErrors.numero_projet ? 'input-error' : ''}`}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline join-item"
                      onClick={() => {
                        const num = generateProjectNumber();
                        setFormData(prev => ({ ...prev, numero_projet: num }));
                        showToast('Numéro généré : ' + num, 'success');
                      }}
                    >
                      Générer
                    </button>
                  </div>
                  {formErrors.numero_projet && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formErrors.numero_projet}</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="divider"></div>

              {/* Section: Assignation */}
              <div>
                <h2 className="card-title text-2xl mb-6 flex items-center gap-2">
                  👥 Assignation
                </h2>

                {/* Contact principal */}
                <div className="form-control w-full mb-4">
                  <label className="label" htmlFor="contact_principal">
                    <span className="label-text font-medium">Contact principal <span className="text-error">*</span></span>
                  </label>
                  
                  <div className="join w-full">
                    <select
                      id="contact_principal"
                      name="contact_principal"
                      value={formData.contact_principal}
                      onChange={handleChange}
                      className={`select select-bordered join-item flex-1 ${formErrors.contact_principal ? 'select-error' : ''}`}
                      required={true}
                      disabled={isLoading}
                    >
                      <option value="">Choisir un contact</option>
                      {isLoading ? (
                        <option disabled>Chargement...</option>
                      ) : (
                        contacts.map((contact) => {
                          const prenom = getFieldValue(contact, 'prenom', 'first_name', 'firstname', 'fname');
                          const nom = getFieldValue(contact, 'nom', 'last_name', 'lastname', 'name');
                          const email = getFieldValue(contact, 'email', 'mail', 'e_mail', 'courriel');
                          
                          // Construire le nom d'affichage avec gestion des cas vides
                          let displayName = '';
                          if (prenom && nom) {
                            displayName = `${prenom} ${nom.toUpperCase()}`;
                          } else if (nom) {
                            displayName = nom.toUpperCase();
                          } else if (prenom) {
                            displayName = prenom;
                          } else {
                            // Chercher d'autres champs possibles
                            const fullName = getFieldValue(contact, 'full_name', 'nom_complet', 'display_name');
                            displayName = fullName || `Contact #${contact.id}`;
                          }
                          
                          return (
                            <option key={contact.id} value={contact.id}>
                              {displayName + (email ? ` (${email})` : '')}
                            </option>
                          );
                        })
                      )}
                    </select>
                    
                    <button
                      type="button"
                      className="btn btn-outline join-item"
                      onClick={openAddContactModal}
                      title="Ajouter un nouveau contact"
                      disabled={isLoading}
                    >
                      ➕
                    </button>
                  </div>

                  {!isLoading && contacts.length === 0 && (
                    <div className="mt-2">
                      <Link to="/admin/database/tables" className="link link-primary text-xs">Créer un contact</Link>
                    </div>
                  )}
                  
                  {formErrors.contact_principal && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formErrors.contact_principal}</span>
                    </label>
                  )}
                </div>

                {/* Équipe */}
                <div className="form-control w-full mb-4">
                  <label className="label" htmlFor="equipe">
                    <span className="label-text font-medium">Équipe <span className="text-error">*</span></span>
                  </label>
                  <input
                    type="text"
                    id="equipe"
                    name="equipe"
                    value={formData.equipe}
                    onChange={handleChange}
                    placeholder="Ex: Équipe GenomiC"
                    className={`input input-bordered w-full ${formErrors.equipe ? 'input-error' : ''}`}
                    required
                  />
                  {formErrors.equipe && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formErrors.equipe}</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="divider"></div>

              {/* Section: Classification */}
              <div>
                <h2 className="card-title text-2xl mb-6 flex items-center gap-2">
                  🏷️ Classification
                </h2>

                {/* Type de projet */}
                <div className="form-control w-full mb-4">
                  <label className="label" htmlFor="type_projet">
                    <span className="label-text font-medium">Type de projet <span className="text-error">*</span></span>
                  </label>
                  <SelectWithAddOption
                    id="type_projet"
                    name="type_projet"
                    value={formData.type_projet}
                    onChange={handleChange}
                    options={projectTypes.map(type => {
                      const typeName = getFieldValue(type, 'nom', 'name', 'title', 'titre', 'label') || `Type #${type.id}`;
                      
                      return {
                        value: type.id,
                        label: `${typeName}`
                      };
                    })}
                    placeholder="Sélectionner un type"
                    required={true}
                    className={formErrors.type_projet ? 'select-error' : ''}
                    isLoading={isLoading}
                    isTypeMode={true}
                    onCreateType={addNewProjectType}
                    addButtonTitle="Créer un nouveau type de projet complet"
                    emptyMessage={<Link to="/admin/database/tables" className="link link-primary text-xs">Créer un type de projet</Link>}
                  />
                  {formErrors.type_projet && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formErrors.type_projet}</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Section: Champs conditionnels */}
              {conditionalFields.length > 0 && (
                <>
                  <div className="divider"></div>
                  <div>
                    <h2 className="card-title text-2xl mb-6 flex items-center gap-2">
                      ⚙️ Paramètres spécifiques
                    </h2>
                    
                    {conditionalFields.map((field) => (
                      <div key={field.name} className="form-control w-full mb-4">
                        <label className="label" htmlFor={`conditional_${field.name}`}>
                          <span className="label-text font-medium">
                            {field.label} 
                            {field.required && <span className="text-error">*</span>}
                          </span>
                        </label>
                        
                        <SelectWithAddOption
                          id={`conditional_${field.name}`}
                          name={`conditional_${field.name}`}
                          value={formData.conditionalFields[field.name] || ''}
                          onChange={handleChange}
                          options={field.options.map(option => ({
                            value: option.value,
                            label: option.label
                          }))}
                          placeholder="Sélectionner..."
                          required={field.required}
                          className={formErrors[`conditional_${field.name}`] ? 'select-error' : ''}
                          onAddOption={(optionLabel) => addNewOption(field.name, optionLabel)}
                          addButtonTitle="Ajouter une nouvelle option"
                        />
                        
                        {formErrors[`conditional_${field.name}`] && (
                          <label className="label">
                            <span className="label-text-alt text-error">
                              {formErrors[`conditional_${field.name}`]}
                            </span>
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="divider"></div>

              {/* Section: Description */}
              <div>
                <h2 className="card-title text-2xl mb-6 flex items-center gap-2">
                  📝 Description
                </h2>

                {/* Description */}
                <div className="form-control w-full mb-4">
                  <label className="label" htmlFor="description">
                    <span className="label-text font-medium">Description du projet <span className="text-error">*</span></span>
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Ex : Étude sur la mutation X dans la cohorte Y, objectifs, contexte, enjeux..."
                    className={`textarea textarea-bordered h-32 ${formErrors.description ? 'textarea-error' : ''}`}
                    required
                  />
                  {formErrors.description && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formErrors.description}</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="card-actions justify-between pt-6">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Annuler
                </button>
                
                <button
                  type="submit"
                  className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
                  disabled={isSubmitting || !projectTableId}
                >
                  {isSubmitting ? 'Création...' : 'Créer le projet'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Debug info */}
        <div className="collapse collapse-arrow bg-base-300 mt-6">
          <input type="checkbox" />
          <div className="collapse-title text-sm font-medium">
            Informations système
          </div>
          <div className="collapse-content">
            <div className="text-xs space-y-1">
              <div>Tables trouvées: {tables.length}</div>
              <div>ID table projets: {projectTableId || 'Non trouvé'}</div>
              <div>ID table contacts: {contactTableId || 'Non trouvé'}</div>
              <div>ID table types: {tableNamesTableId || 'Non trouvé'}</div>
              <div>Contacts chargés: {contacts.length}</div>
              <div>Types chargés: {projectTypes.length}</div>
            </div>
          </div>
        </div>

        {toast && (
          <div className={`toast toast-${toast.type} fixed top-4 right-4 z-50`}>
            <div>{toast.message}</div>
          </div>
        )}

        {/* Modal personnalisée pour ajouter un contact */}
        {showAddContactModal && (
          <div className="modal modal-open" role="dialog" aria-labelledby="add-contact-title" aria-modal="true">
            <div className="modal-box">
              <h3 id="add-contact-title" className="font-bold text-lg">
                👤 Ajouter un nouveau contact
              </h3>
              <p className="py-4">
                <span className="text-sm text-base-content/70">
                  Ce contact sera ajouté directement dans votre table Contacts
                </span>
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Prénom */}
                <div className="form-control w-full">
                  <label className="label" htmlFor="new_contact_prenom">
                    <span className="label-text font-medium">Prénom <span className="text-error">*</span></span>
                  </label>
                  <input
                    type="text"
                    id="new_contact_prenom"
                    value={newContactData.prenom}
                    onChange={(e) => setNewContactData(prev => ({ ...prev, prenom: e.target.value }))}
                    placeholder="Ex: Jean"
                    className="input input-bordered w-full"
                    autoFocus
                  />
                </div>

                {/* Nom */}
                <div className="form-control w-full">
                  <label className="label" htmlFor="new_contact_nom">
                    <span className="label-text font-medium">Nom <span className="text-error">*</span></span>
                  </label>
                  <input
                    type="text"
                    id="new_contact_nom"
                    value={newContactData.nom}
                    onChange={(e) => setNewContactData(prev => ({ ...prev, nom: e.target.value }))}
                    placeholder="Ex: Dupont"
                    className="input input-bordered w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Email */}
                <div className="form-control w-full">
                  <label className="label" htmlFor="new_contact_email">
                    <span className="label-text font-medium">Email</span>
                  </label>
                  <input
                    type="email"
                    id="new_contact_email"
                    value={newContactData.email}
                    onChange={(e) => setNewContactData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Ex: jean.dupont@email.com"
                    className="input input-bordered w-full"
                  />
                </div>

                {/* Équipe */}
                <div className="form-control w-full">
                  <label className="label" htmlFor="new_contact_equipe">
                    <span className="label-text font-medium">Équipe</span>
                  </label>
                  <input
                    type="text"
                    id="new_contact_equipe"
                    value={newContactData.equipe}
                    onChange={(e) => setNewContactData(prev => ({ ...prev, equipe: e.target.value }))}
                    placeholder="Ex: Équipe GenomiC"
                    className="input input-bordered w-full"
                  />
                </div>
              </div>
              
              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowAddContactModal(false);
                    setNewContactData({
                      prenom: '',
                      nom: '',
                      email: '',
                      equipe: ''
                    });
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={addNewContactWithDetails}
                  disabled={!newContactData.prenom.trim() || !newContactData.nom.trim()}
                >
                  Ajouter le contact
                </button>
              </div>
            </div>
            
            {/* Overlay pour fermer la modal */}
            <div 
              className="modal-backdrop" 
              onClick={() => setShowAddContactModal(false)}
              role="button"
              tabIndex="0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowAddContactModal(false);
                }
              }}
              aria-label="Fermer la modal"
            ></div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateProject() {
  return (
    <DynamicTableProvider>
      <CreateProjectContent />
    </DynamicTableProvider>
  );
}

export default CreateProject;