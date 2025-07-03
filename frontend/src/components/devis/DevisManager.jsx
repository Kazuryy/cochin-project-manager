import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { devisService } from '../../services/devisService';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../common/Toast';
import { useAuthErrorHandler } from '../../hooks/authContext';

function DevisManager({ projectId, readonly = false }) {
  const [devisList, setDevisList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDevis, setEditingDevis] = useState(null);
  const [formData, setFormData] = useState({
    numero_devis: '',
    montant: '',
    statut: false,
    date_debut: '',
    date_rendu: '',
    agent_plateforme: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const { toasts, addToast, removeToast } = useToast();
  const { handleError } = useAuthErrorHandler();

  // Fonction utilitaire pour extraire les valeurs (version globale)
  const getFieldValue = (record, ...possibleFields) => {
    if (!record) return '';
    
    // Essayer d'abord les propriétés directes
    for (const field of possibleFields) {
      if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
        return record[field];
      }
    }
    
    // Si record.values existe et est un array, chercher dedans
    if (record.values && Array.isArray(record.values)) {
      for (const field of possibleFields) {
        const valueField = record.values.find(v => 
          v.field_slug === field || 
          v.field_name === field ||
          (v.field && v.field.slug === field) ||
          (v.field && v.field.name === field)
        );
        if (valueField?.value !== undefined && valueField.value !== null && valueField.value !== '') {
          return valueField.value;
        }
      }
    }
    
    return '';
  };

  // Fonction pour normaliser les valeurs boolean
  const normalizeBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'oui' || lowerValue === 'yes';
    }
    if (typeof value === 'number') return value === 1;
    return false;
  };

  // Fonction pour afficher les toasts - utilise maintenant le nouveau système
  const showToast = useCallback((message, type = 'info') => {
    addToast(message, type);
  }, [addToast]);

  // Charger les devis du projet
  const loadDevis = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const devis = await devisService.getDevisByProject(projectId);
      setDevisList(devis);
      console.log(`✅ ${devis.length} devis chargés pour le projet ${projectId}`);
    } catch (error) {
      console.error('Erreur lors du chargement des devis:', error);
      showToast('Erreur lors du chargement des devis', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  // Charger les devis au montage du composant
  useEffect(() => {
    loadDevis();
  }, [loadDevis]);

  // Réinitialiser le formulaire
  const resetForm = () => {
    setFormData({
      numero_devis: '',
      montant: '',
      statut: false,
      date_debut: '',
      date_rendu: '',
      agent_plateforme: ''
    });
    setFormErrors({});
    setEditingDevis(null);
    setShowAddForm(false);
  };

  // Valider le formulaire
  const validateForm = () => {
    const errors = {};
    
    if (!formData.numero_devis.trim()) {
      errors.numero_devis = 'Le numéro de devis est requis';
    }
    
    if (!formData.montant || isNaN(formData.montant) || parseFloat(formData.montant) <= 0) {
      errors.montant = 'Le montant doit être un nombre positif';
    }
    
    return validateConditionalFields(errors);
  };

  // Valider les champs conditionnels
  const validateConditionalFields = (errors) => {
    if (!formData.statut) return errors;
    
    if (!formData.date_debut) {
      errors.date_debut = 'Date de début requise quand le devis est actif';
    }
    if (!formData.date_rendu) {
      errors.date_rendu = 'Date de rendu requise quand le devis est actif';
    }
    if (!formData.agent_plateforme.trim()) {
      errors.agent_plateforme = 'Agent de plateforme requis quand le devis est actif';
    }
    
    if (formData.date_debut && formData.date_rendu && formData.date_debut >= formData.date_rendu) {
      errors.date_rendu = 'La date de rendu doit être après la date de début';
    }
    
    return errors;
  };

  // Gérer les changements dans le formulaire
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({ ...prev, [name]: newValue }));
    
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    if (name === 'statut' && !checked) {
      setFormData(prev => ({
        ...prev,
        date_debut: '',
        date_rendu: '',
        agent_plateforme: ''
      }));
    }
  };

  // Sauvegarder le devis
  const handleSaveDevis = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    await saveDevisData();
  };

  // Logique de sauvegarde des données
  const saveDevisData = async () => {
    try {
      setSaving(true);
      setFormErrors({});

      let result;
      if (editingDevis) {
        result = await devisService.updateDevis(editingDevis.id, formData);
      } else {
        result = await devisService.createDevisForProject(projectId, formData);
      }

      console.log('Devis sauvegardé:', result);
      showToast('Devis sauvegardé avec succès!', 'success');
      resetForm();
      loadDevis(); // Recharger la liste

    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      
      // Utiliser le gestionnaire d'erreur d'authentification
      if (handleError(error)) {
        // L'erreur d'authentification a été gérée automatiquement
        return;
      }
      
      // Gérer les autres types d'erreurs
      if (error.message.includes('Date de début requise')) {
        setFormErrors({ date_debut: 'Date de début requise quand le devis est actif' });
      } else if (error.message.includes('Date de rendu requise')) {
        setFormErrors({ date_rendu: 'Date de rendu requise quand le devis est actif' });
      } else if (error.message.includes('Agent de plateforme requis')) {
        setFormErrors({ agent_plateforme: 'Agent de plateforme requis quand le devis est actif' });
      } else {
        showToast('Erreur lors de la sauvegarde du devis', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  // Modifier un devis
  const handleEditDevis = (devis) => {
    const numeroDevis = getFieldValue(devis, 'numero_devis', 'numero', 'number');
    const montant = getFieldValue(devis, 'montant', 'amount');
    const statut = getFieldValue(devis, 'statut', 'status', 'etat', 'state');
    const dateDebut = getFieldValue(devis, 'date_debut', 'date_start', 'start_date');
    const dateRendu = getFieldValue(devis, 'date_rendu', 'date_end', 'end_date', 'date_fin');
    const agentPlateforme = getFieldValue(devis, 'agent_plateforme', 'agent', 'platform_agent');

    setFormData({
      numero_devis: numeroDevis || '',
      montant: montant || '',
      statut: normalizeBoolean(statut),
      date_debut: dateDebut || '',
      date_rendu: dateRendu || '',
      agent_plateforme: agentPlateforme || ''
    });
    setEditingDevis(devis);
    setShowAddForm(true);
  };

  // Supprimer un devis
  const handleDeleteDevis = async (devis) => {
    // Vérifier que le devis existe et a un ID
    if (!devis || !devis.id) {
      console.error('❌ Erreur: Devis invalide ou sans ID:', devis);
      showToast('Erreur: Devis invalide', 'error');
      return;
    }
    
    const numeroDevis = getFieldValue(devis, 'numero_devis', 'numero', 'number') || `Devis #${devis.id}`;
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le devis "${numeroDevis}" ?`)) {
      return;
    }
    
    setLoading(true);
    try {
      await devisService.deleteDevisFromProject(projectId, devis.id);
      showToast('Devis supprimé avec succès', 'success');
      await loadDevis();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Calculer le statut d'avancement d'un devis
  const getDevisProgress = (devis) => {
    const statutRaw = getFieldValue(devis, 'statut', 'status', 'etat', 'state');
    const dateDebut = getFieldValue(devis, 'date_debut', 'date_start', 'start_date');
    const dateRendu = getFieldValue(devis, 'date_rendu', 'date_end', 'end_date', 'date_fin');
    
    // Normaliser le statut boolean
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
      return { status: 'OFF', progress: 0, color: 'bg-gray-400' };
    }
    
    if (!dateDebut || !dateRendu) {
      return { status: 'Configuré', progress: 25, color: 'bg-blue-400' };
    }
    
    try {
      const now = new Date();
      const debut = new Date(dateDebut);
      const fin = new Date(dateRendu);
      
      // Vérifier que les dates sont valides
      if (isNaN(debut.getTime()) || isNaN(fin.getTime())) {
        return { status: 'Configuré', progress: 25, color: 'bg-blue-400' };
      }
      
      if (now < debut) {
        return { status: 'À venir', progress: 50, color: 'bg-yellow-400' };
      } else if (now >= debut && now <= fin) {
        const totalDuration = fin - debut;
        const elapsed = now - debut;
        const progressPercent = Math.min(100, Math.max(50, ((elapsed / totalDuration) * 50) + 50));
        return { status: 'En cours', progress: progressPercent, color: 'bg-blue-600' };
      } else {
        return { status: 'Terminé', progress: 100, color: 'bg-green-600' };
      }
    } catch (error) {
      console.error('Erreur lors du calcul de progression:', error);
      return { status: 'Configuré', progress: 25, color: 'bg-blue-400' };
    }
  };

  // Formater l'affichage des dates
  const formatDateRange = (dateDebut, dateRendu) => {
    try {
      const startDate = new Date(dateDebut);
      const endDate = new Date(dateRendu);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        return `${startDate.toLocaleDateString('fr-FR')} → ${endDate.toLocaleDateString('fr-FR')}`;
      }
      return `${dateDebut} → ${dateRendu}`;
    } catch {
      return `${dateDebut} → ${dateRendu}`;
    }
  };



  // Déterminer le texte du bouton de soumission
  const getSubmitButtonText = () => {
    if (loading) return 'Sauvegarde...';
    if (editingDevis) return 'Modifier';
    return 'Créer';
  };

  // Rendu du contenu principal des devis
  const renderDevisContent = () => {
    if (loading && !showAddForm) {
      return (
        <div className="flex justify-center p-4">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      );
    }
    
    if (devisList.length === 0) {
      return (
        <div className="text-center p-8 text-base-content/60">
          <div className="text-4xl mb-4">📋</div>
          <p>Aucun devis pour ce projet</p>
          {!readonly && (
            <button
              className="btn btn-outline btn-sm mt-4"
              onClick={() => setShowAddForm(true)}
            >
              Créer le premier devis
            </button>
          )}
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {devisList.map((devis) => {
          // Vérifier que le devis existe et a un ID valide
          if (!devis || !devis.id) {
            console.warn('⚠️ Devis sans ID ignoré:', devis);
            return null;
          }
          
          const numeroDevis = getFieldValue(devis, 'numero_devis', 'numero', 'number') || `Devis #${devis.id}`;
          const montant = getFieldValue(devis, 'montant', 'amount');
          const agentPlateforme = getFieldValue(devis, 'agent_plateforme', 'agent', 'platform_agent');
          const dateDebut = getFieldValue(devis, 'date_debut', 'date_start', 'start_date');
          const dateRendu = getFieldValue(devis, 'date_rendu', 'date_end', 'end_date', 'date_fin');
          const progress = getDevisProgress(devis);
          
          return (
            <div key={devis.id} className="card bg-base-200 shadow-sm">
              <div className="card-body p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-lg">{numeroDevis}</h4>
                      <div className={`badge badge-sm text-white ${progress.color}`}>
                        {progress.status}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Montant:</span>
                        <div className="text-lg font-bold text-primary">
                          {montant ? `${parseFloat(montant).toLocaleString('fr-FR')} €` : 'Non défini'}
                        </div>
                      </div>
                      
                      {agentPlateforme && (
                        <div>
                          <span className="font-medium">Agent:</span>
                          <div>{agentPlateforme}</div>
                        </div>
                      )}
                      
                      {dateDebut && dateRendu && (
                        <div>
                          <span className="font-medium">Période:</span>
                          <div>
                            {formatDateRange(dateDebut, dateRendu)}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Barre de progression */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Avancement</span>
                        <span>{Math.round(progress.progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${progress.color}`}
                          style={{ width: `${progress.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  {!readonly && (
                    <div className="flex gap-2 ml-4">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleEditDevis(devis)}
                        disabled={loading}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-ghost btn-sm text-error"
                        onClick={() => handleDeleteDevis(devis)}
                        disabled={loading}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="card bg-base-100 shadow-lg">
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      <div className="card-body">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="card-title text-xl">
            💰 Devis du projet
            {devisList.length > 0 && (
              <div className="badge badge-primary">{devisList.length}</div>
            )}
          </h3>
          
          {!readonly && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddForm(true)}
              disabled={loading}
            >
              ➕ Ajouter un devis
            </button>
          )}
        </div>

        {/* Liste des devis */}
        {renderDevisContent()}

        {/* Formulaire d'ajout/modification */}
        {showAddForm && !readonly && (
          <div className="card bg-base-300 mt-6">
            <div className="card-body">
              <h4 className="card-title">
                {editingDevis ? '✏️ Modifier le devis' : '➕ Nouveau devis'}
              </h4>
              
              <form onSubmit={handleSaveDevis} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Numéro de devis */}
                  <div className="form-control">
                    <label className="label" htmlFor="numero_devis">
                      <span className="label-text font-medium">
                        Numéro de devis <span className="text-error">*</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      name="numero_devis"
                      value={formData.numero_devis}
                      onChange={handleFormChange}
                      placeholder="Ex: DEV-2024-001"
                      className={`input input-bordered ${formErrors.numero_devis ? 'input-error' : ''}`}
                      required
                    />
                    {formErrors.numero_devis && (
                      <label className="label">
                        <span className="label-text-alt text-error">{formErrors.numero_devis}</span>
                      </label>
                    )}
                  </div>

                  {/* Montant */}
                  <div className="form-control">
                    <label className="label" htmlFor="montant">
                      <span className="label-text font-medium">
                        Montant (€) <span className="text-error">*</span>
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="montant"
                      value={formData.montant}
                      onChange={handleFormChange}
                      placeholder="Ex: 15000.00"
                      className={`input input-bordered ${formErrors.montant ? 'input-error' : ''}`}
                      required
                    />
                    {formErrors.montant && (
                      <label className="label">
                        <span className="label-text-alt text-error">{formErrors.montant}</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Statut */}
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3" htmlFor="statut" aria-label="Activer ou désactiver le devis">
                    <input
                      type="checkbox"
                      id="statut"
                      name="statut"
                      checked={formData.statut}
                      onChange={handleFormChange}
                      className="toggle toggle-primary"
                    />
                    <div>
                      <span className="label-text font-medium">
                        Devis actif (ON)
                      </span>
                      <div className="text-xs text-base-content/60">
                        Si activé, les champs date et agent sont obligatoires
                      </div>
                    </div>
                  </label>
                </div>

                {/* Champs conditionnels (si statut = true) */}
                {formData.statut && (
                  <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                    <h5 className="font-medium mb-3 text-primary">📅 Informations de planification</h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Date de début */}
                      <div className="form-control">
                        <label className="label" htmlFor="date_debut">
                          <span className="label-text font-medium">
                            Date de début <span className="text-error">*</span>
                          </span>
                        </label>
                        <input
                          type="date"
                          name="date_debut"
                          value={formData.date_debut}
                          onChange={handleFormChange}
                          className={`input input-bordered ${formErrors.date_debut ? 'input-error' : ''}`}
                          required={formData.statut}
                        />
                        {formErrors.date_debut && (
                          <label className="label">
                            <span className="label-text-alt text-error">{formErrors.date_debut}</span>
                          </label>
                        )}
                      </div>

                      {/* Date de rendu */}
                      <div className="form-control">
                        <label className="label" htmlFor="date_rendu">
                          <span className="label-text font-medium">
                            Date de rendu <span className="text-error">*</span>
                          </span>
                        </label>
                        <input
                          type="date"
                          name="date_rendu"
                          value={formData.date_rendu}
                          onChange={handleFormChange}
                          className={`input input-bordered ${formErrors.date_rendu ? 'input-error' : ''}`}
                          required={formData.statut}
                        />
                        {formErrors.date_rendu && (
                          <label className="label">
                            <span className="label-text-alt text-error">{formErrors.date_rendu}</span>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Agent de plateforme */}
                    <div className="form-control mt-4">
                      <label className="label" htmlFor="agent_plateforme">
                        <span className="label-text font-medium">
                          Agent de plateforme <span className="text-error">*</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        name="agent_plateforme"
                        value={formData.agent_plateforme}
                        onChange={handleFormChange}
                        placeholder="Ex: Jean Dupont"
                        className={`input input-bordered ${formErrors.agent_plateforme ? 'input-error' : ''}`}
                        required={formData.statut}
                      />
                      {formErrors.agent_plateforme && (
                        <label className="label">
                          <span className="label-text-alt text-error">{formErrors.agent_plateforme}</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className={`btn btn-primary ${saving ? 'loading' : ''}`}
                    disabled={saving}
                  >
                    {getSubmitButtonText()}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

DevisManager.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  readonly: PropTypes.bool
};

export default DevisManager; 