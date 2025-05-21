// frontend/src/components/tables/RecordList.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useDynamicTables } from '../../contexts/hooks/useDynamicTables';
import { Button, Alert, Modal } from '../ui';
import { FiPlus, FiEdit, FiTrash2, FiFilter, FiSearch, FiDownload } from 'react-icons/fi';

function RecordList({ tableId }) {
  const { 
    fetchTableWithFields, 
    fetchRecords, 
    deleteRecord, 
    isLoading, 
    error: contextError 
  } = useDynamicTables();
  
  const [table, setTable] = useState(null);
  const [fields, setFields] = useState([]);
  const [records, setRecords] = useState([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [deleteError, setDeleteError] = useState('');
  
  // Charger les données de la table et ses champs
  useEffect(() => {
    const loadTable = async () => {
      const tableData = await fetchTableWithFields(tableId);
      if (tableData) {
        setTable(tableData);
        setFields(tableData.fields || []);
      }
    };
    
    loadTable();
  }, [tableId, fetchTableWithFields]);
  
  // Charger les enregistrements
  useEffect(() => {
    const loadRecords = async () => {
      if (table) {
        const recordsData = await fetchRecords(tableId, filters);
        setRecords(recordsData || []);
      }
    };
    
    loadRecords();
  }, [tableId, table, filters, fetchRecords]);
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const applyFilters = () => {
    // Les filtres sont déjà appliqués via l'effet ci-dessus
    setIsFilterModalOpen(false);
  };
  
  const resetFilters = () => {
    setFilters({});
    setIsFilterModalOpen(false);
  };
  
  const handleDeleteRecord = async (recordId) => {
    try {
      console.log("Suppression de l'enregistrement:", recordId); // Pour debugging
      
      // Utiliser directement la fonction du contexte
      const success = await deleteRecord(recordId);
      
      if (success) {
        console.log("Suppression réussie");
        // Mettre à jour l'état local pour refléter la suppression
        setRecords(prevRecords => prevRecords.filter(record => record.id !== recordId));
        setSuccessMessage('Enregistrement supprimé avec succès');
        
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        throw new Error("Échec de la suppression de l'enregistrement");
      }
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setDeleteError(err.message || "Une erreur s'est produite lors de la suppression");
      
      setTimeout(() => {
        setDeleteError('');
      }, 3000);
    } finally {
      // Toujours réinitialiser l'état de confirmation
      setConfirmDelete(null);
    }
  };
  
  const exportToCSV = () => {
    if (!records.length || !fields.length) return;
    
    // Créer les en-têtes
    const headers = fields.map(field => field.name);
    
    // Créer les lignes de données
    const dataRows = records.map(record => {
      return fields.map(field => {
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
    link.setAttribute('download', `${table?.name || 'table'}_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Filtrage par recherche textuelle
  const filteredRecords = searchTerm 
    ? records.filter(record => {
        // Rechercher dans tous les champs de texte
        return fields.some(field => {
          if (field.field_type === 'text' || field.field_type === 'long_text') {
            const value = record[field.slug];
            return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
          }
          return false;
        });
      })
    : records;
  
  // Fonction pour rendre le champ de filtrage approprié
  const renderFilterField = (field) => {
    const commonProps = {
      name: field.slug,
      value: filters[field.slug] || '',
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {table ? `Enregistrements - ${table.name}` : 'Chargement...'}
        </h2>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setIsFilterModalOpen(true)}
          >
            <FiFilter className="mr-2" />
            Filtres
          </Button>
          
          <Button
            variant="outline"
            onClick={exportToCSV}
            isDisabled={!records.length}
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
      
      {deleteError && (
        <Alert type="error" message={deleteError} />
      )}
      
      {successMessage && (
        <Alert type="success" message={successMessage} />
      )}
      
      {/* Barre de recherche */}
      <div className="form-control">
        <div className="input-group">
          <input
            type="text"
            placeholder="Rechercher..."
            className="input input-bordered w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button variant="ghost">
            <FiSearch />
          </Button>
        </div>
      </div>
      
      {isLoading && !table ? (
        <div className="flex justify-center p-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>ID</th>
                {fields.map(field => (
                  <th key={field.id}>{field.name}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    {fields.map(field => (
                      <td key={`${record.id}-${field.id}`}>
                        {formatFieldValue(record[field.slug], field.field_type)}
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
                          onClick={() => setConfirmDelete(record.id)}
                        >
                          <FiTrash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={fields.length + 2} className="text-center py-4">
                    {isLoading
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
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title="Filtrer les enregistrements"
      >
        <div className="space-y-4">
          {fields
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
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Confirmation de suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p>Êtes-vous sûr de vouloir supprimer cet enregistrement ?</p>
          <p className="text-sm text-error">Cette action est irréversible.</p>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(null)}
            >
              Annuler
            </Button>
            <Button
              variant="error"
              onClick={() => handleDeleteRecord(confirmDelete)}
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