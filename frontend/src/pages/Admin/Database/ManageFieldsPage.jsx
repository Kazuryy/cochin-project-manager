// frontend/src/pages/Admin/Database/ManageFieldsPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import Page from "../../../components/global/Page";
import FieldsManager from "../../../components/tables/FieldsManager";
import { DynamicTableProvider } from "../../../contexts/DynamicTableProvider";

function ManageFieldsPage() {
  const { tableId } = useParams();
  
  return (
    <Page>
      <div className="container mx-auto px-4 py-8">
        <DynamicTableProvider>
          <FieldsManager tableId={tableId} />
        </DynamicTableProvider>
      </div>
    </Page>
  );
}

export default ManageFieldsPage;    