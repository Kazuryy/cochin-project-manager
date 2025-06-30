import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDynamicTables } from '../contexts/hooks/useDynamicTables';
import { DynamicTableProvider } from '../contexts/DynamicTableProvider';
import SelectWithAddOption from '../components/SelectWithAddOption';
import { typeService } from '../services/typeService';
import api from '../services/api';
import DevisManager from '../components/devis/DevisManager';
import PdfManager from '../components/pdf/PdfManager';

function EditProjectContent() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { tables, fetchTables, fetchRecords, isLoading } = useDynamicTables();

  // Optimisation de la gestion des états
  const [formState, setFormState] = useState({
    data: {
      nom_projet: '',
      numero_projet: '',
      contact_principal: '',
      type_projet: '',
      description: '',
      statut: 'Non commencé',
      conditionalFields: {}
    },
    errors: {},
    isSubmitting: false,
    isLoading: true
  });

  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [projectTypes, setProjectTypes] = useState([]);
  const [projectTableId, setProjectTableId] = useState(null);
  const [contactTableId, setContactTableId] = useState(null);
  const [tableNamesTableId, setTableNamesTableId] = useState(null);
  const [toast, setToast] = useState(null);

  // États pour les champs conditionnels
  const [conditionalFields, setConditionalFields] = useState([]);

  // États pour la modal d'ajout de contact
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactData, setNewContactData] = useState({
    prenom: '',
    nom: '',
    email: '',
    equipe: ''
  });

  // Fonction pour afficher les toasts
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

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

        const processRecord = (record) => {
          let extractedValue = getFieldValue(record, 'nom', 'name', 'label', 'title', 'value');
          
          if (!extractedValue || extractedValue.trim() === '') {
            const fieldNameLower = field.name.toLowerCase();
            
            if (fieldNameLower.includes('sous_type') || fieldNameLower.includes('soustype')) {
              const selectedType = projectTypes.find(type => {
                const typeId = String(type.id);
                return typeId === String(formState.data.type_projet);
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
              extractedValue = getFieldValue(record, field.name, fieldNameLower);
            }
          }
          
          return extractedValue;
        };

        const uniqueValues = new Set();
        const options = recordsList
          .map(processRecord)
          .filter(value => value && typeof value === 'string')
          .map(value => value.trim())
          .filter(value => value && !uniqueValues.has(value))
          .map(value => {
            uniqueValues.add(value);
            return { value, label: value };
          });

        console.log(`✅ Options chargées pour ${field.label}:`, options);
        return options.sort((a, b) => a.label.localeCompare(b.label));
        
      } catch (error) {
        console.error('Erreur lors du chargement des options FK:', error);
        return [];
      }
    }
    return [];
  }, [getFieldValue, projectTypes, formState.data.type_projet]);

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
      setFormState(prev => ({
        ...prev,
        data: {
          ...prev.data,
          conditionalFields: conditionalValues
        }
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
  const loadProjectData = useCallback(async () => {
    if (!projectId || !projectTableId) return;

    try {
      setLoading(true);
      
      const projectResponse = await api.get(`/api/database/records/${projectId}/`);
      
      if (!projectResponse) {
        throw new Error('Données du projet non trouvées');
      }

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
      
      setFormState(prev => ({
        ...prev,
        data: projectData,
        isLoading: false
      }));

    } catch (err) {
      console.error('Erreur lors du chargement du projet:', err);
      showToast('Erreur lors du chargement du projet', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, projectTableId, getFieldValue, showToast]);

  // Optimisation des effets
  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  // Charger les détails spécifiques du projet quand toutes les conditions sont réunies
  useEffect(() => {
    const loadProjectDetailsWhenReady = async () => {
      if (!formState.data.nom_projet || !formState.data.type_projet || !projectTypes.length || !tables.length) {
        console.log('⚠️ Conditions non réunies pour charger les détails:', {
          hasProjectData: !!formState.data.nom_projet,
          hasTypeProjet: !!formState.data.type_projet,
          projectTypesLoaded: projectTypes.length,
          tablesLoaded: tables.length
        });
        return;
      }

      console.log('🎯 Toutes les conditions réunies, chargement des détails pour type:', formState.data.type_projet);
      console.log('🎯 projectTypes disponibles:', projectTypes.length);
      console.log('🎯 tables disponibles:', tables.length);

      try {
        const projectResponse = await api.get(`/api/database/records/${projectId}/`);
        await loadProjectDetails(projectResponse, formState.data.type_projet);
      } catch (err) {
        console.error('Erreur lors du chargement des détails du projet:', err);
      }
    };

    loadProjectDetailsWhenReady();
  }, [formState.data.nom_projet, formState.data.type_projet, projectTypes, tables, projectId, loadProjectDetails]);

  // Convertir les valeurs texte en IDs une fois que les options sont disponibles
  useEffect(() => {
    if (!formState.data.nom_projet) return; // Attendre que les données du projet soient chargées
    
    const convertValues = () => {
      let hasChanges = false;
      const updatedFormData = { ...formState.data };
      
      // Convertir le type de projet si les types sont chargés
      if (projectTypes.length > 0 && formState.data.type_projet) {
        // Si c'est déjà un ID numérique, ne pas convertir
        if (isNaN(formState.data.type_projet)) {
        const matchingType = projectTypes.find(type => {
          const typeName = getFieldValue(type, 'nom', 'name', 'title', 'titre', 'label');
          return typeName === formState.data.type_projet;
        });
        
        if (matchingType) {
          const convertedType = String(matchingType.id);
          if (convertedType !== formState.data.type_projet) {
            updatedFormData.type_projet = convertedType;
            hasChanges = true;
            console.log('🔄 Type de projet converti:', formState.data.type_projet, '→', convertedType);
          }
        }
      }
      }
      
      // Convertir le contact principal si les contacts sont chargés
      if (contacts.length > 0 && formState.data.contact_principal) {
        // Vérifier si le contact est déjà un ID numérique
        if (isNaN(formState.data.contact_principal)) {
          // Si ce n'est pas un ID numérique, c'est probablement un nom complet qui doit être converti
          const currentContact = formState.data.contact_principal;
          
          // Chercher le contact correspondant dans la liste
          const matchingContact = contacts.find(contact => {
            const contactName = getFieldValue(contact, 'nom', 'name', 'prenom', 'label') || `Contact #${contact.id}`;
            const contactPrenom = getFieldValue(contact, 'prenom', 'first_name', 'firstname');
            const fullName = contactPrenom ? `${contactPrenom} ${contactName}` : contactName;
            
            return fullName === currentContact || contactName === currentContact;
          });
          
          if (matchingContact) {
            // Utiliser l'ID du contact pour cohérence avec CreateProject
            const contactId = String(matchingContact.id);
            
            if (contactId !== currentContact) {
              updatedFormData.contact_principal = contactId;
              hasChanges = true;
              console.log('🔄 Contact principal converti:', currentContact, '→', contactId);
            }
          }
        }
      }
      
      if (hasChanges) {
        setFormState(prev => ({
          ...prev,
          data: updatedFormData
        }));
      }
    };
    
    convertValues();
  }, [projectTypes, contacts, formState.data, getFieldValue]);

  // Optimisation de la validation des données
  const validateField = useCallback((name, value) => {
    switch (name) {
      case 'nom_projet':
        return !value?.trim() ? 'Le nom du projet est requis' : '';
      case 'numero_projet':
        return !value?.trim() ? 'Le numéro du projet est requis' : '';
      case 'contact_principal':
        return !value ? 'Le contact principal est requis' : '';
      case 'type_projet':
        return !value ? 'Le type de projet est requis' : '';
      case 'description':
        return !value?.trim() ? 'La description est requise' : '';
      default:
        if (name.startsWith('conditional_')) {
          const fieldName = name.replace('conditional_', '');
          const field = conditionalFields.find(f => f.name === fieldName);
          if (field?.required && !value) {
            return `${field.label} est requis`;
          }
        }
        return '';
    }
  }, [conditionalFields]);

  // Optimisation du handleChange
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    
    setFormState(prev => {
      const newData = { ...prev.data };
      const newErrors = { ...prev.errors };
      
      if (name.startsWith('conditional_')) {
        const fieldName = name.replace('conditional_', '');
        newData.conditionalFields = {
          ...newData.conditionalFields,
          [fieldName]: value
        };
      } else {
        newData[name] = value;
      }
      
      // Validation immédiate du champ modifié
      const error = validateField(name, value);
      if (error) {
        newErrors[name] = error;
      } else {
        delete newErrors[name];
      }
      
      return {
        ...prev,
        data: newData,
        errors: newErrors
      };
    });
  }, [validateField]);

  // Optimisation du handleSubmit
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    setFormState(prev => ({ ...prev, isSubmitting: true }));
    
    try {
      // Validation complète du formulaire
      const errors = {};
      Object.entries(formState.data).forEach(([key, value]) => {
        const error = validateField(key, value);
        if (error) errors[key] = error;
      });
      
      if (Object.keys(errors).length > 0) {
        setFormState(prev => ({
          ...prev,
          errors,
          isSubmitting: false
        }));
        return;
      }
      
      // Préparation des données
      const projectData = {
        nom_projet: formState.data.nom_projet,
        numero_projet: formState.data.numero_projet,
        contact_principal: formState.data.contact_principal,
        type_projet: formState.data.type_projet,
        description: formState.data.description,
        statut: formState.data.statut
      };

      const result = await typeService.updateProjectWithDetails(
        projectId,
        projectData,
        formState.data.conditionalFields,
        formState.data.type_projet
      );

      if (result.success) {
        showToast('Projet modifié avec succès !', 'success');
        setTimeout(() => {
          navigate(`/projects/${projectId}`);
        }, 2000);
      } else {
        throw new Error(result.error);
      }

    } catch (err) {
      console.error('Erreur lors de la modification du projet:', err);
      setFormState(prev => ({
        ...prev,
        errors: {
          submit: err.message || 'Une erreur est survenue lors de la modification'
        }
      }));
      showToast('Erreur lors de la modification', 'error');
    } finally {
      setFormState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [formState.data, projectId, validateField, navigate, showToast]);

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
        setFormState(prev => ({
          ...prev,
          data: {
            ...prev.data,
            type_projet: result.type_record.id
          }
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

        // Sélectionner automatiquement le nouveau contact (stocker l'ID)
        setFormState(prev => ({
          ...prev,
          data: {
            ...prev.data,
            contact_principal: result.id
          }
        }));

        // Fermer la modal et réinitialiser
        setShowAddContactModal(false);
        setNewContactData({
          prenom: '',
          nom: '',
          email: '',
          equipe: ''
        });

        showToast(`Contact "${newContactData.prenom} ${newContactData.nom}" ajouté avec succès`, 'success');
      }
    } catch (err) {
      console.error('Erreur lors de l\'ajout du contact:', err);
      showToast('Erreur lors de l\'ajout du contact', 'error');
    }
  };

  // Fonction pour ajouter une nouvelle valeur dans la table Choix
  const addNewChoiceValue = useCallback(async (fieldName, newValue) => {
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
          return typeId === String(formState.data.type_projet);
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
          if (!formState.data.type_projet || !projectTypes.length || !tables.length) return;

          const selectedType = projectTypes.find(type => {
            const typeId = String(type.id);
            return typeId === String(formState.data.type_projet);
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
        setFormState(prev => ({
          ...prev,
          data: {
            ...prev.data,
            conditionalFields: {
              ...prev.data.conditionalFields,
              [fieldName]: newValue
            }
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
  }, [tables, projectTypes, formState.data.type_projet, projectTableId, getFieldValue, loadFieldOptions, setConditionalFields, setFormState]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAddContactModal = () => {
    setShowAddContactModal(true);
  };

  // Optimisation du rendu conditionnel
  const renderConditionalFields = useCallback(() => {
    if (!conditionalFields.length) return null;

    return (
      <>
        <div className="divider"></div>
        <div>
          <h2 className="card-title text-2xl mb-6 flex items-center gap-2">
            ⚙️ Paramètres spécifiques
          </h2>
          
          {conditionalFields.map((field) => {
            const fieldId = `conditional_${field.name}`;
            const fieldValue = formState.data.conditionalFields[field.name] || '';
            const fieldError = formState.errors[fieldId];

            return (
              <div key={field.name} className="form-control w-full mb-4">
                <label className="label" htmlFor={fieldId}>
                  <span className="label-text font-medium pb-1">
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
    );
  }, [conditionalFields, formState.data.conditionalFields, formState.errors, handleChange, addNewChoiceValue]);

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

        {formState.errors.submit && (
          <div className="alert alert-error mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formState.errors.submit}</span>
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
                    <span className="label-text font-medium pb-1">Nom du projet <span className="text-error">*</span></span>
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
                      value={formState.data.nom_projet}
                      onChange={handleChange}
                      placeholder="Saisir le nom du projet"
                      className={`input input-bordered w-full ${formState.errors.nom_projet ? 'input-error' : ''}`}
                      required
                    />
                  </div>
                  {formState.errors.nom_projet && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formState.errors.nom_projet}</span>
                    </label>
                  )}
                </div>

                {/* Numéro du projet */}
                <div className="form-control w-full mb-4">
                  <label className="label" htmlFor="numero_projet">
                    <span className="label-text font-medium pb-1">Numéro du projet <span className="text-error">*</span></span>
                  </label>
                  <input
                    type="text"
                    id="numero_projet"
                    name="numero_projet"
                    value={formState.data.numero_projet}
                    onChange={handleChange}
                    placeholder="PRJ-202401-001"
                    className={`input input-bordered w-full ${formState.errors.numero_projet ? 'input-error' : ''}`}
                    required
                  />
                  {formState.errors.numero_projet && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formState.errors.numero_projet}</span>
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
                    <span className="label-text font-medium pb-1">Contact principal <span className="text-error">*</span></span>
                  </label>
                  
                  <div className="join w-full">
                    <select
                      id="contact_principal"
                      name="contact_principal"
                      value={formState.data.contact_principal}
                      onChange={handleChange}
                      className={`select select-bordered join-item flex-1 ${formState.errors.contact_principal ? 'select-error' : ''}`}
                      required={true}
                      disabled={isLoading}
                    >
                      <option value="">Choisir un contact</option>
                      {contacts.map((contact) => {
                        const contactName = getFieldValue(contact, 'nom', 'name', 'prenom', 'label') || `Contact #${contact.id}`;
                        const contactPrenom = getFieldValue(contact, 'prenom', 'first_name', 'firstname');
                        const fullName = contactPrenom ? `${contactPrenom} ${contactName}` : contactName;
                        
                        return (
                          <option key={contact.id} value={contact.id}>
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
                  
                  {formState.errors.contact_principal && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formState.errors.contact_principal}</span>
                    </label>
                  )}
                </div>

                {/* Note sur l'équipe */}
                <div className="form-control w-full mb-4">
                  <div className="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div>
                      <p className="font-medium">Équipe du projet</p>
                      <p className="text-sm">L'équipe sera automatiquement associée à celle du contact principal.</p>
                      {formState.data.contact_principal && contacts.length > 0 && (
                        <div className="mt-1">
                          {(() => {
                            const selectedContact = contacts.find(c => c.id.toString() === formState.data.contact_principal.toString());
                            if (selectedContact) {
                              const contactEquipe = getFieldValue(selectedContact, 'equipe', 'team', 'groupe', 'group');
                              if (contactEquipe && contactEquipe.trim() !== '') {
                                return <span className="badge badge-primary">{contactEquipe}</span>;
                              } else {
                                return <span className="text-xs text-warning">Ce contact n'a pas d'équipe définie</span>;
                              }
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
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
                    <span className="label-text font-medium pb-1">Description du projet <span className="text-error">*</span></span>
                  </label>
                  <div className="w-full">
                    <textarea
                      id="description"
                      name="description"
                      value={formState.data.description}
                      onChange={handleChange}
                      placeholder="Ex : Étude sur la mutation X dans la cohorte Y, objectifs, contexte, enjeux..."
                      className={`textarea textarea-bordered h-32 w-full ${formState.errors.description ? 'textarea-error' : ''}`}
                      required
                    ></textarea>
                  </div>
                  {formState.errors.description && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formState.errors.description}</span>
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
                    <span className="label-text font-medium pb-1">Type de projet <span className="text-error">*</span></span>
                  </label>
                  <SelectWithAddOption
                    id="type_projet"
                    name="type_projet"
                    value={formState.data.type_projet}
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
                    className={formState.errors.type_projet ? 'select-error' : ''}
                    isLoading={isLoading}
                    isTypeMode={true}
                    onCreateType={addNewProjectType}
                    addButtonTitle="Créer un nouveau type de projet complet"
                    emptyMessage={<Link to="/admin/database/tables" className="link link-primary text-xs">Créer un type de projet</Link>}
                  />
                  {formState.errors.type_projet && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formState.errors.type_projet}</span>
                    </label>
                  )}
                </div>

                {/* Statut du projet */}
                <div className="form-control w-full mb-4">
                  <label className="label" htmlFor="statut">
                    <span className="label-text font-medium pb-1">Statut du projet <span className="text-error">*</span></span>
                  </label>
                  <select
                    id="statut"
                    name="statut"
                    value={formState.data.statut}
                    onChange={handleChange}
                    className={`select select-bordered w-full ${formState.errors.statut ? 'select-error' : ''}`}
                    required
                  >
                    <option value="Non commencé">🔄 Non commencé</option>
                    <option value="En cours">⚡ En cours</option>
                    <option value="Terminé">✅ Terminé</option>
                    <option value="En attente">⏸️ En attente</option>
                    <option value="Suspendu">⚠️ Suspendu</option>
                  </select>
                  {formState.errors.statut && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formState.errors.statut}</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Section: Champs conditionnels */}
              {renderConditionalFields()}

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
                  className={`btn btn-primary ${formState.isSubmitting ? 'loading' : ''}`}
                  disabled={formState.isSubmitting}
                >
                  {formState.isSubmitting ? 'Modification...' : 'Modifier le projet'}
                </button>
              </div>
            </form>

            {/* Section: Documents PDF - EN DEHORS du formulaire pour éviter les conflits */}
            <div className="mt-8">
              <div className="divider"></div>
              <h2 className="card-title text-2xl mb-6 flex items-center gap-2">
                📄 Documents PDF
              </h2>
              <PdfManager 
                projectId={projectId}
                readonly={false}
              />
            </div>
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