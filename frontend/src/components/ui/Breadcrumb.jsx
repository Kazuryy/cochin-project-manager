// frontend/src/components/ui/Breadcrumb.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useDynamicTables } from '../../contexts/hooks/useDynamicTables';

function Breadcrumb() {
  const location = useLocation();
  const params = useParams();
  const { fetchTableWithFields } = useDynamicTables();
  const [tableInfo, setTableInfo] = useState(null);
  const [recordInfo, setRecordInfo] = useState(null);

  // Charger les infos de la table si nécessaire
  useEffect(() => {
    const loadTableInfo = async () => {
      if (params.tableId) {
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
  }, [params.tableId, params.recordId, fetchTableWithFields]);

  // Configuration des routes et leurs labels
  const getBreadcrumbItems = () => {
    const pathname = location.pathname;
    const items = [];

    // Toujours commencer par Admin si on est dans une zone admin
    if (pathname.startsWith('/admin')) {
      items.push({
        label: 'Administration',
        path: '/admin-dashboard',
        icon: '🏠'
      });

      // Database section
      if (pathname.includes('/database')) {
        items.push({
          label: 'Base de données',
          path: '/admin/database',
          icon: '🗄️'
        });

        // Tables section
        if (pathname.includes('/tables')) {
          items.push({
            label: 'Tables',
            path: '/admin/database/tables',
            icon: '📋'
          });

          // Table spécifique
          if (pathname.includes('/tables')) {
            items.push({
              label: 'test',
              path: `/admin/database/tables/${params.tableId}/records`,
              icon: '📊'
            });

            // Sous-sections d'une table
            if (pathname.includes('/fields')) {
              items.push({
                label: 'Champs',
                path: `/admin/database/tables/${params.tableId}/fields`,
                icon: '🏗️'
              });
            } else if (pathname.includes('/records')) {
              items.push({
                label: 'Enregistrements',
                path: `/admin/database/tables/${params.tableId}/records/create`,
                icon: '📝'
              });

              // Enregistrement spécifique
              if (params.recordId) {
                const recordLabel = getRecordDisplayName(recordInfo, tableInfo);
                
                if (pathname.includes('/edit')) { 
                  items.push({
                    label: `Modifier: ${recordLabel}`,
                    path: `/admin/database/tables/${params.tableId}/records/${params.recordId}/edit`,
                    icon: '✏️',
                    isCurrentPage: true
                  });
                } else {
                  items.push({
                    label: recordLabel,
                    path: `/admin/database/tables/${params.tableId}/records/${params.recordId}`,
                    icon: '📄'
                  });
                }
              } else if (pathname.includes('/create')) {
                items.push({
                  label: 'Nouvel enregistrement',
                  path: `/admin/database/tables/${params.tableId}/records/create`,
                  icon: '➕',
                  isCurrentPage: true
                });
              }
            } else if (pathname.includes('/edit')) {
              items.push({
                label: 'Modifier la table',
                path: `/admin/database/tables/${params.tableId}/edit`,
                icon: '✏️',
                isCurrentPage: true
              });
            }
          } else if (pathname.includes('/create')) {
            items.push({
              label: 'Nouvelle table',
              path: '/admin/database/tables/create',
              icon: '➕',
              isCurrentPage: true
            });
          }
        }
      }
    } else if (pathname === '/dashboard') {
      items.push({
        label: 'Tableau de bord',
        path: '/dashboard',
        icon: '📊',
        isCurrentPage: true
      });
    } else if (pathname === '/') {
      items.push({
        label: 'Accueil',
        path: '/',
        icon: '🏠',
        isCurrentPage: true
      });
    }

    return items;
  };

  // Fonction pour obtenir un nom d'affichage pour un enregistrement
  const getRecordDisplayName = (record, table) => {
    if (!record || !table) {
      return `Enregistrement #${params.recordId}`;
    }

    // Chercher le meilleur champ pour l'affichage
    const displayFields = ['nom', 'name', 'title', 'titre', 'libelle', 'label'];
    
    for (const fieldName of displayFields) {
      for (const [key, value] of Object.entries(record)) {
        if (key.toLowerCase().includes(fieldName.toLowerCase()) && 
            value && typeof value === 'string') {
          return `${value}`;
        }
      }
    }

    // Sinon, prendre la première valeur texte non-système
    const systemFields = ['id', 'created_at', 'updated_at'];
    for (const [key, value] of Object.entries(record)) {
      if (!systemFields.includes(key) && 
          value && typeof value === 'string' && 
          value.trim() !== '') {
        return `${value}`;
      }
    }

    return `Enregistrement #${record.id}`;
  };

  const breadcrumbItems = getBreadcrumbItems();

  if (breadcrumbItems.length <= 1) {
    return null; // Ne pas afficher le breadcrumb s'il n'y a qu'un élément
  }

  return (
    <div className="breadcrumbs text-sm mb-6">
      <ul>
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          const isCurrent = item.isCurrentPage || isLast;
          
          return (
            <li key={item.path} className={isCurrent ? 'font-semibold' : ''}>
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
  );
}

export default Breadcrumb;