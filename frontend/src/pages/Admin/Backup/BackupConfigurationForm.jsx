import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  FiSave, 
  FiX, 
  FiHelpCircle, 
  FiDatabase, 
  FiHardDrive, 
  FiShield, 
  FiClock,
  FiSettings
} from 'react-icons/fi';
import backupService from '../../../services/backupService';

// Constantes extraites du composant
const BACKUP_TYPE_OPTIONS = [
  { value: 'full', label: 'Complète', description: 'Métadonnées + données + fichiers' },
  { value: 'metadata', label: 'Métadonnées', description: 'Structure Django uniquement' },
  { value: 'data', label: 'Données', description: 'Contenu SQL natif uniquement' }
];

const FREQUENCY_OPTIONS = [
  { value: 'manual', label: 'Manuelle', description: 'Lancée uniquement à la demande' },
  { value: 'daily', label: 'Quotidienne', description: 'Tous les jours' },
  { value: 'weekly', label: 'Hebdomadaire', description: 'Toutes les semaines' },
  { value: 'monthly', label: 'Mensuelle', description: 'Tous les mois' }
];

const DEFAULT_FORM_DATA = {
  name: '',
  backup_type: 'full',
  frequency: 'manual',
  is_active: true,
  include_files: true,
  compression_enabled: true,
  retention_days: 30,
};

const BackupConfigurationForm = ({ 
  configuration = null, 
  onSave, 
  onCancel, 
  isOpen = false 
}) => {
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Charger les données de la configuration à éditer
  useEffect(() => {
    if (configuration) {
      setFormData({
        name: configuration.name || '',
        backup_type: configuration.backup_type || 'full',
        frequency: configuration.frequency || 'manual',
        is_active: configuration.is_active ?? true,
        include_files: configuration.include_files ?? true,
        compression_enabled: configuration.compression_enabled ?? true,
        retention_days: configuration.retention_days || 30,
      });
    } else {
      setFormData(DEFAULT_FORM_DATA);
    }
    setErrors({});
  }, [configuration, isOpen]);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }
    
    const retentionDays = parseInt(formData.retention_days, 10);
    if (isNaN(retentionDays) || retentionDays < 1) {
      newErrors.retention_days = 'La rétention doit être d\'au moins 1 jour';
    } else if (retentionDays > 365) {
      newErrors.retention_days = 'La rétention ne peut pas dépasser 365 jours';
    }
    
    if (!BACKUP_TYPE_OPTIONS.some(opt => opt.value === formData.backup_type)) {
      newErrors.backup_type = 'Type de sauvegarde invalide';
    }
    
    if (!FREQUENCY_OPTIONS.some(opt => opt.value === formData.frequency)) {
      newErrors.frequency = 'Fréquence invalide';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      let result;
      if (configuration) {
        result = await backupService.updateConfiguration(configuration.id, formData);
      } else {
        result = await backupService.createConfiguration(formData);
      }
      
      onSave(result);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setErrors({ submit: 'Erreur lors de la sauvegarde: ' + error.message });
    } finally {
      setLoading(false);
    }
  }, [configuration, formData, onSave, validateForm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-base-300">
          <h2 className="text-2xl font-bold flex items-center">
            <FiSettings className="mr-3 text-primary" />
            {configuration ? 'Modifier la configuration' : 'Nouvelle configuration'}
          </h2>
          <button 
            onClick={onCancel}
            className="btn btn-ghost btn-sm"
            disabled={loading}
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Erreur générale */}
          {errors.submit && (
            <div className="alert alert-error">
              <span>{errors.submit}</span>
            </div>
          )}

          {/* Nom de la configuration */}
          <div className="form-control">
            <label className="label" htmlFor="config-name">
              <span className="label-text font-semibold">Nom de la configuration *</span>
            </label>
            <input
              id="config-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`input input-bordered ${errors.name ? 'input-error' : ''}`}
              placeholder="Ex: Sauvegarde quotidienne complète"
              disabled={loading}
            />
            {errors.name && (
              <label className="label" htmlFor="config-name">
                <span className="label-text-alt text-error">{errors.name}</span>
              </label>
            )}
          </div>

          {/* Type de sauvegarde */}
          <div className="form-control">
            <label className="label" htmlFor="backup-type">
              <span className="label-text font-semibold flex items-center">
                <FiDatabase className="mr-2" />
                Type de sauvegarde
              </span>
            </label>
            <div className="grid grid-cols-1 gap-3">
              {BACKUP_TYPE_OPTIONS.map(option => (
                <label 
                  key={option.value} 
                  className="cursor-pointer" 
                  htmlFor={`backup-type-${option.value}`}
                  aria-label={`Type de sauvegarde: ${option.label}`}
                >
                  <input
                    id={`backup-type-${option.value}`}
                    type="radio"
                    name="backup_type"
                    value={option.value}
                    checked={formData.backup_type === option.value}
                    onChange={handleInputChange}
                    className="radio radio-primary mr-3"
                    disabled={loading}
                    aria-label={option.label}
                  />
                  <div className="inline-block">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-base-content/70">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Fréquence */}
          <div className="form-control">
            <label className="label" htmlFor="frequency">
              <span className="label-text font-semibold flex items-center">
                <FiClock className="mr-2" />
                Fréquence
              </span>
            </label>
            <select
              id="frequency"
              name="frequency"
              value={formData.frequency}
              onChange={handleInputChange}
              className="select select-bordered"
              disabled={loading}
            >
              {FREQUENCY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
          </div>

          {/* Options avancées */}
          <div className="card bg-base-200">
            <div className="card-body">
              <h3 className="card-title text-lg">Options avancées</h3>
              
              {/* Note sur le chiffrement obligatoire */}
              <div className="alert alert-info">
                <FiShield className="h-6 w-6" />
                <div>
                  <h3 className="font-bold">🔒 Chiffrement automatique et transparent</h3>
                  <div className="text-sm">
                    Toutes vos sauvegardes sont automatiquement chiffrées avec AES-256.
                    Aucune configuration supplémentaire requise - c'est transparent et sécurisé !
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Inclusion des fichiers */}
                <div className="form-control">
                  <label className="cursor-pointer flex items-start space-x-3" aria-label="Inclure les fichiers">
                    <input
                      type="checkbox"
                      name="include_files"
                      checked={formData.include_files}
                      onChange={handleInputChange}
                      className="checkbox checkbox-primary mt-1"
                      disabled={loading}
                      aria-label="Inclure les fichiers"
                    />
                    <div>
                      <div className="font-medium flex items-center">
                        <FiHardDrive className="mr-2" />
                        Inclure les fichiers
                      </div>
                      <div className="text-sm text-base-content/70">
                        Sauvegarde des fichiers media, logs, etc.
                      </div>
                    </div>
                  </label>
                </div>

                {/* Compression */}
                <div className="form-control">
                  <label className="cursor-pointer flex items-start space-x-3" aria-label="Compression ZIP">
                    <input
                      type="checkbox"
                      name="compression_enabled"
                      checked={formData.compression_enabled}
                      onChange={handleInputChange}
                      className="checkbox checkbox-primary mt-1"
                      disabled={loading}
                      aria-label="Compression ZIP"
                    />
                    <div>
                      <div className="font-medium">Compression ZIP</div>
                      <div className="text-sm text-base-content/70">
                        Réduit la taille des fichiers de sauvegarde
                      </div>
                    </div>
                  </label>
                </div>

                {/* Statut actif */}
                <div className="form-control">
                  <label className="cursor-pointer flex items-start space-x-3" aria-label="Configuration active">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className="checkbox checkbox-success mt-1"
                      disabled={loading}
                      aria-label="Configuration active"
                    />
                    <div>
                      <div className="font-medium">Configuration active</div>
                      <div className="text-sm text-base-content/70">
                        Permet l'exécution automatique selon la fréquence
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Rétention */}
          <div className="form-control">
            <label className="label" htmlFor="retention-days">
              <span className="label-text font-semibold">Rétention (jours)</span>
              <span className="label-text-alt">
                <div className="tooltip" data-tip="Durée de conservation des sauvegardes">
                  <FiHelpCircle />
                </div>
              </span>
            </label>
            <div className="flex items-center space-x-3">
              <input
                id="retention-days"
                type="number"
                name="retention_days"
                value={formData.retention_days}
                onChange={handleInputChange}
                min="1"
                max="365"
                className={`input input-bordered flex-1 ${errors.retention_days ? 'input-error' : ''}`}
                disabled={loading}
              />
              <span className="text-sm text-base-content/70">jours</span>
            </div>
            {errors.retention_days && (
              <label className="label" htmlFor="retention-days">
                <span className="label-text-alt text-error">{errors.retention_days}</span>
              </label>
            )}
            <div className="label">
              <span className="label-text-alt text-base-content/70">
                Les sauvegardes plus anciennes seront automatiquement supprimées
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-base-300">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-outline"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm mr-2" />{' '}
                  Sauvegarde...
                </>
              ) : (
                <>
                  <FiSave className="mr-2" />
                  {configuration ? 'Mettre à jour' : 'Créer'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

BackupConfigurationForm.propTypes = {
  configuration: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    backup_type: PropTypes.string,
    frequency: PropTypes.string,
    is_active: PropTypes.bool,
    include_files: PropTypes.bool,
    compression_enabled: PropTypes.bool,
    retention_days: PropTypes.number,
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  isOpen: PropTypes.bool,
};

export default BackupConfigurationForm; 