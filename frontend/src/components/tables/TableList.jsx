// frontend/src/components/tables/TableList.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDynamicTables } from '../../contexts/hooks/useDynamicTables';
import { Card, Button, Alert } from '../ui';
import { FiEdit2, FiTrash2, FiPlus, FiDatabase } from 'react-icons/fi';
import api from '../../services/api'; // Import du service API

function TableList() {
  const { tables, fetchTables, isLoading, error } = useDynamicTables();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const handleDelete = async (tableId) => {
    try {
      await api.delete(`/api/database/tables/${tableId}/`); // Appel direct à l'API pour supprimer la table
      setSuccessMessage('Table supprimée avec succès');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchTables(); // Rafraîchit la liste des tables après suppression
    } catch (err) {
      console.error('Erreur lors de la suppression de la table :', err);
      alert('Une erreur est survenue lors de la suppression de la table.');
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des tables</h2>
        <Link to="/admin/database/tables/create">
          <Button variant="primary">
            <FiPlus className="mr-2" />
            Créer une table
          </Button>
        </Link>
      </div>

      {error && <Alert type="error" message={error} />}
      {successMessage && <Alert type="success" message={successMessage} />}

      {isLoading ? (
        <div className="flex justify-center p-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map((table) => (
            <Card key={table.id} className="bg-base-100">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold">{table.name}</h3>
                  <p className="text-sm text-base-content/70">{table.description || 'Aucune description'}</p>
                </div>
                <div className="badge badge-primary">{table.is_active ? 'Active' : 'Inactive'}</div>
              </div>

              <div className="divider my-2"></div>

              <div className="flex justify-between mt-2">
                <div className="space-x-2">
                  <Link to={`/admin/database/tables/${table.id}/records`}>
                    <Button variant="ghost" size="sm">
                      <FiDatabase className="mr-1" />
                      Données
                    </Button>
                  </Link>

                  <Link to={`/admin/database/tables/${table.id}/fields`}>
                    <Button variant="ghost" size="sm">
                      <FiEdit2 className="mr-1" />
                      Champs
                    </Button>
                  </Link>
                </div>

                <div className="space-x-2">
                  <Link to={`/admin/database/tables/${table.id}/edit`}>
                    <Button variant="ghost" size="sm">
                      <FiEdit2 className="mr-1" />
                      Modifier
                    </Button>
                  </Link>

                  {confirmDelete === table.id ? (
                    <div className="flex flex-col items-end space-y-2">
                      <p className="text-sm mb-2">Confirmer la suppression ?</p>
                      <div className="flex space-x-2">
                        <Button
                          variant="error"
                          size="xs"
                          onClick={() => handleDelete(table.id)}
                        >
                          Oui
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Non
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(table.id)}
                    >
                      <FiTrash2 className="mr-1" />
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {tables.length === 0 && !isLoading && (
            <div className="col-span-full text-center p-8 bg-base-200 rounded-box">
              <p>Aucune table n'a été créée</p>
              <Link to="/admin/database/tables/create" className="link link-primary mt-2 inline-block">
                Créer votre première table
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TableList;