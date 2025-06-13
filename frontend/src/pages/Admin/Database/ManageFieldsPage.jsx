// frontend/src/pages/Admin/Database/ManageFieldsPage.jsx
import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Page from "../../../components/global/Page";
import FieldsManager from "../../../components/tables/FieldsManager";
import { DynamicTableProvider } from "../../../contexts/DynamicTableProvider";

/**
 * Page de gestion des champs d'une table
 * @component
 * @param {Object} props - Les propriétés du composant
 * @returns {JSX.Element} Le composant de gestion des champs
 */
function ManageFieldsPage() {
  const { tableId } = useParams();

  // Mémoisation du provider pour éviter les re-rendus inutiles
  const tableProvider = useMemo(() => (
    <DynamicTableProvider>
      <FieldsManager tableId={tableId} />
    </DynamicTableProvider>
  ), [tableId]);

  // Vérification de la présence du tableId
  if (!tableId) {
    return (
      <Page>
        <div className="container mx-auto px-4 py-8">
          <div className="text-red-500">Erreur : ID de table manquant</div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="container mx-auto px-4 py-8">
        {tableProvider}
      </div>
    </Page>
  );
}

ManageFieldsPage.propTypes = {
  // Les props seront ajoutées si nécessaire
};

export default ManageFieldsPage;    