// frontend/src/pages/Admin/Database/RecordsPage.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import Page from "../../../components/global/Page";
import RecordList from "../../../components/tables/RecordList";
import { DynamicTableProvider } from "../../../contexts/DynamicTableContext";

function RecordsPage() {
  const { tableId } = useParams();
  
  return (
    <Page>
      <div className="pt-8">
        <DynamicTableProvider>
          <RecordList tableId={tableId} />
        </DynamicTableProvider>
      </div>
    </Page>
  );
}

export default RecordsPage;