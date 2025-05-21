// frontend/src/pages/Admin/Database/CreateTablePage.jsx
import React from 'react';
import Page from "../../../components/global/Page";
import TableForm from "../../../components/tables/TableForm";
import { DynamicTableProvider } from "../../../contexts/DynamicTableContext";

function CreateTablePage() {
  return (
    <Page>
      <div className="pt-8 flex justify-center">
        <DynamicTableProvider>
          <TableForm />
        </DynamicTableProvider>
      </div>
    </Page>
  );
}

export default CreateTablePage;