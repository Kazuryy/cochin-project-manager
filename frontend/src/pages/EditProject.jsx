import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDynamicTables } from '../contexts/hooks/useDynamicTables';
import { DynamicTableProvider } from '../contexts/DynamicTableProvider';
import SelectWithAddOption from '../components/SelectWithAddOption';
import { typeService } from '../services/typeService';
import api from '../services/api';
import DevisManager from '../components/devis/DevisManager';

function EditProjectContent() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { tables, fetchTables, fetchRecords, isLoading } = useDynamicTables();

  const [formData, setFormData] = useState({
    nom_projet: '',
    numero_projet: '',
    contact_principal: '',
    type_projet: '',
    equipe: '',
    description: '',
    statut: 'Non commencé',
    // Champs conditionnels dynamiques
    conditionalFields: {}
  });

  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [projectTypes, setProjectTypes] = useState([]);
  const [projectTableId, setProjectTableId] = useState(null);
  const [contactTableId, setContactTableId] = useState(null);
  const [tableNamesTableId, setTableNamesTableId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // États pour les champs conditionnels
  const [conditionalFields, setConditionalFields] = useState([]);
  const [, setDetailsTable] = useState(null);
  const [, setProjectDetailsData] = useState(null);

  // États pour la modal d'ajout de contact
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactData, setNewContactData] = useState({
    prenom: '',
    nom: '',
    email: '',
    equipe: ''
  });

  // Fonction pour afficher les toasts
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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

  // Charger les options pour un champ (déclaré en premier car utilisé par loadConditionalFields)
  const loadFieldOptions = useCallback(async (field) => {
    if (field.field_type === 'foreign_key' && field.related_table) {
      try {
        const response = await api.get(`/api/database/tables/${field.related_table.id || field.related_table}/records`);
        const recordsList = response || [];

        console.log(`🔍 Chargement options pour ${field.label}:`, {
          field: field.name,
          related_table: field.related_table,
          records_count: recordsList.length
        });

        const uniqueValues = new Set();
        const options = [];

        recordsList.forEach((record) => {
          // D'abord essayer les champs génériques
          let extractedValue = getFieldValue(record, 'nom', 'name', 'label', 'title', 'value');
          
          // Si pas trouvé, essayer des colonnes spécifiques basées sur le nom du champ
          if (!extractedValue || extractedValue.trim() === '') {
            const fieldNameLower = field.name.toLowerCase();
            
            // Mapping dynamique selon le type de projet pour les sous types
            if (fieldNameLower.includes('sous_type') || fieldNameLower.includes('soustype')) {
              // Construire dynamiquement le nom de la colonne selon le type de projet
              const selectedType = projectTypes.find(type => {
                const typeId = String(type.id);
                return typeId === String(formData.type_projet);
              });
              
              if (selectedType) {
                const typeName = getFieldValue(selectedType, 'nom', 'name', 'title', 'titre', 'label');
                if (typeName) {
                  const dynamicColumnName = `sous_type_${typeName.toLowerCase()}`;
                  console.log(`🎯 Colonne dynamique pour sous type: ${dynamicColumnName}`);
                  extractedValue = getFieldValue(record, dynamicColumnName, 'sous_type', 'soustype');
                }
              }
            } else if (fieldNameLower.includes('espece') || fieldNameLower.includes('espèce')) {
              extractedValue = getFieldValue(record, 'espece', 'espèce', 'species');
            } else {
              // Essayer avec le nom du champ lui-même
              extractedValue = getFieldValue(record, field.name, fieldNameLower);
            }
          }
          
          if (extractedValue && typeof extractedValue === 'string') {
            const trimmedValue = extractedValue.trim();
            
            if (trimmedValue && !uniqueValues.has(trimmedValue)) {
              uniqueValues.add(trimmedValue);
              options.push({
                value: trimmedValue,
                label: trimmedValue
              });
            }
          }
        });

        console.log(`✅ Options chargées pour ${field.label}:`, options);
        return options.sort((a, b) => a.label.localeCompare(b.label));
        
      } catch (error) {
        console.error('Erreur lors du chargement des options FK:', error);
        return [];
      }
    }
    return [];
  }, [getFieldValue, projectTypes, formData.type_projet]);

  // Charger les champs conditionnels basés sur la table Details
  const loadConditionalFields = useCallback(async (detailsTable, projectRecord) => {
    try {
      // Exclure les champs FK vers Projet
      const fieldsConfig = detailsTable.fields?.filter(field => {
        // Exclure les champs FK qui pointent vers la table Projet
        if (field.field_type === 'foreign_key' && field.related_table) {
          // Vérifier si la table liée est la table Projet (par ID ou nom)
          const relatedTableId = field.related_table.id || field.related_table;
          const isProjectTable = relatedTableId === projectTableId || 
                                  field.related_table.name === 'Projet' ||
                                  field.related_table.slug === 'projet';
          
          if (isProjectTable) {
            console.log(`🚫 Champ FK exclu (pointe vers Projet): ${field.name} (${field.slug})`);
            return false;
          }
        }
        
        // Exclure aussi par le nom/slug si c'est un champ de projet
        if (field.slug.includes('projet') || field.slug.includes('project') || 
            field.name.toLowerCase().includes('projet') || field.name.toLowerCase().includes('project')) {
          console.log(`🚫 Champ projet exclu par nom/slug: ${field.name} (${field.slug})`);
          return false;
        }
        
        return true;
      }).map(field => ({
        name: field.slug,
        label: field.name,
        field_type: field.field_type,
        required: field.is_required || false,
        related_table: field.related_table,
        options: []
      })) || [];

      console.log('📋 Champs conditionnels configurés:', fieldsConfig);

      // Charger les options pour chaque champ
      const fieldsWithOptions = await Promise.all(
        fieldsConfig.map(async (field) => {
          const options = await loadFieldOptions(field);
          return { ...field, options };
        })
      );

      setConditionalFields(fieldsWithOptions);

      // Extraire les valeurs actuelles des champs conditionnels
      const conditionalValues = {};
      fieldsWithOptions.forEach(field => {
        const value = getFieldValue(projectRecord, field.name);
        if (value) {
          conditionalValues[field.name] = value;
        }
      });

      console.log('📋 Valeurs conditionnelles extraites:', conditionalValues);
      
      // Mettre à jour le formData avec les valeurs conditionnelles
      setFormData(prev => ({
        ...prev,
        conditionalFields: conditionalValues
      }));

    } catch (err) {
      console.error('Erreur lors du chargement des champs conditionnels:', err);
    }
  }, [getFieldValue, projectTableId, loadFieldOptions]);

  // Charger les détails spécifiques du projet
  const loadProjectDetails = useCallback(async (project, typeProjet) => {
    try {
      console.log('🎯 loadProjectDetails appelé avec typeProjet:', typeProjet);
      console.log('🎯 projectTypes disponibles:', projectTypes.length);
      
      // Trouver le type exact dans la liste des types
      const selectedType = projectTypes.find(type => {
        const typeId = String(type.id);
        const typeName = getFieldValue(type, 'nom', 'name', 'title', 'titre', 'label');
        console.log(`🔍 Comparaison type: ID=${typeId}, Nom=${typeName}, Recherche=${typeProjet}`);
        return typeId === String(typeProjet) || typeName === typeProjet;
      });

      if (!selectedType) {
        console.log('⚠️ Type de projet non trouvé dans la liste');
        console.log('🔍 Types disponibles:', projectTypes.map(t => ({ id: t.id, nom: getFieldValue(t, 'nom', 'name', 'title', 'titre', 'label') })));
        return;
      }

      const typeName = getFieldValue(selectedType, 'nom', 'name', 'title', 'titre', 'label');
      console.log('✅ Type de projet trouvé:', typeName, 'pour ID/Nom:', typeProjet);

      // Trouver la table {Type}Details correspondante
      const detailsTableName = `${typeName}Details`;
      const foundDetailsTable = tables.find(table => 
        table.name === detailsTableName ||
        table.name.toLowerCase() === detailsTableName.toLowerCase()
      );

      if (!foundDetailsTable) {
        console.log(`⚠️ Table ${detailsTableName} non trouvée`);
        return;
      }

      console.log('✅ Table Details trouvée:', foundDetailsTable.name);
      setDetailsTable(foundDetailsTable);

      // Charger les enregistrements de la table Details
      const detailsRecords = await fetchRecords(foundDetailsTable.id);
      
      console.log('📊 Enregistrements dans la table Details:', detailsRecords);
      console.log('🔍 Recherche d\'un enregistrement pour projectId:', projectId);
      
      // Trouver l'enregistrement qui correspond à notre projet
      const projectRecord = detailsRecords.find(record => {
        console.log('🔍 Test enregistrement:', record);
        
        // Tester différentes propriétés de FK par ID
        const matchesById = [
          record.id_projet_id,
          record.projet_id,
          record.projet_auto,
          record.projet,
          record.project
        ].map(val => String(val)).includes(String(projectId));
        
        // Tester la correspondance par nom de projet (pour projet_auto)
        const projectName = getFieldValue(project, 'nom_projet', 'nom', 'name', 'titre', 'title');
        const matchesByName = projectName && (
          record.projet_auto === projectName ||
          record.projet === projectName ||
          record.project === projectName
        );
        
        console.log('🔍 Matches trouvés:', {
          id_projet_id: record.id_projet_id,
          projet_id: record.projet_id,
          projet_auto: record.projet_auto,
          projet: record.projet,
          project: record.project,
          matchesById: matchesById,
          matchesByName: matchesByName,
          projectName: projectName,
          searchingFor: projectId
        });
        
        return matchesById || matchesByName;
      });

      if (projectRecord) {
        console.log('✅ Enregistrement Details trouvé:', projectRecord);
        setProjectDetailsData(projectRecord);

        // Charger les champs conditionnels pour ce type
        await loadConditionalFields(foundDetailsTable, projectRecord);
      } else {
        console.log('⚠️ Aucun enregistrement Details trouvé pour ce projet');
      }

    } catch (err) {
      console.error('Erreur lors du chargement des détails:', err);
    }
  }, [tables, projectTypes, getFieldValue, fetchRecords, projectId, loadConditionalFields]);

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
      // Table Projet
      const projectTable = tables.find(t => 
        t.name === 'Projet' || t.slug === 'projet' ||
        t.name === 'Projets' || t.slug === 'projets'
      );
      if (projectTable) {
        setProjectTableId(projectTable.id);
      }

      // Table Contacts
      const contactTable = tables.find(t => 
        t.name === 'Contacts' || t.slug === 'contacts' ||
        t.name === 'Contact' || t.slug === 'contact'
      );
      if (contactTable) {
        setContactTableId(contactTable.id);
      }

      // Table TableNames / Types
      const tableNamesTable = tables.find(t => 
        t.name.toLowerCase().includes('tablename') ||
        t.name.toLowerCase().includes('table_name') ||
        t.name.toLowerCase().includes('type')
      );
      if (tableNamesTable) {
        setTableNamesTableId(tableNamesTable.id);
      }
    }
  }, [tables]);

  // Charger les contacts
  useEffect(() => {
    const loadContacts = async () => {
      if (!contactTableId) return;

      try {
        const contactsList = await fetchRecords(contactTableId);
        setContacts(contactsList || []);
      } catch (err) {
        console.error('Erreur lors du chargement des contacts:', err);
        setContacts([]);
      }
    };

    loadContacts();
  }, [contactTableId, fetchRecords]);

  // Charger les types de projets
  useEffect(() => {
    const loadProjectTypes = async () => {
      if (!tableNamesTableId) return;

      try {
        const typesList = await fetchRecords(tableNamesTableId);
        setProjectTypes(typesList || []);
      } catch (err) {
        console.error('Erreur lors du chargement des types de projets:', err);
        setProjectTypes([]);
      }
    };

    loadProjectTypes();
  }, [tableNamesTableId, fetchRecords]);

  // Charger les données du projet existant
  useEffect(() => {
    const loadProjectData = async () => {
      if (!projectId || !projectTableId) return;

      try {
        setLoading(true);
        
        // Charger les données du projet principal
        const projectResponse = await api.get(`/api/database/records/${projectId}/`);
        console.log('📋 Données du projet chargées:', projectResponse);

        // Extraire les valeurs pour le formulaire
        const projectData = {
          nom_projet: getFieldValue(projectResponse, 'nom_projet', 'nom', 'name', 'titre', 'title'),
          numero_projet: getFieldValue(projectResponse, 'numero_projet', 'numero', 'number', 'num'),
          contact_principal: getFieldValue(projectResponse, 'contact_principal', 'contact_principal_id', 'contact_id', 'contact'),
          type_projet: getFieldValue(projectResponse, 'type_projet', 'type_id', 'type'),
          equipe: getFieldValue(projectResponse, 'equipe', 'team', 'groupe'),
          description: getFieldValue(projectResponse, 'description', 'desc', 'details'),
          statut: getFieldValue(projectResponse, 'statut', 'status', 'etat') || 'Non commencé',
          conditionalFields: {}
        };

        console.log('📋 Données extraites pour le formulaire:', projectData);
        console.log('🔍 Détail contact_principal extrait:', projectData.contact_principal);
        console.log('🔍 Détail type_projet extrait:', projectData.type_projet);
        console.log('🔍 Toutes les clés de projectResponse:', Object.keys(projectResponse));
        
        setFormData(projectData);

        // Note: Le chargement des détails spécifiques est maintenant géré par un useEffect séparé

      } catch (err) {
        console.error('Erreur lors du chargement du projet:', err);
        showToast('Erreur lors du chargement du projet', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadProjectData();
  }, [projectId, projectTableId, getFieldValue]);

  // Charger les détails spécifiques du projet quand toutes les conditions sont réunies
  useEffect(() => {
    const loadProjectDetailsWhenReady = async () => {
      if (!formData.nom_projet || !formData.type_projet || !projectTypes.length || !tables.length) {
        console.log('⚠️ Conditions non réunies pour charger les détails:', {
          hasProjectData: !!formData.nom_projet,
          hasTypeProjet: !!formData.type_projet,
          projectTypesLoaded: projectTypes.length,
          tablesLoaded: tables.length
        });
        return;
      }

      console.log('🎯 Toutes les conditions réunies, chargement des détails pour type:', formData.type_projet);
      console.log('🎯 projectTypes disponibles:', projectTypes.length);
      console.log('🎯 tables disponibles:', tables.length);

      try {
        // Recharger les données du projet pour passer à loadProjectDetails
        const projectResponse = await api.get(`/api/database/records/${projectId}/`);
        await loadProjectDetails(projectResponse, formData.type_projet);
      } catch (err) {
        console.error('Erreur lors du chargement des détails du projet:', err);
      }
    };

    loadProjectDetailsWhenReady();
  }, [formData.nom_projet, formData.type_projet, projectTypes, tables, projectId]);

  // Convertir les valeurs texte en IDs une fois que les options sont disponibles
  useEffect(() => {
    if (!formData.nom_projet) return; // Attendre que les données du projet soient chargées
    
    const convertValues = () => {
      let hasChanges = false;
      const updatedFormData = { ...formData };
      
      // Convertir le type de projet si les types sont chargés
      if (projectTypes.length > 0 && formData.type_projet) {
        // Si c'est déjà un ID numérique, ne pas convertir
        if (isNaN(formData.type_projet)) {
          const matchingType = projectTypes.find(type => {
            const typeName = getFieldValue(type, 'nom', 'name', 'title', 'titre', 'label');
            return typeName === formData.type_projet;
          });
          
          if (matchingType) {
            const convertedType = String(matchingType.id);
            if (convertedType !== formData.type_projet) {
              updatedFormData.type_projet = convertedType;
              hasChanges = true;
              console.log('🔄 Type de projet converti:', formData.type_projet, '→', convertedType);
            }
          }
        }
      }
      
      // Convertir le contact principal si les contacts sont chargés
      if (contacts.length > 0 && formData.contact_principal) {
        // Vérifier si c'est un nom complet qui doit être converti en ID ou format attendu
        const currentContact = formData.contact_principal;
        
        // Chercher le contact correspondant dans la liste
        const matchingContact = contacts.find(contact => {
          const contactName = getFieldValue(contact, 'nom', 'name', 'prenom', 'label') || `Contact #${contact.id}`;
          const contactPrenom = getFieldValue(contact, 'prenom', 'first_name', 'firstname');
          const fullName = contactPrenom ? `${contactPrenom} ${contactName}` : contactName;
          
          return fullName === currentContact || contactName === currentContact || contact.id.toString() === currentContact;
        });
        
        if (matchingContact) {
          // Utiliser le format nom complet pour cohérence avec CreateProject
          const contactName = getFieldValue(matchingContact, 'nom', 'name', 'prenom', 'label');
          const contactPrenom = getFieldValue(matchingContact, 'prenom', 'first_name', 'firstname');
          const fullName = contactPrenom ? `${contactPrenom} ${contactName}` : contactName;
          
          if (fullName !== currentContact) {
            updatedFormData.contact_principal = fullName;
            hasChanges = true;
            console.log('🔄 Contact principal converti:', currentContact, '→', fullName);
          }
        }
      }
      
      if (hasChanges) {
        setFormData(updatedFormData);
      }
    };
    
    convertValues();
  }, [projectTypes, contacts, formData.nom_projet, formData.type_projet, formData.contact_principal, getFieldValue]);

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

    try {
      // Préparer les données du projet principal
      const projectData = {
        nom_projet: formData.nom_projet,
        numero_projet: formData.numero_projet,
        contact_principal: formData.contact_principal,
        type_projet: formData.type_projet,
        equipe: formData.equipe,
        description: formData.description,
        statut: formData.statut
      };

      // Préparer les champs conditionnels pour la table Details
      const conditionalFieldsData = formData.conditionalFields;

      console.log('📤 === DONNÉES DE MODIFICATION ===');
      console.log('🏗️ Données projet:', projectData);
      console.log('⚙️ Champs conditionnels:', conditionalFieldsData);
      console.log('🎯 Type de projet ID:', formData.type_projet);

      // Utiliser le service pour mettre à jour le projet
      const result = await typeService.updateProjectWithDetails(
        projectId,
        projectData,
        conditionalFieldsData,
        formData.type_projet
      );

      if (result.success) {
        setSuccessMessage('Projet modifié avec succès !');
        setTimeout(() => {
          navigate(`/projects/${projectId}`);
        }, 2000);
      } else {
        throw new Error(result.error);
      }

    } catch (err) {
      console.error('Erreur lors de la modification du projet:', err);
      setFormErrors({
        submit: err.message || 'Une erreur est survenue lors de la modification'
      });
      showToast('Erreur lors de la modification', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fonction pour ajouter un nouveau type de projet
  const addNewProjectType = async (typeName, columns) => {
    console.log('🎯 Création d\'un nouveau type de projet:', typeName, columns);
    
    try {
      const result = await typeService.createNewType(typeName, columns);
      
      if (result.success) {
        // Recharger les types de projets
        if (tableNamesTableId) {
          const newTypesList = await fetchRecords(tableNamesTableId);
          setProjectTypes(newTypesList || []);
        }
        
        // Sélectionner automatiquement le nouveau type
        setFormData(prev => ({
          ...prev,
          type_projet: result.type_record.id
        }));
        
        showToast(`Type "${typeName}" créé avec succès`, 'success');
        return result.type_record.id;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Erreur lors de la création du type:', err);
      showToast(err.message || 'Erreur lors de la création du type', 'error');
    }
  };

  // Fonction pour ajouter un nouveau contact
  const addNewContactWithDetails = async () => {
    if (!newContactData.prenom.trim() || !newContactData.nom.trim()) {
      showToast('Prénom et nom sont requis', 'error');
      return;
    }

    try {
      const contactFormData = {
        prenom: newContactData.prenom.trim(),
        nom: newContactData.nom.trim(),
        email: newContactData.email.trim(),
        equipe: newContactData.equipe.trim()
      };

      console.log('📤 Ajout d\'un nouveau contact:', contactFormData);

      const result = await api.post(`/api/database/records/create_with_values/`, {
        table_id: contactTableId,
        values: contactFormData
      });

      if (result && result.id) {
        // Recharger la liste des contacts
        const updatedContacts = await fetchRecords(contactTableId);
        setContacts(updatedContacts || []);

        // Sélectionner automatiquement le nouveau contact
        const newContactValue = `${newContactData.prenom} ${newContactData.nom}`.trim();
        setFormData(prev => ({
          ...prev,
          contact_principal: newContactValue
        }));

        // Fermer la modal et réinitialiser
        setShowAddContactModal(false);
        setNewContactData({
          prenom: '',
          nom: '',
          email: '',
          equipe: ''
        });

        showToast(`Contact "${newContactValue}" ajouté avec succès`, 'success');
      }
    } catch (err) {
      console.error('Erreur lors de l\'ajout du contact:', err);
      showToast('Erreur lors de l\'ajout du contact', 'error');
    }
  };

  // Fonction pour ajouter une nouvelle valeur dans la table Choix
  const addNewChoiceValue = async (fieldName, newValue) => {
    console.log(`🎯 Ajout d'une nouvelle valeur pour ${fieldName}:`, newValue);
    
    let targetColumn = ''; // Déclaration en dehors du try
    
    try {
      // Trouver la table Choix
      const choixTable = tables.find(t => 
        t.name.toLowerCase().includes('choix') ||
        t.name.toLowerCase().includes('choice')
      );

      if (!choixTable) {
        showToast('Table Choix introuvable', 'error');
        console.error('❌ Table Choix non trouvée. Tables disponibles:', tables.map(t => t.name));
        return;
      }

      console.log('✅ Table Choix trouvée:', choixTable.name, 'ID:', choixTable.id);
      console.log('📋 Champs disponibles dans la table Choix:', choixTable.fields?.map(f => f.slug) || 'Non chargés');

      // Déterminer la colonne cible selon le champ
      const fieldNameLower = fieldName.toLowerCase();
      
      if (fieldNameLower.includes('sous_type') || fieldNameLower.includes('soustype')) {
        // Construire dynamiquement le nom de la colonne selon le type de projet
        const selectedType = projectTypes.find(type => {
          const typeId = String(type.id);
          return typeId === String(formData.type_projet);
        });
        
        if (selectedType) {
          const typeName = getFieldValue(selectedType, 'nom', 'name', 'title', 'titre', 'label');
          if (typeName) {
            targetColumn = `sous_type_${typeName.toLowerCase()}`;
            console.log(`🎯 Colonne dynamique pour ajout: ${targetColumn}`);
          }
        }
      } else if (fieldNameLower.includes('espece') || fieldNameLower.includes('espèce')) {
        targetColumn = 'espece';
      } else {
        targetColumn = fieldName;
      }

      console.log('🎯 Colonne cible déterminée:', targetColumn);

      // Créer l'enregistrement dans la table Choix
      const choiceData = {
        [targetColumn]: newValue
      };

      console.log('📤 Données à envoyer:', {
        table_id: choixTable.id,
        values: choiceData
      });

      const result = await api.post(`/api/database/records/create_with_values/`, {
        table_id: choixTable.id,
        values: choiceData
      });

      console.log('✅ Réponse API:', result);

      if (result && result.id) {
        // Recharger les champs conditionnels pour mettre à jour les options
        const reloadConditionalFields = async () => {
          if (!formData.type_projet || !projectTypes.length || !tables.length) return;

          const selectedType = projectTypes.find(type => {
            const typeId = String(type.id);
            return typeId === String(formData.type_projet);
          });
          
          if (!selectedType) return;

          const typeName = getFieldValue(selectedType, 'nom', 'name', 'title', 'titre', 'label');
          if (!typeName) return;

          const detailsTable = tables.find(table => 
            table.name === `${typeName}Details` ||
            table.name.toLowerCase() === `${typeName}Details`.toLowerCase()
          );
          
          if (!detailsTable) return;

          const fieldsConfig = detailsTable.fields?.filter(field => {
            // Exclure les champs FK vers Projet
            if (field.field_type === 'foreign_key' && field.related_table) {
              // Vérifier si la table liée est la table Projet (par ID ou nom)
              const relatedTableId = field.related_table.id || field.related_table;
              const isProjectTable = relatedTableId === projectTableId || 
                                      field.related_table.name === 'Projet' ||
                                      field.related_table.slug === 'projet';
              
              if (isProjectTable) {
                console.log(`🚫 Champ FK exclu (pointe vers Projet): ${field.name} (${field.slug})`);
                return false;
              }
            }
            
            // Exclure aussi par le nom/slug si c'est un champ de projet
            if (field.slug.includes('projet') || field.slug.includes('project') || 
                field.name.toLowerCase().includes('projet') || field.name.toLowerCase().includes('project')) {
              console.log(`🚫 Champ projet exclu par nom/slug: ${field.name} (${field.slug})`);
              return false;
            }
            
            return true;
          }).map(field => ({
            name: field.slug,
            label: field.name,
            field_type: field.field_type,
            required: field.is_required || false,
            related_table: field.related_table,
            options: []
          })) || [];

          const fieldsWithOptions = await Promise.all(
            fieldsConfig.map(async (field) => {
              const options = await loadFieldOptions(field);
              return { ...field, options };
            })
          );

          setConditionalFields(fieldsWithOptions);
        };

        await reloadConditionalFields();

        // Sélectionner automatiquement la nouvelle valeur
        setFormData(prev => ({
          ...prev,
          conditionalFields: {
            ...prev.conditionalFields,
            [fieldName]: newValue
          }
        }));

        showToast(`Valeur "${newValue}" ajoutée avec succès`, 'success');
      }
    } catch (err) {
      console.error('❌ Erreur détaillée lors de l\'ajout de la valeur:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        fieldName,
        newValue,
        targetColumn
      });
      showToast(`Erreur lors de l'ajout de la valeur: ${err.response?.data?.error || err.message}`, 'error');
    }
  };

  const openAddContactModal = () => {
    setShowAddContactModal(true);
  };

  if (loading || isLoading) {
    return (
      <div className="hero min-h-screen">
        <div className="hero-content text-center">
          <div>
            <span className="loading loading-spinner loading-lg"></span>
            <p className="py-6">Chargement des données du projet...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="container mx-auto p-6 max-w-4xl">
        
        {/* Toast */}
        {toast && (
          <div className={`toast toast-top toast-end z-50`}>
            <div className={`alert ${
              toast.type === 'success' ? 'alert-success' : 
              toast.type === 'error' ? 'alert-error' : 
              'alert-info'
            }`}>
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="breadcrumbs text-sm mb-4">
            <ul>
              <li><Link to="/" className="link link-hover">Accueil</Link></li>
              <li><Link to="/dashboard" className="link link-hover">Projets</Link></li>
              <li><Link to={`/projects/${projectId}`} className="link link-hover">Projet #{projectId}</Link></li>
              <li>Modifier</li>
            </ul>
          </div>
          
          <h1 className="text-4xl font-bold mb-2">✏️ Modifier le projet</h1>
          <p className="text-lg text-base-content/70">
            Modifiez les informations de votre projet et ses paramètres spécifiques
          </p>
        </div>

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
                  <input
                    type="text"
                    id="numero_projet"
                    name="numero_projet"
                    value={formData.numero_projet}
                    onChange={handleChange}
                    placeholder="PRJ-202401-001"
                    className={`input input-bordered w-full ${formErrors.numero_projet ? 'input-error' : ''}`}
                    required
                  />
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
                      {contacts.map((contact) => {
                        const contactName = getFieldValue(contact, 'nom', 'name', 'prenom', 'label') || `Contact #${contact.id}`;
                        const contactPrenom = getFieldValue(contact, 'prenom', 'first_name', 'firstname');
                        const fullName = contactPrenom ? `${contactPrenom} ${contactName}` : contactName;
                        
                        return (
                          <option key={contact.id} value={fullName}>
                            {fullName}
                          </option>
                        );
                      })}
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

              {/* Section: Description */}
              <div>
                <h2 className="card-title text-2xl mb-6 flex items-center gap-2">
                  📝 Description
                </h2>

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
                  ></textarea>
                  {formErrors.description && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formErrors.description}</span>
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

                {/* Statut du projet */}
                <div className="form-control w-full mb-4">
                  <label className="label" htmlFor="statut">
                    <span className="label-text font-medium">Statut du projet <span className="text-error">*</span></span>
                  </label>
                  <select
                    id="statut"
                    name="statut"
                    value={formData.statut}
                    onChange={handleChange}
                    className={`select select-bordered w-full ${formErrors.statut ? 'select-error' : ''}`}
                    required
                  >
                    <option value="Non commencé">🔄 Non commencé</option>
                    <option value="En cours">⚡ En cours</option>
                    <option value="Terminé">✅ Terminé</option>
                    <option value="En attente">⏸️ En attente</option>
                    <option value="Suspendu">⚠️ Suspendu</option>
                  </select>
                  {formErrors.statut && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formErrors.statut}</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Section: Champs conditionnels */}
              {(() => {
                console.log('🔍 DEBUG conditionalFields:', conditionalFields, 'length:', conditionalFields.length);
                return conditionalFields.length > 0;
              })() && (
                <>
                  <div className="divider"></div>
                  <div>
                    <h2 className="card-title text-2xl mb-6 flex items-center gap-2">
                      ⚙️ Paramètres spécifiques
                    </h2>
                    
                    {conditionalFields.map((field) => {
                      const fieldId = `conditional_${field.name}`;
                      const fieldValue = formData.conditionalFields[field.name] || '';
                      const fieldError = formErrors[fieldId];

                      return (
                        <div key={field.name} className="form-control w-full mb-4">
                          <label className="label" htmlFor={fieldId}>
                            <span className="label-text font-medium">
                              {field.label} 
                              {field.required && <span className="text-error">*</span>}
                            </span>
                          </label>
                          
                          {/* Rendu selon le type de champ */}
                          {field.field_type === 'text' && (
                            <input
                              type="text"
                              id={fieldId}
                              name={fieldId}
                              value={fieldValue}
                              onChange={handleChange}
                              placeholder={`Saisir ${field.label.toLowerCase()}`}
                              className={`input input-bordered w-full ${fieldError ? 'input-error' : ''}`}
                              required={field.required}
                            />
                          )}
                          
                          {field.field_type === 'long_text' && (
                            <textarea
                              id={fieldId}
                              name={fieldId}
                              value={fieldValue}
                              onChange={handleChange}
                              placeholder={`Saisir ${field.label.toLowerCase()}`}
                              className={`textarea textarea-bordered w-full ${fieldError ? 'textarea-error' : ''}`}
                              required={field.required}
                              rows="3"
                            />
                          )}
                          
                          {field.field_type === 'number' && (
                            <input
                              type="number"
                              id={fieldId}
                              name={fieldId}
                              value={fieldValue}
                              onChange={handleChange}
                              placeholder={`Saisir ${field.label.toLowerCase()}`}
                              className={`input input-bordered w-full ${fieldError ? 'input-error' : ''}`}
                              required={field.required}
                            />
                          )}
                          
                          {field.field_type === 'foreign_key' && (
                            <SelectWithAddOption
                              id={fieldId}
                              name={fieldId}
                              value={fieldValue}
                              onChange={handleChange}
                              options={field.options.map(option => ({
                                value: option.value,
                                label: option.label
                              }))}
                              placeholder={`Choisir ${field.label.toLowerCase()}`}
                              required={field.required}
                              className={fieldError ? 'select-error' : ''}
                              isLoading={false}
                              isTypeMode={false}
                              onAddOption={async (newValue) => {
                                await addNewChoiceValue(field.name, newValue);
                              }}
                              addButtonTitle={`Ajouter une nouvelle valeur pour ${field.label}`}
                              emptyMessage={`Aucune option disponible pour ${field.label}`}
                            />
                          )}
                          
                          {field.field_type === 'date' && (
                            <input
                              type="date"
                              id={fieldId}
                              name={fieldId}
                              value={fieldValue}
                              onChange={handleChange}
                              className={`input input-bordered w-full ${fieldError ? 'input-error' : ''}`}
                              required={field.required}
                            />
                          )}
                          
                          {fieldError && (
                            <label className="label">
                              <span className="label-text-alt text-error">{fieldError}</span>
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Actions */}
              <div className="card-actions justify-between pt-6">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => navigate(`/projects/${projectId}`)}
                >
                  Annuler
                </button>
                
                <button
                  type="submit"
                  className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Modification...' : 'Modifier le projet'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Section Devis */}
        <div className="mt-8">
          <DevisManager 
            projectId={projectId}
            readonly={false}
          />
        </div>

        {/* Modal pour ajouter un contact */}
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
              onClick={() => {
                setShowAddContactModal(false);
                setNewContactData({
                  prenom: '',
                  nom: '',
                  email: '',
                  equipe: ''
                });
              }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditProject() {
  return (
    <DynamicTableProvider>
      <EditProjectContent />
    </DynamicTableProvider>
  );
}

export default EditProject;