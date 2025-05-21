// frontend/src/pages/Admin/Database/EditRecordPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import Page from "../../../components/global/Page";
import RecordForm from "../../../components/tables/RecordForm";
import { DynamicTableProvider } from "../../../contexts/DynamicTableContext";

function EditRecordPage() {
  const { tableId, recordId } = useParams();
  
  return (
    <Page>
      <div className="pt-8 flex justify-center">
        <DynamicTableProvider>
          <RecordForm tableId={tableId} recordId={recordId} />
        </DynamicTableProvider>
      </div>
    </Page>
  );
}

export default EditRecordPage;