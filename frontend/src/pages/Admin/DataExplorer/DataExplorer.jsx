import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FiDatabase, FiTable, FiSearch, FiEye, FiExternalLink, FiRefreshCw } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';

// Composant pour afficher les statistiques de la table
const TableStats = ({ stats }) => {
  if (!stats) return null;
  
  return (
    <div className="stats stats-horizontal shadow-md rounded-xl mt-4">
      <div className="stat py-3">
        <div className="stat-title text-xs font-medium opacity-70">Enregistrements</div>
        <div className="stat-value text-xl font-bold text-primary">{stats.totalRecords}</div>
      </div>
      <div className="stat py-3">
        <div className="stat-title text-xs font-medium opacity-70">Champs</div>
        <div className="stat-value text-xl font-bold text-secondary">{stats.totalFields}</div>
      </div>
      <div className="stat py-3">
        <div className="stat-title text-xs font-medium opacity-70">Dernière MAJ</div>
        <div className="stat-value text-sm font-semibold">{stats.lastUpdated}</div>
      </div>
    </div>
  );
};

TableStats.propTypes = {
  stats: PropTypes.shape({
    totalRecords: PropTypes.number.isRequired,
    totalFields: PropTypes.number.isRequired,
    lastUpdated: PropTypes.string.isRequired
  })
};

// Composant pour la barre de recherche
const SearchBar = ({ searchTerm, onSearch, resultCount }) => (
  <div className="p-4 bg-base-100 border-b border-base-300/50">
    <div className="flex items-center space-x-4">
      <div className="relative flex-1">
        <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-base-content/50" />
        <input
          type="text"
          placeholder="Rechercher dans les données..."
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
          className="input input-bordered w-full pl-12 rounded-xl"
        />
      </div>
      
      {searchTerm && (
        <div className="badge badge-outline badge-lg">
          {resultCount} résultat(s)
        </div>
      )}
    </div>
  </div>
);

SearchBar.propTypes = {
  searchTerm: PropTypes.string.isRequired,
  onSearch: PropTypes.func.isRequired,
  resultCount: PropTypes.number.isRequired
};

function DataExplorer() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [records, setRecords] = useState([]);
  const [fields, setFields] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(20);
  const [error, setError] = useState(null);

  // CORRECTION: Déplacer fetchTables et fetchTableData en premier
  const fetchTables = useCallback(async () => {
    try {
      const response = await fetch('/api/database/tables/', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erreur lors du chargement des tables');
      const data = await response.json();
      if (Array.isArray(data)) {
        setTables(data.filter(table => table.is_active));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des tables:', error);
      setError('Impossible de charger les tables');
    }
  }, []);

  const fetchTableData = useCallback(async (tableId) => {
    setIsLoading(true);
    setError(null);
    try {
      // Charger les champs de la table
      const fieldsResponse = await fetch(`/api/database/tables/${tableId}/fields/`, {
        credentials: 'include',
      });
      if (!fieldsResponse.ok) throw new Error('Erreur lors du chargement des champs');
      const fieldsData = await fieldsResponse.json();
      setFields(fieldsData.filter(field => field.is_active));

      // Charger les enregistrements
      const recordsResponse = await fetch(`/api/database/records/by_table/?table_id=${tableId}`, {
        credentials: 'include',
      });
      if (!recordsResponse.ok) throw new Error('Erreur lors du chargement des enregistrements');
      const recordsData = await recordsResponse.json();
      setRecords(Array.isArray(recordsData) ? recordsData : []);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      setError('Impossible de charger les données');
      setRecords([]);
      setFields([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Charger les tables au démarrage
  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Charger les données quand une table est sélectionnée
  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable.id);
    }
  }, [selectedTable, fetchTableData]);

  // Reset de la page lors du changement de table
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTable]);

  const getValueFromFlatData = useCallback((record, field) => {
    if (!record.flat_data) return '-';
    return record.flat_data[field.slug] || record.flat_data[field.name] || '-';
  }, []);

  const getValueFromValues = useCallback((record, field) => {
    if (!record.values?.length) return '-';
    const fieldValue = record.values.find(v => 
      v.field_id === field.id || 
      v.field === field.id ||
      v.field_slug === field.slug ||
      v.field_name === field.name
    );
    return fieldValue ? (fieldValue.value || fieldValue.display_value || '-') : '-';
  }, []);

  const getValueFromRecord = useCallback((record, field) => {
    return record[field.slug] || record[field.name] || '-';
  }, []);

  const getForeignKeyValue = useCallback((record, field, value) => {
    if (value === '-') return value;
    const fkData = record.foreign_key_data?.[field.slug] || 
                  record.fk_data?.[field.slug] ||
                  record.related_data?.[field.slug];
    
    if (fkData && typeof fkData === 'object') {
      const displayValue = fkData.nom || fkData.name || fkData.titre || 
                         fkData.label || fkData.title || fkData.description;
      if (displayValue) return displayValue;
    }
    return `ID: ${value}`;
  }, []);

  const formatSpecialField = useCallback((field, value) => {
    if (value === '-') return value;

    if (field.field_type === 'date') {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('fr-FR');
        }
      } catch {
        // Ignore les erreurs de date
      }
    }
    
    if (field.field_type === 'boolean') {
      return value === 'true' || value === true || value === '1' || value === 1 ? 'Oui' : 'Non';
    }

    const strValue = String(value);
    return strValue.length > 50 ? strValue.substring(0, 50) + '...' : strValue;
  }, []);

  const getFieldValue = useCallback((record, field) => {
    let value = getValueFromFlatData(record, field);
    if (value === '-') value = getValueFromValues(record, field);
    if (value === '-') value = getValueFromRecord(record, field);
    
    if (field.field_type === 'foreign_key') {
      value = getForeignKeyValue(record, field, value);
    }
    
    return formatSpecialField(field, value);
  }, [getValueFromFlatData, getValueFromValues, getValueFromRecord, getForeignKeyValue, formatSpecialField]);

  // Filtrer les enregistrements selon le terme de recherche
  const filteredRecords = useMemo(() => {
    if (!searchTerm) return records;
    const searchLower = searchTerm.toLowerCase();
    return records.filter(record => 
      Object.values(record.flat_data || {}).some(value => 
        String(value).toLowerCase().includes(searchLower)
      )
    );
  }, [records, searchTerm]);

  // Pagination
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * recordsPerPage;
    return filteredRecords.slice(startIndex, startIndex + recordsPerPage);
  }, [filteredRecords, currentPage, recordsPerPage]);

  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);

  // Statistiques de la table
  const tableStats = useMemo(() => {
    if (!selectedTable || !records.length) return null;
    
    return {
      totalRecords: records.length,
      totalFields: fields.length,
      lastUpdated: records[0]?.updated_at 
        ? new Date(records[0].updated_at).toLocaleDateString('fr-FR') 
        : 'N/A'
    };
  }, [selectedTable, records, fields]);

  const handleSearch = useCallback((value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const handleTableSelect = useCallback((table) => {
    setSelectedTable(table);
    setSearchTerm('');
    setError(null);
  }, []);

  const handleRefresh = useCallback(() => {
    if (selectedTable) {
      fetchTableData(selectedTable.id);
    }
  }, [selectedTable, fetchTableData]);

  const getTableClassName = useCallback((table) => {
    return `p-4 rounded-xl cursor-pointer transition-all duration-200 mb-3 hover:shadow-md ${
      selectedTable?.id === table.id 
        ? 'bg-primary text-primary-content shadow-lg' 
        : 'hover:bg-base-300 bg-base-100'
    }`;
  }, [selectedTable]);

  return (
    <div className="flex h-screen bg-base-100">
      {/* Sidebar des tables */}
      <div className="w-80 bg-base-200/50 border-r border-base-300/50 overflow-y-auto">
        <div className="p-4 border-b border-base-300/50 bg-base-100">
          <h2 className="text-xl font-bold flex items-center">
            <FiDatabase className="mr-3 text-primary" size={24} />
            Tables ({tables.length})
          </h2>
        </div>
        
        <div className="p-3">
          {tables.map(table => (
            <div
              key={table.id}
              onClick={() => handleTableSelect(table)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleTableSelect(table);
                }
              }}
              className={getTableClassName(table)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center">
                    <FiTable className="mr-2 text-sm" />
                    {table.name}
                  </div>
                  {table.description && (
                    <div className="text-xs opacity-70 mt-1">
                      {table.description.length > 40 
                        ? table.description.substring(0, 40) + '...' 
                        : table.description
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col">
        {selectedTable ? (
          <>
            {/* Header */}
            <div className="bg-base-100 border-b border-base-300/50 p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-base-content">{selectedTable.name}</h1>
                  {selectedTable.description && (
                    <p className="text-sm opacity-70 mt-1">{selectedTable.description}</p>
                  )}
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRefresh}
                    className="btn btn-ghost btn-sm rounded-xl"
                    disabled={isLoading}
                  >
                    <FiRefreshCw className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Actualiser
                  </button>
                  
                  <Link
                    to={`/projects`}
                    className="btn btn-primary btn-sm rounded-xl"
                  >
                    <FiExternalLink className="mr-2" />
                    Gérer les projets
                  </Link>
                </div>
              </div>

              {error && (
                <div className="alert alert-error mt-4 rounded-xl">
                  <span>{error}</span>
                </div>
              )}

              {/* Stats */}
              {tableStats && (
                <TableStats stats={tableStats} />
              )}
            </div>

            {/* Barre de recherche */}
            <SearchBar
              searchTerm={searchTerm}
              onSearch={handleSearch}
              resultCount={filteredRecords.length}
            />

            {/* Tableau des données */}
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                  <span className="ml-3 text-base-content/70">Chargement des données...</span>
                </div>
              ) : paginatedRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead className="sticky top-0 bg-base-200 z-10">
                      <tr>
                        <th className="w-16 font-semibold">ID</th>
                        {fields.slice(0, 6).map(field => (
                          <th key={field.id} className="min-w-32">
                            <div className="flex flex-col">
                              <span className="font-semibold">{field.name}</span>
                              <span className="text-xs opacity-60 font-normal">
                                {field.field_type}
                                {field.is_required && ' *'}
                              </span>
                            </div>
                          </th>
                        ))}
                        {fields.length > 6 && (
                          <th className="text-center">
                            <span className="badge badge-outline">
                              +{fields.length - 6} champs
                            </span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRecords.map((record) => (
                        <tr key={record.id} className="hover">
                          <td className="font-mono text-sm font-medium">{record.id}</td>
                          {fields.slice(0, 6).map(field => (
                            <td key={field.id} className="max-w-48">
                              <div className="truncate" title={getFieldValue(record, field)}>
                                {getFieldValue(record, field)}
                              </div>
                            </td>
                          ))}
                          {fields.length > 6 && (
                            <td className="text-center">
                              <Link
                                to={`/projects/${record.id}`}
                                className="btn btn-ghost btn-xs rounded-lg"
                              >
                                <FiEye className="mr-1" />
                                Voir projet
                              </Link>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-base-content/50">
                  <FiTable className="text-6xl mb-4" />
                  <p className="text-lg">
                    {searchTerm ? 'Aucun résultat trouvé' : 'Aucune donnée dans cette table'}
                  </p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-base-300/50 p-4 bg-base-100">
                <div className="flex justify-center">
                  <div className="join">
                    <button
                      className="join-item btn btn-sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Précédent
                    </button>
                    
                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      if (page === 1 || page === totalPages || (page >= currentPage - 2 && page <= currentPage + 2)) {
                        return (
                          <button
                            key={page}
                            className={`join-item btn btn-sm ${currentPage === page ? 'btn-active' : ''}`}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 3 || page === currentPage + 3) {
                        return <span key={page} className="join-item btn btn-sm btn-disabled">...</span>;
                      }
                      return null;
                    })}
                    
                    <button
                      className="join-item btn btn-sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-base-content/50">
            <div className="text-center">
              <FiDatabase className="text-8xl mb-6 mx-auto opacity-50" />
              <h2 className="text-3xl font-bold mb-3">Explorateur de Données</h2>
              <p className="text-lg">Sélectionnez une table dans la sidebar pour explorer ses données</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataExplorer;