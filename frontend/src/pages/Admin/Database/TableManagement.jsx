import React from 'react';
import TableList from '../../../components/tables/TableList';

/**
 * Composant TableManagement
 * Gère l'affichage et la gestion des tables de la base de données
 * @returns {JSX.Element} Le composant TableManagement
 */
const TableManagement = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <TableList />
    </div>
  );
};

TableManagement.propTypes = {
  // Ajoutez ici les props si nécessaire
};

TableManagement.defaultProps = {
  // Ajoutez ici les valeurs par défaut si nécessaire
};

export default React.memo(TableManagement);