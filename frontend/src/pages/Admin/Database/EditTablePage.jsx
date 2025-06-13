// frontend/src/pages/Admin/Database/EditTablePage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import Page from "../../../components/global/Page";
import TableForm from "../../../components/tables/TableForm";
import { DynamicTableProvider } from "../../../contexts/DynamicTableProvider";

/**
 * Page d'édition d'une table dans l'interface d'administration
 * @returns {JSX.Element} Le composant de la page d'édition
 */
const EditTablePage = React.memo(() => {
  const { tableId } = useParams();

  if (!tableId) {
    return (
      <Page>
        <div className="pt-8 flex justify-center">
          <p className="text-red-500">Erreur : ID de table manquant</p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="pt-8 flex justify-center">
        <DynamicTableProvider>
          <TableForm tableId={tableId} />
        </DynamicTableProvider>
      </div>
    </Page>
  );
});

EditTablePage.displayName = 'EditTablePage';

export default EditTablePage;