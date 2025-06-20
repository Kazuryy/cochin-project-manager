import React, { useState, useEffect } from 'react';
import { userService } from '../../../services/userService.js';

const UserStats = ({ onFilterUsers }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  /**
   * Charge les statistiques des utilisateurs
   */
  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await userService.getUserStats();
      if (response.success) {
        setStats(response.stats);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Gère les actions sur les alertes
   */
  const handleAlertAction = (alertType) => {
    switch (alertType) {
      case 'locked':
        // Filtrer les utilisateurs verrouillés
        onFilterUsers({ status: 'locked' });
        break;
      case 'expired_passwords':
        // Filtrer les utilisateurs avec mots de passe expirés
        onFilterUsers({ password_expired: true });
        break;
      case 'require_password_change':
        // Filtrer les utilisateurs devant changer leur mot de passe
        onFilterUsers({ require_password_change: true });
        break;
      case 'never_logged_in':
        // Filtrer les utilisateurs jamais connectés
        onFilterUsers({ never_logged_in: true });
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm">📊</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Statistiques des Utilisateurs</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-slate-50 rounded-xl p-4 animate-pulse">
              <div className="w-12 h-12 bg-slate-200 rounded-full mb-3"></div>
              <div className="h-6 bg-slate-200 rounded mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  /**
   * Définition des statistiques à afficher
   */
  const statItems = [
    {
      key: 'total_users',
      label: 'Total Utilisateurs',
      value: stats.total_users,
      icon: '👥',
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100',
      description: 'Nombre total d\'utilisateurs'
    },
    {
      key: 'active_users',
      label: 'Utilisateurs Actifs',
      value: stats.active_users,
      icon: '✅',
      gradient: 'from-emerald-500 to-emerald-600',
      bgGradient: 'from-emerald-50 to-emerald-100',
      description: 'Comptes actifs et fonctionnels'
    },
    {
      key: 'staff_users',
      label: 'Administrateurs',
      value: stats.staff_users,
      icon: '👑',
      gradient: 'from-purple-500 to-purple-600',
      bgGradient: 'from-purple-50 to-purple-100',
      description: 'Utilisateurs avec privilèges admin'
    },
    {
      key: 'inactive_users',
      label: 'Utilisateurs Inactifs',
      value: stats.inactive_users,
      icon: '😴',
      gradient: 'from-slate-500 to-slate-600',
      bgGradient: 'from-slate-50 to-slate-100',
      description: 'Comptes désactivés'
    }
  ];

  const alertItems = [
    {
      condition: stats.locked_users > 0,
      type: 'warning',
      icon: '🔒',
      title: 'Comptes Verrouillés',
      message: `${stats.locked_users} compte(s) verrouillé(s)`,
      description: 'Ces comptes ont été verrouillés suite à des tentatives de connexion échouées',
      value: stats.locked_users,
      gradient: 'from-amber-500 to-orange-500',
      actionType: 'locked',
      actionLabel: 'Déverrouiller'
    },
    {
      condition: stats.expired_passwords > 0,
      type: 'error',
      icon: '🔑',
      title: 'Mots de Passe Expirés',
      message: `${stats.expired_passwords} mot(s) de passe expiré(s)`,
      description: 'Ces utilisateurs doivent renouveler leur mot de passe',
      value: stats.expired_passwords,
      gradient: 'from-red-500 to-rose-500',
      actionType: 'expired_passwords',
      actionLabel: 'Notifier'
    },
    {
      condition: stats.require_password_change > 0,
      type: 'info',
      icon: '🔄',
      title: 'Changement Requis',
      message: `${stats.require_password_change} utilisateur(s) doivent changer leur mot de passe`,
      description: 'Changement de mot de passe obligatoire lors de la prochaine connexion',
      value: stats.require_password_change,
      gradient: 'from-blue-500 to-indigo-500',
      actionType: 'require_password_change',
      actionLabel: 'Gérer'
    },
    {
      condition: stats.never_logged_in > 0,
      type: 'neutral',
      icon: '👻',
      title: 'Jamais Connectés',
      message: `${stats.never_logged_in} utilisateur(s) jamais connecté(s)`,
      description: 'Ces comptes n\'ont jamais été utilisés depuis leur création',
      value: stats.never_logged_in,
      gradient: 'from-slate-500 to-gray-500',
      actionType: 'never_logged_in',
      actionLabel: 'Relancer'
    }
  ];

  const activeAlerts = alertItems.filter(alert => alert.condition);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-800">Statistiques des Utilisateurs</h3>
              <p className="text-sm text-slate-600">Vue d'ensemble de votre base utilisateurs</p>
            </div>
          </div>
          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors duration-200 text-slate-700 font-medium"
          >
            <span className={`${loading ? 'animate-spin' : ''}`}>🔄</span>
            Actualiser
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statItems.map((item, index) => {
            const percentage = item.key !== 'total_users' && stats.total_users > 0 
              ? Math.round((item.value / stats.total_users) * 100) 
              : 100;
            
            return (
              <div
                key={item.key}
                className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${item.bgGradient} border border-white/20 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-r ${item.gradient} rounded-xl flex items-center justify-center shadow-lg`}>
                      <span className="text-xl">{item.icon}</span>
                    </div>
                    {item.key !== 'total_users' && (
                      <div className="text-right">
                        <div className="text-xs font-medium text-slate-600">{percentage}%</div>
                        <div className="w-12 h-1 bg-white/30 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${item.gradient} transition-all duration-1000 ease-out`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-3xl font-bold text-slate-800">
                      {item.value.toLocaleString()}
                    </div>
                    <div className="text-sm font-medium text-slate-700">
                      {item.label}
                    </div>
                    <div className="text-xs text-slate-600">
                      {item.description}
                    </div>
                  </div>
                </div>

                {/* Effet de brillance */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-1000"></div>
              </div>
            );
          })}
        </div>

        {/* Alertes et Notifications */}
        {activeAlerts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs">⚠️</span>
              </div>
              <h4 className="text-lg font-semibold text-slate-800">Alertes et Actions Requises</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeAlerts.map((alert, index) => (
                <div
                  key={index}
                  className="relative overflow-hidden rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 bg-gradient-to-r ${alert.gradient} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                        <span className="text-lg">{alert.icon}</span>
                      </div>
                      <div className="flex-1">
                        <h5 className="text-lg font-bold text-slate-800 mb-1">
                          {alert.title}
                        </h5>
                        <p className="text-sm text-slate-600 mb-2">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-slate-800">
                            {alert.value}
                          </span>
                          <span className="text-sm text-slate-500">
                            utilisateur{alert.value > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleAlertAction(alert.actionType)}
                        className={`flex-1 px-4 py-2 bg-gradient-to-r ${alert.gradient} text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2`}
                      >
                        <span>👀</span>
                        Voir les utilisateurs
                      </button>
                      
                      <button 
                        onClick={() => handleAlertAction(alert.actionType)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors duration-200"
                      >
                        {alert.actionLabel}
                      </button>
                    </div>
                  </div>
                  
                  {/* Bordure colorée */}
                  <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${alert.gradient}`}></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message si tout va bien */}
        {activeAlerts.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✨</span>
            </div>
            <h4 className="text-lg font-semibold text-slate-800 mb-2">Tout va bien !</h4>
            <p className="text-slate-600">Aucune action particulière n'est requise pour le moment.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserStats; 