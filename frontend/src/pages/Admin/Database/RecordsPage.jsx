// frontend/src/pages/Admin/Database/RecordsPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import Page from "../../../components/global/Page";
import RecordList from "../../../components/tables/RecordList";
import { DynamicTableProvider } from "../../../contexts/DynamicTableProvider";

/**
 * Page d'affichage des enregistrements d'une table spécifique
 * @returns {JSX.Element} Le composant RecordsPage
 */
const RecordsPage = React.memo(() => {
  const { tableId } = useParams();

  if (!tableId) {
    return (
      <Page>
        <div className="pt-8">
          <p className="text-red-500">Erreur : ID de table non spécifié</p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="pt-8">
        <DynamicTableProvider>
          <RecordList tableId={tableId} />
        </DynamicTableProvider>
      </div>
    </Page>
  );
});

RecordsPage.displayName = 'RecordsPage';

export default RecordsPage;