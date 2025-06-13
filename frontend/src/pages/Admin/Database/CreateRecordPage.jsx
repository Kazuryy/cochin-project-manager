// frontend/src/pages/Admin/Database/CreateRecordPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import Page from "../../../components/global/Page";
import RecordForm from "../../../components/tables/RecordForm";
import { DynamicTableProvider } from "../../../contexts/DynamicTableProvider";

/**
 * Page de création d'un nouvel enregistrement dans une table dynamique
 * @returns {JSX.Element} Le composant de la page de création d'enregistrement
 */
const CreateRecordPage = React.memo(() => {
  const { tableId } = useParams();

  if (!tableId) {
    return (
      <Page>
        <div className="pt-8 flex justify-center">
          <p className="text-red-500">Erreur : ID de table non spécifié</p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="pt-8 flex justify-center">
        <DynamicTableProvider>
          <RecordForm tableId={tableId} />
        </DynamicTableProvider>
      </div>
    </Page>
  );
});

CreateRecordPage.displayName = 'CreateRecordPage';

export default CreateRecordPage;