import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { userService, userUtils } from '../../../services/userService.js';
import { useToast } from '../../../hooks/useToast.js';
import { Card } from '../../../components/ui/index.js';
import { Button } from '../../../components/ui/index.js';
import { Modal } from '../../../components/ui/index.js';
import UserForm from './UserForm.jsx';
import UserBulkActions from './UserBulkActions.jsx';
import UserStats from './UserStats.jsx';

const UserManagement = () => {
  // États principaux
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
    has_next: false,
    has_previous: false
  });

  // États des filtres et recherche
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    is_staff: '',
    groups: '',
    require_password_change: false,
    never_logged_in: false
  });
  const [groups, setGroups] = useState([]);

  // États des modales et sélections
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const { addToast } = useToast();

  // Charger les données initiales
  useEffect(() => {
    loadUsers();
    loadGroups();
  }, []);

  // Recharger quand les filtres ou la pagination changent
  useEffect(() => {
    loadUsers();
  }, [filters, pagination.page]);

  /**
   * Charge la liste des utilisateurs
   */
  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: 20,
        ...filters
      };

      const response = await userService.getUsers(params);
      
      if (response.success) {
        setUsers(response.users);
        setPagination(response.pagination);
      } else {
        addToast('Erreur lors du chargement des utilisateurs', 'error');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      addToast('Erreur lors du chargement des utilisateurs', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Charge la liste des groupes
   */
  const loadGroups = async () => {
    try {
      const response = await userService.getGroups();
      if (response.success) {
        setGroups(response.groups);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des groupes:', error);
    }
  };

  /**
   * Gère la création d'un utilisateur
   */
  const handleCreateUser = async (userData) => {
    try {
      const response = await userService.createUser(userData);
      
      if (response.success) {
        addToast(`Utilisateur ${userData.username} créé avec succès`, 'success');
        setShowCreateModal(false);
        loadUsers();
      } else {
        addToast('Erreur lors de la création de l\'utilisateur', 'error');
      }
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      addToast('Erreur lors de la création de l\'utilisateur', 'error');
    }
  };

  /**
   * Gère la modification d'un utilisateur
   */
  const handleUpdateUser = async (userData) => {
    try {
      const response = await userService.updateUser(editingUser.id, userData);
      
      if (response.success) {
        addToast(`Utilisateur ${userData.username} mis à jour avec succès`, 'success');
        setShowEditModal(false);
        setEditingUser(null);
        loadUsers();
      } else {
        addToast('Erreur lors de la mise à jour de l\'utilisateur', 'error');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      addToast('Erreur lors de la mise à jour de l\'utilisateur', 'error');
    }
  };

  /**
   * Gère la suppression d'un utilisateur
   */
  const handleDeleteUser = async (user) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${user.username} ?`)) {
      return;
    }

    try {
      const response = await userService.deleteUser(user.id);
      
      if (response.success) {
        addToast(`Utilisateur ${user.username} supprimé avec succès`, 'success');
        loadUsers();
      } else {
        addToast('Erreur lors de la suppression de l\'utilisateur', 'error');
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      addToast('Erreur lors de la suppression de l\'utilisateur', 'error');
    }
  };

  /**
   * Gère les changements de filtres
   */
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  /**
   * Gère les filtres rapides depuis les alertes des statistiques
   */
  const handleQuickFilter = (quickFilters) => {
    // Réinitialiser d'abord tous les filtres
    const newFilters = { 
      search: '', 
      status: '', 
      is_staff: '', 
      groups: '',
      require_password_change: false,
      never_logged_in: false
    };
    
    // Appliquer le filtre rapide
    Object.keys(quickFilters).forEach(key => {
      if (quickFilters[key] !== undefined && quickFilters[key] !== null) {
        newFilters[key] = quickFilters[key];
      }
    });
    
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    
    // Afficher un message informatif
    const filterMessages = {
      'locked': 'Affichage des utilisateurs verrouillés',
      'password_expired': 'Affichage des utilisateurs avec mots de passe expirés',
      'require_password_change': 'Affichage des utilisateurs devant changer leur mot de passe',
      'never_logged_in': 'Affichage des utilisateurs jamais connectés'
    };
    
    const activeFilter = Object.keys(quickFilters).find(key => quickFilters[key]);
    if (activeFilter && filterMessages[activeFilter]) {
      addToast(filterMessages[activeFilter], 'info');
    }
  };

  /**
   * Gère la sélection d'utilisateurs
   */
  const handleUserSelection = (userId, checked) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  /**
   * Sélectionne/désélectionne tous les utilisateurs
   */
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedUsers(users.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };

  /**
   * Gère les actions en lot
   */
  const handleBulkAction = async (action, options = {}) => {
    if (selectedUsers.length === 0) {
      addToast('Aucun utilisateur sélectionné', 'warning');
      return;
    }

    try {
      const response = await userService.actions[action](selectedUsers, options.duration);
      
      if (response.success) {
        addToast(`Action "${action}" exécutée avec succès sur ${selectedUsers.length} utilisateur(s)`, 'success');
        setSelectedUsers([]);
        setShowBulkActions(false);
        loadUsers();
      } else {
        addToast('Erreur lors de l\'exécution de l\'action', 'error');
      }
    } catch (error) {
      console.error('Erreur lors de l\'action en lot:', error);
      addToast('Erreur lors de l\'exécution de l\'action', 'error');
    }
  };

  /**
   * Gère le changement de page
   */
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  /**
   * Ouvre le modal d'édition
   */
  const openEditModal = (user) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  // Calculs mémorisés
  const isAllSelected = useMemo(() => {
    return users.length > 0 && selectedUsers.length === users.length;
  }, [users.length, selectedUsers.length]);

  const isIndeterminate = useMemo(() => {
    return selectedUsers.length > 0 && selectedUsers.length < users.length;
  }, [selectedUsers.length, users.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header moderne */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-800">Gestion des Utilisateurs</h1>
                  <p className="text-slate-600">Gérer les comptes, permissions et accès de votre équipe</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {selectedUsers.length > 0 && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
                  <span className="text-amber-700 font-medium">
                    {selectedUsers.length} sélectionné{selectedUsers.length > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setShowBulkActions(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                  >
                    <span>⚡</span>
                    Actions en lot
                  </button>
                </div>
              )}
              
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                <span>✨</span>
                Nouvel utilisateur
              </button>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <UserStats onFilterUsers={handleQuickFilter} />

        {/* Filtres modernes */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">🔍</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Filtres et recherche</h3>
            
            {/* Bouton pour réinitialiser les filtres */}
            {(filters.search || filters.status || filters.is_staff || filters.groups || filters.require_password_change || filters.never_logged_in) && (
              <button
                onClick={() => setFilters({ 
                  search: '', 
                  status: '', 
                  is_staff: '', 
                  groups: '',
                  require_password_change: false,
                  never_logged_in: false
                })}
                className="ml-auto px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg transition-colors duration-200"
              >
                ✖️ Réinitialiser
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Recherche</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nom, email, username..."
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">🔍</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Statut</label>
              <select
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">Tous les statuts</option>
                <option value="active">✅ Actif</option>
                <option value="inactive">⭕ Inactif</option>
                <option value="locked">🔒 Verrouillé</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Type</label>
              <select
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white"
                value={filters.is_staff}
                onChange={(e) => handleFilterChange('is_staff', e.target.value)}
              >
                <option value="">Tous les types</option>
                <option value="true">👑 Administrateur</option>
                <option value="false">👤 Utilisateur</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Groupe</label>
              <select
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white"
                value={filters.groups}
                onChange={(e) => handleFilterChange('groups', e.target.value)}
              >
                <option value="">Tous les groupes</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>🏷️ {group.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Indicateurs de filtres spéciaux actifs */}
          {(filters.require_password_change || filters.never_logged_in) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {filters.require_password_change && (
                <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 px-3 py-2 rounded-lg text-sm font-medium">
                  <span>🔄</span>
                  Changement de mot de passe requis
                  <button
                    onClick={() => handleFilterChange('require_password_change', false)}
                    className="ml-1 text-orange-500 hover:text-orange-700"
                  >
                    ✖
                  </button>
                </div>
              )}
              {filters.never_logged_in && (
                <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium">
                  <span>👻</span>
                  Jamais connectés
                  <button
                    onClick={() => handleFilterChange('never_logged_in', false)}
                    className="ml-1 text-blue-500 hover:text-blue-700"
                  >
                    ✖
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tableau moderne */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">📋</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800">
                Liste des utilisateurs ({pagination.total})
              </h3>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-600">Chargement des utilisateurs...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">😔</span>
              </div>
              <p className="text-slate-600 text-lg">Aucun utilisateur trouvé</p>
              <p className="text-slate-400">Essayez de modifier vos filtres de recherche</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-4 px-6">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        checked={isAllSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        ref={(el) => {
                          if (el) el.indeterminate = isIndeterminate;
                        }}
                      />
                    </th>
                    <th className="text-left py-4 px-6 text-slate-700 font-semibold">Utilisateur</th>
                    <th className="text-left py-4 px-6 text-slate-700 font-semibold">Email</th>
                    <th className="text-left py-4 px-6 text-slate-700 font-semibold">Statut</th>
                    <th className="text-left py-4 px-6 text-slate-700 font-semibold">Type</th>
                    <th className="text-left py-4 px-6 text-slate-700 font-semibold">Dernière connexion</th>
                    <th className="text-left py-4 px-6 text-slate-700 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user, index) => (
                    <tr key={user.id} className={`hover:bg-slate-50 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-25'}`}>
                      <td className="py-4 px-6">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => handleUserSelection(user.id, e.target.checked)}
                        />
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                            {user.first_name?.[0] || user.username[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-slate-500">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-slate-700">{user.email}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          user.is_active 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {user.is_active ? '✅ Actif' : '❌ Inactif'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          user.is_staff 
                            ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {user.is_staff ? '👑 Admin' : '👤 Utilisateur'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-slate-600">
                          {userUtils.formatLastLogin(user.last_login)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="Modifier"
                          >
                            <span className="text-lg">✏️</span>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Supprimer"
                          >
                            <span className="text-lg">🗑️</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination moderne */}
          {pagination.pages > 1 && (
            <div className="p-6 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Page {pagination.page} sur {pagination.pages} ({pagination.total} utilisateurs)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.has_previous}
                    className={`px-3 py-2 rounded-lg font-medium transition-colors duration-200 ${
                      pagination.has_previous
                        ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    ← Précédent
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`w-10 h-10 rounded-lg font-medium transition-colors duration-200 ${
                            pagination.page === page
                              ? 'bg-blue-500 text-white'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.has_next}
                    className={`px-3 py-2 rounded-lg font-medium transition-colors duration-200 ${
                      pagination.has_next
                        ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Suivant →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Créer un utilisateur"
        size="lg"
      >
        <UserForm
          onSubmit={handleCreateUser}
          onCancel={() => setShowCreateModal(false)}
          groups={groups}
        />
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingUser(null);
        }}
        title="Modifier l'utilisateur"
        size="lg"
      >
        {editingUser && (
          <UserForm
            user={editingUser}
            onSubmit={handleUpdateUser}
            onCancel={() => {
              setShowEditModal(false);
              setEditingUser(null);
            }}
            groups={groups}
            isEdit
          />
        )}
      </Modal>

      <Modal
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        title="Actions en lot"
        size="md"
      >
        <UserBulkActions
          selectedCount={selectedUsers.length}
          onAction={handleBulkAction}
          onCancel={() => setShowBulkActions(false)}
        />
      </Modal>
    </div>
  );
};

export default UserManagement; 