// frontend/src/pages/Admin/Database/EditTablePage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import Page from "../../../components/global/Page";
import TableForm from "../../../components/tables/TableForm";
import { DynamicTableProvider } from "../../../contexts/DynamicTableContext";

function EditTablePage() {
  const { tableId } = useParams();
  
  return (
    <Page>
      <div className="pt-8 flex justify-center">
        <DynamicTableProvider>
          <TableForm tableId={tableId} />
        </DynamicTableProvider>
      </div>
    </Page>
  );
}

export default EditTablePage;