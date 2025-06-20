// frontend/src/components/ui/Breadcrumb.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useDynamicTables } from '../../contexts/hooks/useDynamicTables';

function Breadcrumb() {
  const location = useLocation();
  const params = useParams();
  const { fetchTableWithFields } = useDynamicTables();
  const [tableInfo, setTableInfo] = useState(null);
  const [recordInfo, setRecordInfo] = useState(null);

  // Ne s'afficher que sur les pages d'administration des tables
  const shouldShowBreadcrumb = useCallback(() => {
    const pathname = location.pathname;
    return pathname.startsWith('/admin') && pathname.includes('/database/tables');
  }, [location.pathname]);

  // Fonction pour obtenir un nom d'affichage pour un enregistrement
  const getRecordDisplayName = useCallback((record, table) => {
    if (!record || !table) {
      return `Enregistrement #${params.recordId}`;
    }

    // Chercher le custom_id en premier
    if (record.custom_id) {
      return `#${record.custom_id}`;
    }

    // Chercher le meilleur champ pour l'affichage
    const displayFields = ['nom', 'name', 'title', 'titre', 'libelle', 'label'];
    
    for (const fieldName of displayFields) {
      for (const [key, value] of Object.entries(record)) {
        if (key.toLowerCase().includes(fieldName.toLowerCase()) && 
            value && typeof value === 'string') {
          return value.length > 30 ? `${value.substring(0, 30)}...` : value;
        }
      }
    }

    // Sinon, prendre la première valeur texte non-système
    const systemFields = ['id', 'created_at', 'updated_at'];
    for (const [key, value] of Object.entries(record)) {
      if (!systemFields.includes(key) && 
          value && typeof value === 'string' && 
          value.trim() !== '') {
        return value.length > 30 ? `${value.substring(0, 30)}...` : value;
      }
    }

    return `Enregistrement #${record.id}`;
  }, [params.recordId]);

  // Charger les infos de la table si nécessaire
  useEffect(() => {
    const loadTableInfo = async () => {
      if (params.tableId && shouldShowBreadcrumb()) {
        try {
          const table = await fetchTableWithFields(params.tableId);
          setTableInfo(table);
          
          // Si on a aussi un recordId, charger les infos de l'enregistrement
          if (params.recordId && table) {
            try {
              const response = await fetch(`/api/database/records/${params.recordId}/`, {
                credentials: 'include',
              });
              if (response.ok) {
                const record = await response.json();
                setRecordInfo(record);
              }
            } catch (err) {
              console.error('Erreur lors du chargement de l\'enregistrement:', err);
            }
          }
        } catch (err) {
          console.error('Erreur lors du chargement de la table:', err);
        }
      } else {
        setTableInfo(null);
        setRecordInfo(null);
      }
    };

    loadTableInfo();
  }, [params.tableId, params.recordId, fetchTableWithFields, shouldShowBreadcrumb]);

  // Fonctions utilitaires pour construire le breadcrumb
  const getBaseBreadcrumbItems = useCallback(() => {
    return [
      {
        label: 'Administration',
        path: '/admin',
        icon: '🏠'
      },
      {
        label: 'Base de données',
        path: '/admin/database',
        icon: '🗄️'
      },
      {
        label: 'Tables',
        path: '/admin/database/tables',
        icon: '📋'
      }
    ];
  }, []);

  const getFieldsBreadcrumb = useCallback((tableName) => {
    return [
      {
        label: tableName,
        path: `/admin/database/tables/${params.tableId}/records`,
        icon: '📊',
        isTable: true
      },
      {
        label: 'Gestion des champs',
        path: `/admin/database/tables/${params.tableId}/fields`,
        icon: '🏗️',
        isCurrentPage: true
      }
    ];
  }, [params.tableId]);

  const getRecordsBreadcrumb = useCallback((tableName, pathname) => {
    const items = [
      {
        label: tableName,
        path: `/admin/database/tables/${params.tableId}/records`,
        icon: '📊',
        isTable: true
      }
    ];

    if (params.recordId) {
      items.push({
        label: 'Enregistrements',
        path: `/admin/database/tables/${params.tableId}/records`,
        icon: '📝'
      });

      const recordLabel = getRecordDisplayName(recordInfo, tableInfo);
      if (pathname.includes('/edit')) {
        items.push({
          label: `Modifier : ${recordLabel}`,
          path: pathname,
          icon: '✏️',
          isCurrentPage: true
        });
      } else {
        items.push({
          label: recordLabel,
          path: pathname,
          icon: '📄',
          isCurrentPage: true
        });
      }
    } else if (pathname.includes('/create')) {
      items.push({
        label: 'Enregistrements',
        path: `/admin/database/tables/${params.tableId}/records`,
        icon: '📝'
      });
      items.push({
        label: 'Nouvel enregistrement',
        path: pathname,
        icon: '➕',
        isCurrentPage: true
      });
    } else {
      items.push({
        label: 'Enregistrements',
        path: pathname,
        icon: '📝',
        isCurrentPage: true
      });
    }

    return items;
  }, [params.tableId, params.recordId, recordInfo, tableInfo, getRecordDisplayName]);

  const getEditTableBreadcrumb = useCallback((tableName, pathname) => {
    return [
      {
        label: tableName,
        path: `/admin/database/tables/${params.tableId}/records`,
        icon: '📊'
      },
      {
        label: 'Modifier la table',
        path: pathname,
        icon: '✏️',
        isCurrentPage: true
      }
    ];
  }, [params.tableId]);

  // Configuration optimisée pour l'UX
  const getBreadcrumbItems = useCallback(() => {
    const pathname = location.pathname;
    const items = getBaseBreadcrumbItems();

    // Création d'une nouvelle table
    if (pathname.includes('/create') && !params.tableId) {
      items.push({
        label: 'Nouvelle table',
        path: pathname,
        icon: '➕',
        isCurrentPage: true
      });
      return items;
    }

    // Table spécifique
    if (params.tableId && tableInfo) {
      const tableName = tableInfo.name || `Table #${params.tableId}`;
      
      if (pathname.includes('/fields')) {
        items.push(...getFieldsBreadcrumb(tableName));
      } else if (pathname.includes('/records')) {
        items.push(...getRecordsBreadcrumb(tableName, pathname));
      } else if (pathname.includes('/edit')) {
        items.push(...getEditTableBreadcrumb(tableName, pathname));
      } else {
        items.push({
          label: tableName,
          path: `/admin/database/tables/${params.tableId}/records`,
          icon: '📊',
          isTable: true,
          isCurrentPage: true
        });
      }
    }

    return items;
  }, [location.pathname, params.tableId, tableInfo, getBaseBreadcrumbItems, getFieldsBreadcrumb, getRecordsBreadcrumb, getEditTableBreadcrumb]);

  // Ne pas afficher si on n'est pas dans la bonne section
  if (!shouldShowBreadcrumb()) {
    return null;
  }

  const breadcrumbItems = getBreadcrumbItems();

  return (
    <div className="bg-base-200/50 border-b border-base-300 mb-6">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          {/* Breadcrumb principal */}
          <div className="breadcrumbs text-sm">
            <ul>
              {breadcrumbItems.map((item, index) => {
                const isLast = index === breadcrumbItems.length - 1;
                const isCurrent = item.isCurrentPage || isLast;
                
                return (
                  <li key={item.path} className={isCurrent ? 'font-semibold text-primary' : ''}>
                    {isCurrent ? (
                      <span className="flex items-center gap-1">
                        <span>{item.icon}</span>
                        {item.label}
                      </span>
                    ) : (
                      <Link 
                        to={item.path} 
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        <span>{item.icon}</span>
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Actions rapides contextuelles */}
          {params.tableId && tableInfo && (
            <div className="flex items-center gap-2">
              <div className="divider divider-horizontal mx-2"></div>
              
              {/* Navigation rapide pour les tables */}
              <div className="flex gap-1">
                <Link 
                  to={`/admin/database/tables/${params.tableId}/records`}
                  className="btn btn-xs btn-ghost"
                  title="Voir les enregistrements"
                >
                  📝
                </Link>
                <Link 
                  to={`/admin/database/tables/${params.tableId}/fields`}
                  className="btn btn-xs btn-ghost"
                  title="Gérer les champs"
                >
                  🏗️
                </Link>
                <Link 
                  to={`/admin/database/tables/${params.tableId}/edit`}
                  className="btn btn-xs btn-ghost"
                  title="Modifier la table"
                >
                  ✏️
                </Link>
                
                {/* Bouton d'ajout contextuel */}
                {location.pathname.includes('/records') && !location.pathname.includes('/create') && (
                  <Link 
                    to={`/admin/database/tables/${params.tableId}/records/create`}
                    className="btn btn-xs btn-primary"
                    title="Nouvel enregistrement"
                  >
                    ➕
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Breadcrumb;