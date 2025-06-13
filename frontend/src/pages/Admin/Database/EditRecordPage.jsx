// frontend/src/pages/Admin/Database/EditRecordPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import Page from "../../../components/global/Page";
import RecordForm from "../../../components/tables/RecordForm";
import { DynamicTableProvider } from "../../../contexts/DynamicTableProvider";

/**
 * Page d'édition d'un enregistrement dans une table dynamique
 * @returns {JSX.Element} Le composant de page d'édition
 */
const EditRecordPage = React.memo(() => {
  const { tableId, recordId } = useParams();

  // Vérification des paramètres requis
  if (!tableId || !recordId) {
    return (
      <Page>
        <div className="pt-8 flex justify-center">
          <p className="text-red-500">Paramètres manquants</p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="pt-8 flex justify-center">
        <DynamicTableProvider>
          <RecordForm tableId={tableId} recordId={recordId} />
        </DynamicTableProvider>
      </div>
    </Page>
  );
});

EditRecordPage.displayName = 'EditRecordPage';

export default EditRecordPage;