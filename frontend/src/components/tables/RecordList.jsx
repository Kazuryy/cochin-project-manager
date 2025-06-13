// frontend/src/components/tables/RecordList.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useDynamicTables } from '../../contexts/hooks/useDynamicTables';
import { Button, Alert, Modal } from '../ui';
import { FiPlus, FiEdit, FiTrash2, FiFilter, FiSearch, FiDownload, FiChevronUp, FiChevronDown } from 'react-icons/fi';

function RecordList({ tableId }) {
  const { 
    fetchTableWithFields, 
    fetchRecords, 
    deleteRecord, 
    error: contextError 
  } = useDynamicTables();
  
  // Regroupement des états liés
  const [tableState, setTableState] = useState({
    table: null,
    fields: [],
    records: [],
    isLoading: false,
    error: null
  });

  const [filterState, setFilterState] = useState({
    filters: {},
    searchTerm: '',
    sortField: null,
    sortDirection: 'asc'
  });

  const [modalState, setModalState] = useState({
    isFilterModalOpen: false,
    confirmDelete: null,
    successMessage: '',
    deleteError: ''
  });
  
  // Gestion des erreurs améliorée
  const handleError = useCallback((error, context) => {
    console.error(`Erreur dans ${context}:`, error);
    setTableState(prev => ({
      ...prev,
      error: `Une erreur est survenue lors de ${context}`
    }));
  }, []);

  
  // Charger les données de la table et ses champs
  useEffect(() => {
    const loadTable = async () => {
      try {
        setTableState(prev => ({ ...prev, isLoading: true }));
        const tableData = await fetchTableWithFields(tableId);
        if (tableData) {
          setTableState(prev => ({
            ...prev,
            table: tableData,
            fields: tableData.fields || [],
            isLoading: false
          }));
        }
      } catch (error) {
        handleError(error, 'le chargement de la table');
      }
    };
    
    loadTable();
  }, [tableId, fetchTableWithFields, handleError]);
  
  // Charger les enregistrements
  useEffect(() => {
    const loadRecords = async () => {
      if (tableState.table) {
        const recordsData = await fetchRecords(tableId, filterState.filters);
        if (recordsData && Array.isArray(recordsData)) {
          setTableState(prev => ({
            ...prev,
            records: recordsData
          }));
        } else {
          setTableState(prev => ({
            ...prev,
            records: []
          }));
        }
      }
    };
    
    loadRecords();
  }, [tableId, tableState.table, filterState.filters, fetchRecords]);
  
  // Fonction de tri
  const handleSort = (fieldSlug) => {
    if (filterState.sortField === fieldSlug) {
      // Si on clique sur la même colonne, inverser la direction
      setFilterState(prev => ({
        ...prev,
        sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc'
      }));
    } else {
      // Nouvelle colonne, tri ascendant par défaut
      setFilterState(prev => ({
        ...prev,
        sortField: fieldSlug,
        sortDirection: 'asc'
      }));
    }
  };
  
  // Memoization des fonctions de tri et de filtrage
  const getDisplayValue = useCallback((record, field) => {
    const value = record[field.slug];
    
    if (field.field_type === 'foreign_key') {
      if (value && typeof value === 'string' && !value.startsWith('[')) {
        return value;
      }
      
      const idValue = record[`${field.slug}_id`];
      if (idValue) {
        return `ID: ${idValue}`;
      }
    }
    
    return value;
  }, []);

  const getSortValue = useCallback((record, fieldSlug) => {
    const value = record[fieldSlug];
    const idValue = record[`${fieldSlug}_id`];
    
    if (idValue) {
      return parseInt(idValue) || 0;
    }
    
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    return value.toString().toLowerCase();
  }, []);
  
  // Memoization du tri des enregistrements
  const sortedRecords = useMemo(() => {
    const { records } = tableState;
    const { sortField, sortDirection } = filterState;

    if (!sortField) {
      return [...records].sort((a, b) => {
        if (a.custom_id && b.custom_id) {
          return a.custom_id - b.custom_id;
        }
        if (a.custom_id && !b.custom_id) return -1;
        if (!a.custom_id && b.custom_id) return 1;
        return a.id - b.id;
      });
    }
    
    return [...records].sort((a, b) => {
      const aValue = getSortValue(a, sortField);
      const bValue = getSortValue(b, sortField);
      
      if (aValue === '' && bValue !== '') return 1;
      if (aValue !== '' && bValue === '') return -1;
      if (aValue === '' && bValue === '') return 0;
      
      let comparison = 0;
      if (aValue > bValue) comparison = 1;
      if (aValue < bValue) comparison = -1;
      
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [tableState, filterState, getSortValue]);
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilterState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [name]: value
      }
    }));
  };
  
  const applyFilters = () => {
    // Les filtres sont déjà appliqués via l'effet ci-dessus
    setModalState(prev => ({ ...prev, isFilterModalOpen: false }));
  };
  
  const resetFilters = () => {
    setFilterState(prev => ({
      ...prev,
      filters: {}
    }));
    setModalState(prev => ({ ...prev, isFilterModalOpen: false }));
  };
  
  const handleDeleteRecord = async (recordId) => {
    try {
      const success = await deleteRecord(recordId);
      
      if (success) {
        setModalState(prev => ({
          ...prev,
          successMessage: 'Enregistrement supprimé avec succès',
          records: tableState.records.filter(record => record.id !== recordId)
        }));
        // Effacer le message après 3 secondes
        setTimeout(() => setModalState(prev => ({ ...prev, successMessage: '' })), 3000);
      } else {
        setModalState(prev => ({ ...prev, deleteError: 'Erreur lors de la suppression' }));
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      setModalState(prev => ({ ...prev, deleteError: 'Erreur lors de la suppression' }));
    } finally {
      setModalState(prev => ({ ...prev, confirmDelete: null }));
    }
  };
  
  const exportToCSV = () => {
    if (!tableState.records.length || !tableState.fields.length) return;
    
    // Créer les en-têtes
    const headers = tableState.fields.map(field => field.name);
    
    // Créer les lignes de données
    const dataRows = tableState.records.map(record => {
      return tableState.fields.map(field => {
        const value = record[field.slug];
        // Gérer les valeurs null/undefined ou objets
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
      });
    });
    
    // Combiner en-têtes et données
    const csvContent = [
      headers.join(','),
      ...dataRows.map(row => row.join(','))
    ].join('\n');
    
    // Créer et télécharger le fichier
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${tableState.table?.name || 'table'}_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Memoization du filtrage par recherche
  const filteredRecords = useMemo(() => {
    const { searchTerm } = filterState;
    const { fields } = tableState;
    
    if (!searchTerm) return sortedRecords;
    
    return sortedRecords.filter(record => {
      return fields.some(field => {
        if (field.field_type === 'text' || field.field_type === 'long_text') {
          const value = getDisplayValue(record, field);
          return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
        }
        return false;
      });
    });
  }, [sortedRecords, filterState, tableState, getDisplayValue]);
  
  // Fonction pour rendre l'icône de tri
  const renderSortIcon = (fieldSlug) => {
    if (filterState.sortField !== fieldSlug) {
      return null; // Pas d'icône si ce n'est pas le champ trié
    }
    
    return filterState.sortDirection === 'asc' ? (
      <FiChevronUp className="inline ml-1" />
    ) : (
      <FiChevronDown className="inline ml-1" />
    );
  };
  
  // Fonction pour rendre le champ de filtrage approprié
  const renderFilterField = (field) => {
    const commonProps = {
      name: field.slug,
      value: filterState.filters[field.slug] || '',
      onChange: handleFilterChange,
      className: "input input-bordered w-full",
      placeholder: `Filtrer par ${field.name.toLowerCase()}`
    };

    if (field.field_type === 'text' || field.field_type === 'long_text') {
      return <input type="text" {...commonProps} />;
    }
    
    if (field.field_type === 'number' || field.field_type === 'decimal') {
      return <input type="number" {...commonProps} />;
    }
    
    if (field.field_type === 'boolean') {
      return (
        <select {...commonProps} className="select select-bordered w-full">
          <option value="">Tous</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      );
    }
    
    if (field.field_type === 'choice') {
      return (
        <select {...commonProps} className="select select-bordered w-full">
          <option value="">Tous</option>
          {field.options && Array.isArray(JSON.parse(field.options)) && 
            JSON.parse(field.options).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
        </select>
      );
    }
    
    return null;
  };
  
  return (
    <div className="space-y-4" role="region" aria-label="Liste des enregistrements">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {tableState.table ? `Enregistrements - ${tableState.table.name}` : 'Chargement...'}
        </h2>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setModalState(prev => ({ ...prev, isFilterModalOpen: true }))}
          >
            <FiFilter className="mr-2" />
            Filtres
          </Button>
          
          <Button
            variant="outline"
            onClick={exportToCSV}
            isDisabled={!tableState.records.length}
          >
            <FiDownload className="mr-2" />
            Exporter CSV
          </Button>
          
          <Link to={`/admin/database/tables/${tableId}/records/create`}>
            <Button variant="primary">
              <FiPlus className="mr-2" />
              Ajouter
            </Button>
          </Link>
        </div>
      </div>
      
      {contextError && (
        <Alert type="error" message={contextError} />
      )}
      
      {modalState.deleteError && (
        <Alert type="error" message={modalState.deleteError} />
      )}
      
      {modalState.successMessage && (
        <Alert type="success" message={modalState.successMessage} />
      )}
      
      {/* Barre de recherche */}
      <div className="form-control">
        <div className="input-group">
          <input
            type="text"
            placeholder="Rechercher..."
            className="input input-bordered w-full"
            value={filterState.searchTerm}
            onChange={(e) => setFilterState(prev => ({ ...prev, searchTerm: e.target.value }))}
          />
          <Button variant="ghost">
            <FiSearch />
          </Button>
        </div>
      </div>
      
      {tableState.isLoading && !tableState.table ? (
        <div className="flex justify-center p-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th 
                  className="cursor-pointer hover:bg-base-200"
                  onClick={() => handleSort('custom_id')}
                  role="columnheader"
                  aria-sort={filterState.sortField === 'custom_id' ? filterState.sortDirection : 'none'}
                >
                  ID {renderSortIcon('custom_id')}
                </th>
                {tableState.fields.map(field => (
                  <th 
                    key={field.id}
                    className="cursor-pointer hover:bg-base-200"
                    onClick={() => handleSort(field.slug)}
                    role="columnheader"
                    aria-sort={filterState.sortField === field.slug ? filterState.sortDirection : 'none'}
                  >
                    {field.name} {renderSortIcon(field.slug)}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="font-medium">
                      {record.custom_id ? (
                        <span className="text-primary font-bold">{record.custom_id}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">Non assigné</span>
                      )}
                    </td>
                    {tableState.fields.map(field => (
                      <td key={`${record.id}-${field.id}`}>
                        {formatFieldValue(getDisplayValue(record, field), field.field_type)}
                      </td>
                    ))}
                    <td>
                      <div className="flex space-x-1">
                        <Link to={`/admin/database/tables/${tableId}/records/${record.id}/edit`}>
                          <Button
                            variant="ghost"
                            className="text-primary"
                            size="xs"
                          >
                            <FiEdit />
                          </Button>
                        </Link>
                        
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setModalState(prev => ({ ...prev, confirmDelete: record.id }))}
                        >
                          <FiTrash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={tableState.fields.length + 2} className="text-center py-4">
                    {tableState.isLoading
                      ? 'Chargement des enregistrements...'
                      : 'Aucun enregistrement trouvé'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Modal de filtres */}
      <Modal
        isOpen={modalState.isFilterModalOpen}
        onClose={() => setModalState(prev => ({ ...prev, isFilterModalOpen: false }))}
        title="Filtrer les enregistrements"
      >
        <div className="space-y-4">
          {tableState.fields
            .filter(field => field.is_searchable)
            .map(field => (
              <div key={field.id} className="form-control w-full">
                <label className="label">
                  <span className="label-text">{field.name}</span>
                </label>
                {renderFilterField(field)}
              </div>
            ))}
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="ghost"
              onClick={resetFilters}
            >
              Réinitialiser
            </Button>
            <Button
              variant="primary"
              onClick={applyFilters}
            >
              Appliquer
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Modal de confirmation de suppression */}
      <Modal
        isOpen={modalState.confirmDelete !== null}
        onClose={() => setModalState(prev => ({ ...prev, confirmDelete: null }))}
        title="Confirmation de suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p>Êtes-vous sûr de vouloir supprimer cet enregistrement ?</p>
          <p className="text-sm text-error">Cette action est irréversible.</p>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="ghost"
              onClick={() => setModalState(prev => ({ ...prev, confirmDelete: null }))}
            >
              Annuler
            </Button>
            <Button
              variant="error"
              onClick={() => handleDeleteRecord(modalState.confirmDelete)}
            >
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Fonction utilitaire pour formater les valeurs des champs selon leur type
function formatFieldValue(value, fieldType) {
  if (value === null || value === undefined) {
    return '-';
  }
  
  switch (fieldType) {
    case 'boolean':
      return value === true || value === 'true' || value === 1 ? 'Oui' : 'Non';
      
    case 'date':
    case 'datetime':
      try {
        const date = new Date(value);
        return date.toLocaleString();
      } catch {
        return value;
      }
      
    case 'choice':
    case 'text':
    case 'long_text':
    case 'number':
    case 'decimal':
    default:
      return value.toString();
  }
}

RecordList.propTypes = {
  tableId: PropTypes.string.isRequired
};

export default RecordList;