import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDynamicTables } from '../contexts/hooks/useDynamicTables';
import { DynamicTableProvider } from '../contexts/DynamicTableProvider';

function CreateProjectContent() {
  const navigate = useNavigate();
  const { tables, fetchTables, fetchRecords, createRecord, isLoading } = useDynamicTables();
  
  const [formData, setFormData] = useState({
    nom_projet: '',
    numero_projet: '',
    contact_principal: '',
    type_projet: '',
    equipe: '',
    description: ''
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [contacts, setContacts] = useState([]);
  const [projectTypes, setProjectTypes] = useState([]);
  const [projectTableId, setProjectTableId] = useState(null);
  const [contactTableId, setContactTableId] = useState(null);
  const [tableNamesTableId, setTableNamesTableId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Charger les tables et identifier les IDs
  useEffect(() => {
    const loadTables = async () => {
      await fetchTables();
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
          const contactData = await fetchRecords(contactTableId);
          setContacts(contactData || []);
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
          const typeData = await fetchRecords(tableNamesTableId);
          setProjectTypes(typeData || []);
        } catch (err) {
          console.error('Erreur lors du chargement des types:', err);
        }
      }
    };
    loadProjectTypes();
  }, [tableNamesTableId, fetchRecords]);

  // Fonction utilitaire pour extraire les valeurs des champs dynamiques
  const getFieldValue = (record, ...possibleFields) => {
    if (!record) return '';
    
    for (const field of possibleFields) {
      if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
        return record[field];
      }
    }
    
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

  // Générer un numéro de projet automatique
  const generateProjectNumber = () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PRJ-${year}${month}-${random}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
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
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    if (!projectTableId) {
      setFormErrors({ submit: 'Impossible de trouver la table des projets' });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await createRecord(projectTableId, formData);
      
      if (result) {
        setSuccessMessage('Projet créé avec succès !');
        showToast('Projet créé avec succès !', 'success', 2000);
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      console.error('Erreur lors de la création du projet:', err);
      
      // Extraire le message d'erreur du backend
      let errorMessage = 'Une erreur est survenue lors de la création du projet';
      
      if (err?.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (typeof err.response.data === 'object') {
          // Si l'erreur est un objet avec des champs spécifiques
          const errors = [];
          Object.entries(err.response.data).forEach(([field, messages]) => {
            if (Array.isArray(messages)) {
              errors.push(`${field}: ${messages.join(', ')}`);
            } else {
              errors.push(`${field}: ${messages}`);
            }
          });
          errorMessage = errors.join('\n');
        }
      }

      // Debug supplémentaire
      console.log('Détails complets de l\'erreur:', {
        error: err,
        response: err?.response,
        data: err?.response?.data,
        message: err?.message,
        errorMessage
      });

      setFormErrors({
        submit: errorMessage
      });
      
      // Afficher aussi l'erreur dans un toast pour plus de visibilité
      showToast(errorMessage, 'error', 5000);
    } finally {
      setIsSubmitting(false);
    }
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
        
        {/* Header */}
        <div className="mb-8">
          <div className="breadcrumbs text-sm mb-4">
            <ul>
              <li><a href="/" className="link link-hover">Accueil</a></li>
              <li><a href="/dashboard" className="link link-hover">Projets</a></li>
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
                  <label className="label">
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
                      name="nom_projet"
                      value={formData.nom_projet}
                      onChange={handleChange}
                      placeholder="Saisir le nom du projet"
                      className={`input input-bordered w-full ${formErrors.nom_projet ? 'input-error' : ''}`}
                      required
                      aria-label="Nom du projet"
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
                  <label className="label">
                    <span className="label-text font-medium">Numéro du projet <span className="text-error">*</span></span>
                  </label>
                  <div className="join w-full">
                    <input
                      type="text"
                      name="numero_projet"
                      value={formData.numero_projet}
                      onChange={handleChange}
                      placeholder="PRJ-202401-001"
                      className={`input input-bordered join-item flex-1 ${formErrors.numero_projet ? 'input-error' : ''}`}
                      required
                      aria-label="Numéro du projet"
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
                  <label className="label">
                    <span className="label-text font-medium">Contact principal <span className="text-error">*</span></span>
                  </label>
                  <select
                    name="contact_principal"
                    value={formData.contact_principal}
                    onChange={handleChange}
                    className={`select select-bordered w-full ${formErrors.contact_principal ? 'select-error' : ''}`}
                    required
                    aria-label="Contact principal"
                  >
                    <option value="">Choisir un contact</option>
                    {contacts.length === 0 && isLoading ? (
                      <option disabled>Chargement...</option>
                    ) : contacts.map(contact => {
                      const nom = getFieldValue(contact, 'nom', 'last_name', 'lastname', 'name');
                      const prenom = getFieldValue(contact, 'prenom', 'first_name', 'firstname', 'fname');
                      const email = getFieldValue(contact, 'email', 'mail', 'e_mail');
                      const displayName = `${prenom} ${nom.toUpperCase()}`.trim() || `Contact #${contact.id}`;
                      const contactId = contact.id || getFieldValue(contact, 'id', 'contact_id');
                      
                      // Debug des valeurs du contact
                      console.log('Contact:', {
                        contact,
                        id: contactId,
                        nom,
                        prenom,
                        email,
                        displayName,
                        rawValues: contact.values
                      });
                      
                      return (
                        <option key={contactId} value={contactId}>
                          {displayName} {email && `(${email})`}
                        </option>
                      );
                    })}
                    {contacts.length === 0 && !isLoading && (
                      <div className="mt-2">
                        <a href="/admin/database/tables" className="link link-primary text-xs">Créer un contact</a>
                      </div>
                    )}
                  </select>
                  {formErrors.contact_principal && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formErrors.contact_principal}</span>
                    </label>
                  )}
                </div>

                {/* Équipe */}
                <div className="form-control w-full mb-4">
                  <label className="label">
                    <span className="label-text font-medium">Équipe <span className="text-error">*</span></span>
                  </label>
                  <input
                    type="text"
                    name="equipe"
                    value={formData.equipe}
                    onChange={handleChange}
                    placeholder="Ex: Équipe GenomiC"
                    className={`input input-bordered w-full ${formErrors.equipe ? 'input-error' : ''}`}
                    required
                    aria-label="Équipe"
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
                  <label className="label">
                    <span className="label-text font-medium">Type de projet <span className="text-error">*</span></span>
                  </label>
                  <select
                    name="type_projet"
                    value={formData.type_projet}
                    onChange={handleChange}
                    className={`select select-bordered w-full ${formErrors.type_projet ? 'select-error' : ''}`}
                    required
                    aria-label="Type de projet"
                  >
                    <option value="">Sélectionner un type</option>
                    {projectTypes.length === 0 && isLoading ? (
                      <option disabled>Chargement...</option>
                    ) : projectTypes.map(type => {
                      const typeName = getFieldValue(type, 'nom', 'name', 'title', 'titre', 'label') || `Type #${type.id}`;
                      const typeDescription = getFieldValue(type, 'description', 'desc');
                      
                      return (
                        <option key={type.id} value={type.id}>
                          {typeName} {typeDescription && `- ${typeDescription}`}
                        </option>
                      );
                    })}
                    {projectTypes.length === 0 && !isLoading && (
                      <div className="mt-2">
                        <a href="/admin/database/tables" className="link link-primary text-xs">Créer un type de projet</a>
                      </div>
                    )}
                  </select>
                  {formErrors.type_projet && (
                    <label className="label">
                      <span className="label-text-alt text-error">{formErrors.type_projet}</span>
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

                {/* Description */}
                <div className="form-control w-full mb-4">
                  <label className="label">
                    <span className="label-text font-medium">Description du projet <span className="text-error">*</span></span>
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Ex : Étude sur la mutation X dans la cohorte Y, objectifs, contexte, enjeux..."
                    className={`textarea textarea-bordered h-32 ${formErrors.description ? 'textarea-error' : ''}`}
                    required
                    aria-label="Description du projet"
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