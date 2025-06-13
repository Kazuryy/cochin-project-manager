// frontend/src/components/tables/TableList.jsx
import React, { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useDynamicTables } from '../../contexts/hooks/useDynamicTables';
import { Card, Button, Alert } from '../ui';
import { FiEdit2, FiTrash2, FiPlus, FiDatabase } from 'react-icons/fi';
import api from '../../services/api';

// Constants
const SUCCESS_MESSAGE_DURATION = 3000;
const MESSAGES = {
  DELETE_SUCCESS: 'Table supprimée avec succès',
  DELETE_ERROR: 'Une erreur est survenue lors de la suppression de la table.',
  NO_TABLES: 'Aucune table n\'a été créée',
  CREATE_FIRST: 'Créer votre première table',
  CONFIRM_DELETE: 'Confirmer la suppression ?',
  YES: 'Oui',
  NO: 'Non',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  NO_DESCRIPTION: 'Aucune description'
};

/**
 * TableList component displays a grid of database tables with management options
 * @returns {JSX.Element} The rendered component
 */
function TableList() {
  const { tables, fetchTables, isLoading, error } = useDynamicTables();
  const [confirmDelete, setConfirmDelete] = React.useState(null);
  const [successMessage, setSuccessMessage] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const handleDelete = useCallback(async (tableId) => {
    if (!tableId) return;
    
    setIsDeleting(true);
    try {
      await api.delete(`/api/database/tables/${tableId}/`);
      setSuccessMessage(MESSAGES.DELETE_SUCCESS);
      setTimeout(() => setSuccessMessage(''), SUCCESS_MESSAGE_DURATION);
      await fetchTables();
    } catch (err) {
      console.error('Erreur lors de la suppression de la table :', err);
      setSuccessMessage(MESSAGES.DELETE_ERROR);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(null);
    }
  }, [fetchTables]);

  const renderTableCard = useCallback((table) => (
    <Card key={table.id} className="bg-base-100">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold">{table.name}</h3>
          <p className="text-sm text-base-content/70">
            {table.description || MESSAGES.NO_DESCRIPTION}
          </p>
        </div>
        <div className="badge badge-primary">
          {table.is_active ? MESSAGES.ACTIVE : MESSAGES.INACTIVE}
        </div>
      </div>

      <div className="divider my-2" />

      <div className="flex justify-between mt-2">
        <div className="space-x-2">
          <Link to={`/admin/database/tables/${table.id}/records`}>
            <Button variant="ghost" size="sm" aria-label="Voir les données">
              <FiDatabase className="mr-1" />
              Données
            </Button>
          </Link>

          <Link to={`/admin/database/tables/${table.id}/fields`}>
            <Button variant="ghost" size="sm" aria-label="Gérer les champs">
              <FiEdit2 className="mr-1" />
              Champs
            </Button>
          </Link>
        </div>

        <div className="space-x-2">
          <Link to={`/admin/database/tables/${table.id}/edit`}>
            <Button variant="ghost" size="sm" aria-label="Modifier la table">
              <FiEdit2 className="mr-1" />
              Modifier
            </Button>
          </Link>

          {confirmDelete === table.id ? (
            <div className="flex flex-col items-end space-y-2">
              <p className="text-sm mb-2">{MESSAGES.CONFIRM_DELETE}</p>
              <div className="flex space-x-2">
                <Button
                  variant="error"
                  size="xs"
                  onClick={() => handleDelete(table.id)}
                  disabled={isDeleting}
                >
                  {MESSAGES.YES}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setConfirmDelete(null)}
                  disabled={isDeleting}
                >
                  {MESSAGES.NO}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(table.id)}
              disabled={isDeleting}
              aria-label="Supprimer la table"
            >
              <FiTrash2 className="mr-1" />
              Supprimer
            </Button>
          )}
        </div>
      </div>
    </Card>
  ), [confirmDelete, handleDelete, isDeleting]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des tables</h2>
        <Link to="/admin/database/tables/create">
          <Button variant="primary" aria-label="Créer une nouvelle table">
            <FiPlus className="mr-2" />
            Créer une table
          </Button>
        </Link>
      </div>

      {error && <Alert type="error" message={error} />}
      {successMessage && <Alert type="success" message={successMessage} />}

      {isLoading ? (
        <div className="flex justify-center p-8">
          <span className="loading loading-spinner loading-lg" role="status" aria-label="Chargement en cours" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map(renderTableCard)}

          {tables.length === 0 && !isLoading && (
            <div className="col-span-full text-center p-8 bg-base-200 rounded-box">
              <p>{MESSAGES.NO_TABLES}</p>
              <Link to="/admin/database/tables/create" className="link link-primary mt-2 inline-block">
                {MESSAGES.CREATE_FIRST}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

TableList.propTypes = {
  // Add PropTypes if needed
};

export default React.memo(TableList);