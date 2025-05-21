// frontend/src/pages/Admin/Database/CreateRecordPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import Page from "../../../components/global/Page";
import RecordForm from "../../../components/tables/RecordForm";
import { DynamicTableProvider } from "../../../contexts/DynamicTableContext";

function CreateRecordPage() {
  const { tableId } = useParams();
  
  return (
    <Page>
      <div className="pt-8 flex justify-center">
        <DynamicTableProvider>
          <RecordForm tableId={tableId} />
        </DynamicTableProvider>
      </div>
    </Page>
  );
}

export default CreateRecordPage;