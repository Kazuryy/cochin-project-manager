import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDynamicTables } from '../contexts/hooks/useDynamicTables';
import { DynamicTableProvider } from '../contexts/DynamicTableProvider';
import SelectWithAddOption from '../components/SelectWithAddOption';
import DevisManager from '../components/devis/DevisManager';
import PdfManager from '../components/pdf/PdfManager';
import { typeService } from '../services/typeService';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/common/Toast';

import api from '../services/api';

// 1. Extraction des constantes
const DEFAULT_PROJECT_STATUS = 'Non commencé';
const TOAST_DURATION = 2000;
const EMPTY_CONTACT = {
  prenom: '',
  nom: '',
  email: '',
  equipe: ''
};

function CreateProjectContent() {
  const navigate = useNavigate();
  const { tables, fetchTables, fetchRecords, createRecord, isLoading } = useDynamicTables();
  
  // 2. Optimisation des hooks personnalisés
  const useProjectForm = (initialData) => {
    const [formData, setFormData] = useState(initialData);
    const [errors, setErrors] = useState({});
    
    const validateField = useCallback((name, value) => {
      // Logique de validation centralisée
      if (!value && name !== 'email') {
        return `${name} est requis`;
      }
      return '';
    }, []);
    
    return [formData, setFormData, errors, setErrors, validateField];
  };

  const [formData, setFormData, formErrors, setFormErrors] = useProjectForm({
    nom_projet: '',
    numero_projet: '',
    contact_principal: '',
    type_projet: '',
    description: '',
    statut: DEFAULT_PROJECT_STATUS, // Valeur par défaut
    // Champs conditionnels dynamiques
    conditionalFields: {}
  });
  
  // Nous avons retiré le hook de persistance du formulaire car il ne fonctionne pas correctement
  
  const [successMessage, setSuccessMessage] = useState('');
  const [contacts, setContacts] = useState([]);
  const [projectTypes, setProjectTypes] = useState([]);
  const [projectTableId, setProjectTableId] = useState(null);
  const [contactTableId, setContactTableId] = useState(null);
  const [tableNamesTableId, setTableNamesTableId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  
  // États pour les champs conditionnels
  const [conditionalFields, setConditionalFields] = useState([]);
  
  // États pour la modal d'ajout de contact personnalisée
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactData, setNewContactData] = useState(EMPTY_CONTACT);
  const [uniqueEquipes, setUniqueEquipes] = useState([]);

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

  // État pour le projet créé (pour les devis)
  const [createdProject, setCreatedProject] = useState(null);
  const [showDevisSection, setShowDevisSection] = useState(false);
  const [showDevisChoice, setShowDevisChoice] = useState(false);
  const [isManagingDevis, setIsManagingDevis] = useState(false);

  // Nous avons supprimé les fonctions liées à la restauration des données

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
            
            // Extraire les équipes uniques
            const equipes = new Set();
            (contactData || []).forEach(contact => {
              const equipe = getFieldValue(contact, 'equipe', 'team', 'groupe', 'group');
              if (equipe && typeof equipe === 'string' && equipe.trim() !== '') {
                equipes.add(equipe.trim());
              }
            });
            setUniqueEquipes(Array.from(equipes).sort());
          }).catch(err => {
            console.error('Erreur lors du chargement des contacts:', err);
          });
        } catch (err) {
          console.error('Erreur lors du chargement des contacts:', err);
        }
      }
    };
    loadContacts();
  }, [contactTableId, fetchRecords, getFieldValue]);
  
  // Nous avons supprimé l'effet qui mettait à jour l'équipe car elle sera maintenant gérée automatiquement côté backend

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

  // Nouvelle fonction pour trouver la table Details correspondant au type
  const findDetailsTable = useCallback((typeName) => {
    const detailsTableName = `${typeName}Details`;
    return tables.find(table => 
      table.name === detailsTableName ||
      table.name.toLowerCase() === detailsTableName.toLowerCase()
    );
  }, [tables]);

  // Nouvelle fonction pour transformer les champs de table en configuration d'affichage
  const transformTableFieldsToDisplayConfig = useCallback((fields) => {
    return fields
      .filter(field => {
        // Exclure les champs FK qui pointent vers la table Projet
        if (field.field_type === 'foreign_key' && field.related_table) {
          // Trouver la table Projet pour comparaison
          const projectTable = tables.find(t => 
            t.name === 'Projet' ||
            t.slug === 'projet' ||
            t.name === 'Projets' || 
            t.slug === 'projets'
          );
          
          // Si ce champ pointe vers la table Projet, l'exclure
          if (projectTable && field.related_table === projectTable.id) {
            console.log(`🚫 Champ FK vers Projet exclu: ${field.name} (sera géré automatiquement)`);
            return false;
          }
        }
        return true;
      })
      .map(field => ({
        name: field.slug,
        label: field.name,
        required: field.is_required,
        field_type: field.field_type,
        related_table: field.related_table,
        related_field: field.related_field,
        options: [] // Les options seront chargées pour les FK et choice fields
      }));
  }, [tables]);

  // Fonction pour charger les options d'un champ FK
  const loadFieldOptions = useCallback(async (field) => {
    if (field.field_type === 'foreign_key' && field.related_table) {
      try {
        // Récupérer le type sélectionné pour déduire la bonne colonne
        const selectedType = findSelectedType(formData.type_projet);
        
        if (!selectedType) {
          return [];
        }

        const typeName = getFieldValue(selectedType, 'nom', 'name', 'title', 'titre', 'label');
        
        if (!typeName) {
          return [];
        }

        // Charger les champs de la table Choix pour identifier la bonne colonne
        const choixTableData = await fetchTableData(field.related_table);
        console.log('🎯 Champs de la table Choix:', choixTableData.fields);
        console.log('📋 Table Choix ID utilisé:', field.related_table);
        console.log('📋 Réponse fetchTableData complète:', choixTableData);
        
        if (!choixTableData.fields || choixTableData.fields.length === 0) {
          return [];
        }

        // Utiliser la même logique de déduction que dans addNewOption
        let targetField = null;
        
        // 1. Chercher un champ qui combine le nom du champ + type
        const fieldLabelClean = field.label.toLowerCase();
        const typeNameClean = typeName.toLowerCase();
        
        const combinedPatterns = [
          `${fieldLabelClean} ${typeNameClean}`,      // "sous type prestation"
          `${fieldLabelClean}_${typeNameClean}`,      // "sous_type_prestation"
          `${typeNameClean}_${fieldLabelClean}`,      // "prestation_sous_type"
          `${fieldLabelClean}${typeNameClean}`,       // "soustypeprestation"
        ];

        for (const pattern of combinedPatterns) {
          targetField = choixTableData.fields.find(choixField => 
            choixField.slug.toLowerCase().includes(pattern.replace(' ', '_')) ||
            choixField.name.toLowerCase().includes(pattern) ||
            choixField.slug.toLowerCase() === pattern.replace(' ', '_')
          );
          if (targetField) {
            break;
          }
        }

        // 2. Si pas trouvé, chercher par nom de champ seul
        if (!targetField) {
          const fieldPatterns = [
            fieldLabelClean,
            fieldLabelClean.replace(' ', '_'),
            field.name.toLowerCase(),
            field.name.toLowerCase().replace(' ', '_')
          ];

          for (const pattern of fieldPatterns) {
            targetField = choixTableData.fields.find(choixField => 
              choixField.slug.toLowerCase() === pattern ||
              choixField.name.toLowerCase() === pattern ||
              choixField.slug.toLowerCase().includes(pattern) ||
              choixField.name.toLowerCase().includes(pattern)
            );
            if (targetField) {
              break;
            }
          }
        }

        // 3. Si toujours pas trouvé, utiliser le premier champ text disponible
        if (!targetField) {
          targetField = choixTableData.fields.find(choixField => 
            ['text', 'long_text'].includes(choixField.field_type)
          );
        }

        if (!targetField) {
          return [];
        }

        // Maintenant charger tous les enregistrements et extraire les valeurs de la colonne spécifique
        const response = await fetch(`/api/database/records/by_table/?table_id=${field.related_table}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Erreur lors du chargement des options FK');
        const records = await response.json();
        
        // Extraire les valeurs de la colonne spécifique et supprimer les doublons
        const uniqueValues = new Set();
        const options = [];
        
        const recordsList = records.results || records;
        
        recordsList.forEach((record) => {
          const extractedValue = getFieldValue(record, targetField.slug);
          
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

        return options.sort((a, b) => a.label.localeCompare(b.label));
        
      } catch (error) {
        console.error('Erreur lors du chargement des options FK:', error);
        return [];
      }
    } else if (field.field_type === 'choice' && field.options) {
      // Traiter les options statiques s'il y en a
      try {
        const options = typeof field.options === 'string' 
          ? JSON.parse(field.options) 
          : field.options;
        return Array.isArray(options) 
          ? options.map(opt => ({ value: opt, label: opt }))
          : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [getFieldValue, findSelectedType, formData.type_projet, fetchTableData]);

  // Fonction principale pour recharger les champs basés sur la table Details
  const reloadConditionalFields = useCallback(async () => {
    if (!formData.type_projet || !projectTypes.length) {
      setConditionalFields([]);
      return;
    }

    try {
      const selectedType = findSelectedType(formData.type_projet);
      
      if (!selectedType) {
        setConditionalFields([]);
        return;
      }

      const typeName = getFieldValue(selectedType, 'nom', 'name', 'title', 'titre', 'label');
      
      if (!typeName) {
        setConditionalFields([]);
        return;
      }

      // Trouver la table Details correspondante
      const detailsTable = findDetailsTable(typeName);
      
      if (!detailsTable) {
        setConditionalFields([]);
        return;
      }

      // Charger les champs de la table Details
      const tableData = await fetchTableData(detailsTable.id);
      
      if (!tableData.fields || tableData.fields.length === 0) {
        setConditionalFields([]);
        return;
      }

      // Transformer les champs en configuration d'affichage
      const fieldsConfig = transformTableFieldsToDisplayConfig(tableData.fields);
      
      // Charger les options pour chaque champ qui en a besoin
      const fieldsWithOptions = await Promise.all(
        fieldsConfig.map(async (field) => {
          const options = await loadFieldOptions(field);
          return {
            ...field,
            options
          };
        })
      );

      setConditionalFields(fieldsWithOptions);

      // Réinitialiser les champs conditionnels quand on change de type
      setFormData(prev => ({
        ...prev,
        conditionalFields: {}
      }));

    } catch (err) {
      console.error('❌ Erreur lors du chargement des champs depuis la table Details:', err);
      setConditionalFields([]);
    }
  }, [formData.type_projet, projectTypes, findSelectedType, getFieldValue, findDetailsTable, fetchTableData, transformTableFieldsToDisplayConfig, loadFieldOptions, setFormData]);

  // Logique pour les champs conditionnels
  useEffect(() => {
    reloadConditionalFields();
  }, [reloadConditionalFields]);

  // Fonction pour ouvrir la modal contact personnalisée
  const openAddContactModal = () => {
    setNewContactData(EMPTY_CONTACT);
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
            setNewContactData(EMPTY_CONTACT);
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

  // Fonction pour ajouter une nouvelle option (mise à jour pour les champs Details)
  const addNewOption = async (fieldName, optionLabel) => {
    if (!optionLabel.trim()) {
      showToast('Veuillez remplir le libellé', 'error');
      return;
    }

    try {
      // Trouver le champ correspondant
      const currentField = conditionalFields.find(field => field.name === fieldName);
      if (!currentField) {
        showToast('Champ non trouvé', 'error');
        return;
      }

      // Pour les champs FK, ajouter dans la table liée
      if (currentField.field_type === 'foreign_key' && currentField.related_table) {
        try {
          // Récupérer le type sélectionné pour déduire le nom de colonne
          const selectedType = findSelectedType(formData.type_projet);
          if (!selectedType) {
            showToast('Type de projet non sélectionné', 'error');
            return;
          }

          const typeName = getFieldValue(selectedType, 'nom', 'name', 'title', 'titre', 'label');
          if (!typeName) {
            showToast('Nom du type non trouvé', 'error');
            return;
          }

          // Charger les champs de la table Choix pour trouver la bonne colonne
          const choixTableData = await fetchTableData(currentField.related_table);
          console.log('🎯 Champs de la table Choix:', choixTableData.fields);
          console.log('📋 Table Choix ID utilisé:', currentField.related_table);
          console.log('📋 Réponse fetchTableData complète:', choixTableData);
          
          if (!choixTableData.fields || choixTableData.fields.length === 0) {
            showToast('Aucun champ trouvé dans la table Choix', 'error');
            return;
          }

          // Stratégie de déduction du bon champ dans la table Choix
          let targetField = null;
          
          // 1. Chercher un champ qui combine le nom du champ + type
          // Ex: "Sous type Prestation", "Qualité Formation"
          const fieldLabelClean = currentField.label.toLowerCase();
          const typeNameClean = typeName.toLowerCase();
          
          const combinedPatterns = [
            `${fieldLabelClean} ${typeNameClean}`,      // "sous type prestation"
            `${fieldLabelClean}_${typeNameClean}`,      // "sous_type_prestation"
            `${typeNameClean}_${fieldLabelClean}`,      // "prestation_sous_type"
            `${fieldLabelClean}${typeNameClean}`,       // "soustypeprestation"
          ];

          for (const pattern of combinedPatterns) {
            targetField = choixTableData.fields.find(field => 
              field.slug.toLowerCase().includes(pattern.replace(' ', '_')) ||
              field.name.toLowerCase().includes(pattern) ||
              field.slug.toLowerCase() === pattern.replace(' ', '_')
            );
            if (targetField) {
              console.log(`✅ Champ trouvé avec pattern "${pattern}":`, targetField);
              break;
            }
          }

          // 2. Si pas trouvé, chercher par nom de champ seul
          if (!targetField) {
            const fieldPatterns = [
              fieldLabelClean,
              fieldLabelClean.replace(' ', '_'),
              currentField.name.toLowerCase(),
              currentField.name.toLowerCase().replace(' ', '_')
            ];

            for (const pattern of fieldPatterns) {
              targetField = choixTableData.fields.find(field => 
                field.slug.toLowerCase() === pattern ||
                field.name.toLowerCase() === pattern ||
                field.slug.toLowerCase().includes(pattern) ||
                field.name.toLowerCase().includes(pattern)
              );
              if (targetField) {
                console.log(`✅ Champ trouvé avec pattern de champ "${pattern}":`, targetField);
                break;
              }
            }
          }

          // 3. Si toujours pas trouvé, utiliser le premier champ text disponible
          if (!targetField) {
            targetField = choixTableData.fields.find(field => 
              ['text', 'long_text'].includes(field.field_type)
            );
            console.log('⚠️ Aucun champ spécifique trouvé, utilisation du premier champ text:', targetField);
          }

          if (!targetField) {
            showToast('Aucun champ approprié trouvé dans la table Choix pour stocker la nouvelle option', 'error');
            return;
          }

          console.log('✅ Champ cible final sélectionné:', targetField);

          // Extraire l'ID correct de la table liée
          const relatedTableId = currentField.related_table?.id || currentField.related_table;
          
          console.log('📤 Données envoyées à l\'API:', {
            table_id: relatedTableId,
            values: {
              [targetField.slug]: optionLabel
            }
          });

          // Créer l'enregistrement avec le bon champ
          await api.post('/api/database/records/create_with_values/', {
            table_id: relatedTableId,
            values: {
              [targetField.slug]: optionLabel
            }
          });

          // Recharger les options pour ce champ
          const newOptions = await loadFieldOptions(currentField);
          
          // Mettre à jour la liste locale
          setConditionalFields(prev => prev.map(field => 
            field.name === fieldName 
              ? { ...field, options: newOptions }
              : field
          ));
          
          showToast(`Option "${optionLabel}" ajoutée avec succès dans ${targetField.name}`, 'success');
        } catch (error) {
          console.error('Erreur lors de l\'ajout de l\'option:', error);
          showToast(error.response?.data?.error || 'Erreur lors de l\'ajout de l\'option', 'error');
        }
      } else {
        showToast('Ce type de champ ne supporte pas l\'ajout d\'options dynamiques', 'warning');
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
    
    if (!formData.description.trim()) {
      errors.description = 'La description est requise';
    }
    
    if (!formData.statut) {
      errors.statut = 'Le statut est requis';
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
    
    // Protection anti-double-clic
    if (isSubmitting) {
      console.log('⚠️ Soumission déjà en cours, abandon...');
      return;
    }
    
    setIsSubmitting(true);
    setFormErrors({});
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsSubmitting(false); // Remettre à false en cas d'erreur
      return;
    }

    try {
      // Préparer les données du projet principal
      const projectData = {
        nom_projet: formData.nom_projet,
        numero_projet: formData.numero_projet || generateProjectNumber(),
        contact_principal: formData.contact_principal,
        type_projet: formData.type_projet,
        description: formData.description,
        statut: formData.statut
      };

      // Préparer les champs conditionnels pour la table Details
      const conditionalFieldsData = formData.conditionalFields;

      // Logs détaillés pour le débogage
      console.log('📤 === DONNÉES ENVOYÉES AU BACKEND ===');
      console.log('🏗️ Données projet:', projectData);
      console.log('⚙️ Champs conditionnels:', conditionalFieldsData);
      console.log('🎯 Type de projet ID:', formData.type_projet);
      console.log('📋 Configuration des champs conditionnels disponibles:');
      conditionalFields.forEach((field, index) => {
        console.log(`  ${index + 1}. ${field.label} (slug: ${field.name}, type: ${field.field_type})`);
      });

      // Utiliser le nouveau service transactionnel
      const result = await typeService.createProjectWithDetails(
        projectData,
        conditionalFieldsData,
        formData.type_projet
      );

      console.log('🔍 === RÉPONSE DU BACKEND ===');
      console.log('✅ Résultat complet:', result);
      console.log('✅ result.success:', result.success);
      console.log('✅ result.project:', result.project);
      console.log('✅ result.error:', result.error);
      
      if (result.success) {
        setSuccessMessage('Projet créé avec succès !');
        
        // Enregistrer le projet créé pour les devis (avec vérification défensive)
        // Les données du projet sont dans result.data, pas directement dans result
        const projectCreated = result.data?.project || result.project;
        if (projectCreated && projectCreated.id) {
          console.log('✅ Projet créé avec ID:', projectCreated.id);
          setCreatedProject({
            id: projectCreated.id,
            name: projectData.nom_projet
          });
          
          // Afficher la section de choix (devis ou dashboard)
          setShowDevisChoice(true);
        } else {
          // Si pas d'ID retourné, rediriger directement vers le dashboard
          console.warn('⚠️ Projet créé sans ID retourné, redirection vers dashboard');
          setTimeout(() => {
            navigate('/dashboard');
          }, 1500);
        }
        
        // Nous avons supprimé la sauvegarde des données
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Erreur lors de la création du projet:', error);
      setFormErrors({ 
        submit: error.message || 'Erreur lors de la création du projet. Veuillez réessayer.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showToast = (message, type = 'info', duration = TOAST_DURATION) => {
    addToast(message, type, duration);
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
        
        {/* Nous avons supprimé l'alerte de restauration des données */}

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
                      value={formData.nom_projet}
                      onChange={handleChange}
                      placeholder="Saisir le nom du projet"
                      className={`input input-bordered w-full join-item ${formErrors.nom_projet ? 'input-error' : ''}`}
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
                    <span className="label-text font-medium pb-1">Numéro du projet <span className="text-error">*</span></span>
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
                    <span className="label-text font-medium pb-1">Contact principal <span className="text-error">*</span></span>
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

                {/* Note sur l'équipe */}
                <div className="form-control w-full mb-4">
                  <div className="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div>
                      <p className="font-medium">Équipe du projet</p>
                      <p className="text-sm">L'équipe sera automatiquement associée à celle du contact principal.</p>
                      {formData.contact_principal && contacts.length > 0 && (
                        <div className="mt-1">
                          {(() => {
                            const selectedContact = contacts.find(c => c.id.toString() === formData.contact_principal.toString());
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
                    <span className="label-text font-medium  pb-1">Statut du projet <span className="text-error">*</span></span>
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
              {conditionalFields.length > 0 && (
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
                          
                          {field.field_type === 'decimal' && (
                            <input
                              type="number"
                              step="0.01"
                              id={fieldId}
                              name={fieldId}
                              value={fieldValue}
                              onChange={handleChange}
                              placeholder={`Saisir ${field.label.toLowerCase()}`}
                              className={`input input-bordered w-full ${fieldError ? 'input-error' : ''}`}
                              required={field.required}
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
                          
                          {field.field_type === 'datetime' && (
                            <input
                              type="datetime-local"
                              id={fieldId}
                              name={fieldId}
                              value={fieldValue}
                              onChange={handleChange}
                              className={`input input-bordered w-full ${fieldError ? 'input-error' : ''}`}
                              required={field.required}
                            />
                          )}
                          
                          {field.field_type === 'boolean' && (
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={fieldId}
                                name={fieldId}
                                checked={fieldValue === true || fieldValue === 'true'}
                                onChange={(e) => {
                                  const event = {
                                    target: {
                                      name: fieldId,
                                      value: e.target.checked
                                    }
                                  };
                                  handleChange(event);
                                }}
                                className="checkbox"
                              />
                              <span className="label-text">Oui</span>
                            </div>
                          )}
                          
                          {(field.field_type === 'choice' || field.field_type === 'foreign_key') && (
                            <SelectWithAddOption
                              id={fieldId}
                              name={fieldId}
                              value={fieldValue}
                              onChange={handleChange}
                              options={field.options.map(option => ({
                                value: option.value,
                                label: option.label
                              }))}
                              placeholder="Sélectionner..."
                              required={field.required}
                              className={fieldError ? 'select-error' : ''}
                              onAddOption={field.field_type === 'foreign_key' ? (optionLabel) => addNewOption(field.name, optionLabel) : undefined}
                              addButtonTitle={field.field_type === 'foreign_key' ? "Ajouter une nouvelle option" : undefined}
                            />
                          )}
                          
                          {fieldError && (
                            <label className="label">
                              <span className="label-text-alt text-error">
                                {fieldError}
                              </span>
                            </label>
                          )}
                        </div>
                      );
                    })}
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
                    <span className="label-text font-medium pb-1">Description du projet <span className="text-error">*</span></span>
                  </label>
                  <div className="w-full">
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Ex : Étude sur la mutation X dans la cohorte Y, objectifs, contexte, enjeux..."
                      className={`textarea textarea-bordered h-32 w-full ${formErrors.description ? 'textarea-error' : ''}`}
                      required
                    />
                  </div>
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
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Création...' : 'Créer le projet'}
                </button>
              </div>
            </form>

            {/* Section: Documents PDF - EN DEHORS du formulaire pour éviter les conflits */}
            {createdProject && (
              <div className="mt-8">
                <div className="divider"></div>
                <PdfManager 
                  projectId={createdProject.id}
                  readonly={false}
                />
              </div>
            )}
          </div>
        </div>

        {/* Section Choix après création - Devis ou Dashboard */}
        {showDevisChoice && createdProject && !isManagingDevis && (
          <div className="mt-8">
            <div className="alert alert-success mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-bold">Projet "{createdProject.name}" créé avec succès !</h3>
                <div className="text-sm">Que souhaitez-vous faire maintenant ?</div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body text-center">
                <h2 className="card-title justify-center mb-4">Prochaine étape</h2>
                <p className="mb-6 text-base-content/70">
                  Vous pouvez soit ajouter des devis à ce projet, soit retourner au tableau de bord pour voir tous vos projets.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={() => {
                      setIsManagingDevis(true);
                      setShowDevisSection(true);
                      setShowDevisChoice(false);
                      // Scroll vers la section devis
                      setTimeout(() => {
                        const devisSection = document.getElementById('devis-section');
                        if (devisSection) {
                          devisSection.scrollIntoView({ behavior: 'smooth' });
                        }
                      }, 100);
                    }}
                  >
                    📋 Ajouter des devis
                  </button>
                  
                  <button
                    className="btn btn-outline btn-lg"
                    onClick={() => navigate('/dashboard')}
                  >
                    📊 Retour au dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section Devis - Apparaît après avoir choisi de gérer les devis */}
        {showDevisSection && createdProject && isManagingDevis && (
          <div id="devis-section" className="mt-8">
            <div className="alert alert-info mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <h3 className="font-bold">Gestion des devis pour "{createdProject.name}"</h3>
                <div className="text-sm">Ajoutez autant de devis que nécessaire. Cliquez sur "J'ai terminé" quand vous avez fini.</div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => navigate('/dashboard')}
                >
                  ✅ J'ai terminé - Retour au dashboard
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => navigate(`/projects/${createdProject.id}`)}
                >
                  👁️ Voir le projet complet
                </button>
              </div>
            </div>
            
            <DevisManager 
              projectId={createdProject.id}
              readonly={false}
            />
          </div>
        )}

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

        {/* Toast Container */}
        <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

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
                  <div className="join w-full">
                    <input
                      type="text"
                      id="new_contact_equipe"
                      value={newContactData.equipe}
                      onChange={(e) => setNewContactData(prev => ({ ...prev, equipe: e.target.value }))}
                      placeholder="Ex: Équipe GenomiC"
                      className="input input-bordered join-item flex-1"
                      list="equipes-list"
                    />
                    <datalist id="equipes-list">
                      {uniqueEquipes.map((equipe, index) => (
                        <option key={index} value={equipe} />
                      ))}
                    </datalist>
                    {newContactData.equipe && (
                      <button
                        type="button"
                        className="btn btn-ghost join-item"
                        onClick={() => setNewContactData(prev => ({ ...prev, equipe: '' }))}
                        title="Effacer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {uniqueEquipes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {uniqueEquipes.map((equipe, index) => (
                        <button
                          key={index}
                          type="button"
                          className="badge badge-outline hover:bg-base-300 cursor-pointer"
                          onClick={() => setNewContactData(prev => ({ ...prev, equipe }))}
                        >
                          {equipe}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowAddContactModal(false);
                    setNewContactData(EMPTY_CONTACT);
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