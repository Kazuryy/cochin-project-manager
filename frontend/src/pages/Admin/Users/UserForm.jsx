import React, { useState, useEffect } from 'react';
import { useForm } from '../../../hooks/useForm';
import { Button } from '../../../components/ui';
import { useToast } from '../../../hooks/useToast';
import { userService } from '../../../services/userService';
import api from '../../../services/api';

const UserForm = ({ user = null, onSave, onCancel }) => {
  const isEditing = !!user;
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const { showToast } = useToast();

  // État initial du formulaire basé sur les règles backend
  const initialValues = {
    username: user?.username || '',
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    password: '',
    password_confirm: '',
    is_active: user?.is_active ?? true,
    is_staff: user?.is_staff ?? false,
    is_superuser: user?.is_superuser ?? false,
    require_password_change: user?.require_password_change ?? true,
    group_ids: user?.groups?.map(g => g.id) || [],
    // Champs pour l'édition
    reset_password: false,
    new_password: ''
  };

  const {
    values,
    errors,
    touched,
    handleChange,
    handleSubmit,
    setFieldError,
    clearFieldError,
    validateField
  } = useForm(initialValues, validate);

  // Validation côté frontend qui match le backend
  function validate(values) {
    const errors = {};

    // Username obligatoire
    if (!values.username?.trim()) {
      errors.username = 'Le nom d\'utilisateur est obligatoire';
    }

    // Email obligatoire et format valide
    if (!values.email?.trim()) {
      errors.email = 'L\'adresse email est obligatoire';
    } else if (!/\S+@\S+\.\S+/.test(values.email)) {
      errors.email = 'Format d\'email invalide';
    }

    // Validation mot de passe pour création
    if (!isEditing) {
      if (!values.password) {
        errors.password = 'Le mot de passe est obligatoire';
      } else {
        // Règles ANSSI : minimum 12 caractères
        if (values.password.length < 12) {
          errors.password = 'Le mot de passe doit contenir au moins 12 caractères';
        }
        // Au moins une majuscule
        else if (!/[A-Z]/.test(values.password)) {
          errors.password = 'Le mot de passe doit contenir au moins une lettre majuscule';
        }
        // Au moins une minuscule
        else if (!/[a-z]/.test(values.password)) {
          errors.password = 'Le mot de passe doit contenir au moins une lettre minuscule';
        }
        // Au moins un chiffre
        else if (!/\d/.test(values.password)) {
          errors.password = 'Le mot de passe doit contenir au moins un chiffre';
        }
        // Au moins un caractère spécial
        else if (!/[^a-zA-Z0-9]/.test(values.password)) {
          errors.password = 'Le mot de passe doit contenir au moins un caractère spécial';
        }
        // Vérifier similarité avec autres champs
        else if (checkPasswordSimilarity(values.password, values)) {
          errors.password = 'Le mot de passe est trop similaire à vos informations personnelles';
        }
      }

      // Confirmation de mot de passe
      if (!values.password_confirm) {
        errors.password_confirm = 'Veuillez confirmer le mot de passe';
      } else if (values.password !== values.password_confirm) {
        errors.password_confirm = 'Les mots de passe ne correspondent pas';
      }
    }

    // Validation nouveau mot de passe pour édition
    if (isEditing && values.new_password) {
      if (values.new_password.length < 12) {
        errors.new_password = 'Le mot de passe doit contenir au moins 12 caractères';
      }
      else if (!/[A-Z]/.test(values.new_password)) {
        errors.new_password = 'Le mot de passe doit contenir au moins une lettre majuscule';
      }
      else if (!/[a-z]/.test(values.new_password)) {
        errors.new_password = 'Le mot de passe doit contenir au moins une lettre minuscule';
      }
      else if (!/\d/.test(values.new_password)) {
        errors.new_password = 'Le mot de passe doit contenir au moins un chiffre';
      }
      else if (!/[^a-zA-Z0-9]/.test(values.new_password)) {
        errors.new_password = 'Le mot de passe doit contenir au moins un caractère spécial';
      }
      else if (checkPasswordSimilarity(values.new_password, values)) {
        errors.new_password = 'Le mot de passe est trop similaire à vos informations personnelles';
      }
    }

    return errors;
  }

  // Fonction pour vérifier la similarité du mot de passe
  function checkPasswordSimilarity(password, values) {
    const attributes = [values.username, values.first_name, values.last_name, values.email];
    const passwordLower = password.toLowerCase();
    
    return attributes.some(attr => {
      if (!attr) return false;
      const attrLower = attr.toLowerCase();
      return attrLower.includes(passwordLower) || passwordLower.includes(attrLower);
    });
  }

  // Charger les groupes
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const response = await api.get('/api/auth/groups/');
        setGroups(response.data?.results || response.data || []);
      } catch (error) {
        console.error('Erreur lors du chargement des groupes:', error);
      }
    };
    loadGroups();
  }, []);

  // Soumission du formulaire
  const onSubmit = async (formData) => {
    setLoading(true);
    
    try {
      if (isEditing) {
        // Préparer les données pour l'édition
        const updateData = {
          username: formData.username,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          is_active: formData.is_active,
          is_staff: formData.is_staff,
          is_superuser: formData.is_superuser,
          require_password_change: formData.require_password_change,
          group_ids: formData.group_ids
        };

        // Ajouter le nouveau mot de passe si fourni
        if (formData.new_password) {
          updateData.new_password = formData.new_password;
        }
        if (formData.reset_password) {
          updateData.reset_password = true;
        }

        await userService.updateUser(user.id, updateData);
        showToast('Utilisateur modifié avec succès', 'success');
      } else {
        // Création d'utilisateur
        const createData = {
          username: formData.username,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          password: formData.password,
          password_confirm: formData.password_confirm,
          is_active: formData.is_active,
          is_staff: formData.is_staff,
          is_superuser: formData.is_superuser,
          require_password_change: formData.require_password_change,
          group_ids: formData.group_ids
        };

        await userService.createUser(createData);
        showToast('Utilisateur créé avec succès', 'success');
      }
      
      onSave?.();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      
      // Gérer les erreurs de validation du backend
      if (error.response?.data) {
        const backendErrors = error.response.data;
        
        // Mapper les erreurs backend vers les champs frontend
        Object.keys(backendErrors).forEach(field => {
          let errorMessage = Array.isArray(backendErrors[field]) 
            ? backendErrors[field][0] 
            : backendErrors[field];
            
          setFieldError(field, errorMessage);
        });
        
        showToast('Veuillez corriger les erreurs du formulaire', 'error');
      } else {
        showToast('Erreur lors de la sauvegarde', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-h-[calc(100vh-80px)] overflow-y-auto py-2 px-1">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        
        {/* Informations personnelles */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-lg">👤</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Informations personnelles</h3>
              <p className="text-xs text-gray-500">Données principales de l'utilisateur</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nom d'utilisateur *
              </label>
              <input
                type="text"
                name="username"
                value={values.username}
                onChange={handleChange}
                className={`w-full px-2 py-1.5 text-sm border rounded-md shadow-sm focus:ring-1 focus:outline-none ${
                  errors.username && touched.username 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
                placeholder="johndoe"
              />
              {errors.username && touched.username && (
                <p className="mt-1 text-xs text-red-600">{errors.username}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Adresse email *
              </label>
              <input
                type="email"
                name="email"
                value={values.email}
                onChange={handleChange}
                className={`w-full px-2 py-1.5 text-sm border rounded-md shadow-sm focus:ring-1 focus:outline-none ${
                  errors.email && touched.email 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                }`}
                placeholder="john@example.com"
              />
              {errors.email && touched.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Prénom
              </label>
              <input
                type="text"
                name="first_name"
                value={values.first_name}
                onChange={handleChange}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                placeholder="John"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nom de famille
              </label>
              <input
                type="text"
                name="last_name"
                value={values.last_name}
                onChange={handleChange}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                placeholder="Doe"
              />
            </div>
          </div>
        </div>

        {/* Section Mot de passe */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-lg">🔑</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {isEditing ? 'Gestion du mot de passe' : 'Mot de passe'}
              </h3>
              <p className="text-xs text-gray-500">
                {isEditing ? 'Modifier ou réinitialiser le mot de passe' : 'Définir le mot de passe initial'}
              </p>
            </div>
          </div>
          
          {!isEditing ? (
            // Création : mot de passe obligatoire
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Mot de passe *
                </label>
                <input
                  type="password"
                  name="password"
                  value={values.password}
                  onChange={handleChange}
                  className={`w-full px-2 py-1.5 text-sm border rounded-md shadow-sm focus:ring-1 focus:outline-none ${
                    errors.password && touched.password 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                />
                {errors.password && touched.password && (
                  <p className="mt-1 text-xs text-red-600 break-words leading-relaxed">{errors.password}</p>
                )}
                <p className="mt-1 text-xs text-gray-500 break-words leading-relaxed">
                  12+ caractères, majuscule, minuscule, chiffre, symbole
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Confirmer le mot de passe *
                </label>
                <input
                  type="password"
                  name="password_confirm"
                  value={values.password_confirm}
                  onChange={handleChange}
                  className={`w-full px-2 py-1.5 text-sm border rounded-md shadow-sm focus:ring-1 focus:outline-none ${
                    errors.password_confirm && touched.password_confirm 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                />
                {errors.password_confirm && touched.password_confirm && (
                  <p className="mt-1 text-xs text-red-600">{errors.password_confirm}</p>
                )}
              </div>
            </div>
          ) : (
            // Édition : options de modification
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="reset_password"
                  checked={values.reset_password}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-xs text-gray-700">
                  Forcer le changement de mot de passe à la prochaine connexion
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nouveau mot de passe (optionnel)
                </label>
                <input
                  type="password"
                  name="new_password"
                  value={values.new_password}
                  onChange={handleChange}
                  className={`w-full px-2 py-1.5 text-sm border rounded-md shadow-sm focus:ring-1 focus:outline-none ${
                    errors.new_password && touched.new_password 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                  }`}
                  placeholder="Laisser vide pour ne pas changer"
                />
                {errors.new_password && touched.new_password && (
                  <p className="mt-1 text-xs text-red-600 break-words leading-relaxed">{errors.new_password}</p>
                )}
                {values.new_password && (
                  <p className="mt-1 text-xs text-gray-500 break-words leading-relaxed">
                    12+ caractères, majuscule, minuscule, chiffre, symbole
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Permissions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-lg">🛡️</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Permissions</h3>
              <p className="text-xs text-gray-500">Droits et accès de l'utilisateur</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-900">Compte actif</p>
                <p className="text-xs text-gray-500">L'utilisateur peut se connecter</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={values.is_active}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-900">Administrateur</p>
                <p className="text-xs text-gray-500">Accès à l'interface d'administration</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="is_staff"
                  checked={values.is_staff}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-900">Super utilisateur</p>
                <p className="text-xs text-gray-500">Tous les droits sans restriction</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="is_superuser"
                  checked={values.is_superuser}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-900">Changement requis</p>
                <p className="text-xs text-gray-500">Doit changer son mot de passe</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="require_password_change"
                  checked={values.require_password_change}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Groupes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-lg">👥</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Groupes</h3>
              <p className="text-xs text-gray-500">Appartenance aux groupes d'utilisateurs</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {groups.map((group) => (
              <div key={group.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={values.group_ids.includes(group.id)}
                  onChange={(e) => {
                    const newGroupIds = e.target.checked
                      ? [...values.group_ids, group.id]
                      : values.group_ids.filter(id => id !== group.id);
                    handleChange({ target: { name: 'group_ids', value: newGroupIds } });
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-xs text-gray-700">
                  {group.name}
                </label>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-xs text-gray-500 italic">Aucun groupe disponible</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="px-3 py-1.5 text-sm"
          >
            {isEditing ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default UserForm; 