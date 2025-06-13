// frontend/src/pages/Admin/Database/CreateTablePage.jsx
import React, { memo } from 'react';
import Page from "../../../components/global/Page";
import TableForm from "../../../components/tables/TableForm";
import { DynamicTableProvider } from "../../../contexts/DynamicTableProvider";

/**
 * Page de création de table dans l'interface d'administration
 * @component
 * @returns {JSX.Element} Le composant de la page de création de table
 */
const CreateTablePage = memo(() => {
  return (
    <Page title="Création de table">
      <div className="pt-8 flex justify-center">
        <DynamicTableProvider>
          <TableForm />
        </DynamicTableProvider>
      </div>
    </Page>
  );
});

CreateTablePage.displayName = 'CreateTablePage';

export default CreateTablePage;