import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDynamicTables } from '../contexts/hooks/useDynamicTables';
import { DynamicTableProvider } from '../contexts/DynamicTableProvider';
import api from '../services/api';

function ProjectDetailsContent() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { tables, fetchRecords, isLoading } = useDynamicTables();

  const [projectData, setProjectData] = useState(null);
  const [projectDetailsData, setProjectDetailsData] = useState(null);
  const [detailsTable, setDetailsTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fonction utilitaire pour extraire les valeurs des champs dynamiques
  const getFieldValue = useCallback((record, ...possibleFields) => {
    if (!record) return '';
    
    for (const field of possibleFields) {
      if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
        return record[field];
      }
    }
    
    if (record.values && Array.isArray(record.values)) {
      for (const field of possibleFields) {
        const valueField = record.values.find(v => v.field_slug === field);
        if (valueField?.value && valueField.value !== undefined && valueField.value !== null && valueField.value !== '') {
          return valueField.value;
        }
      }
    }
    
    return '';
  }, []);

  // Fonction pour formater une valeur selon son type
  const formatValue = useCallback((value, field) => {
    if (!value) return '-';
    
    switch (field?.field_type) {
      case 'date':
        try {
          return new Date(value).toLocaleDateString('fr-FR');
        } catch {
          return value;
        }
      case 'datetime':
        try {
          return new Date(value).toLocaleString('fr-FR');
        } catch {
          return value;
        }
      case 'boolean':
        return value === 'true' || value === true ? 'Oui' : 'Non';
      default:
        // Pour les FK et autres, le backend retourne déjà la valeur lisible
        return value;
    }
  }, []);

  // Fonction pour charger les détails du projet principal
  const loadProjectData = useCallback(async () => {
    try {
      // Trouver la table Projet
      const projectTable = tables.find(t => 
        t.name === 'Projet' || t.slug === 'projet' ||
        t.name === 'Projets' || t.slug === 'projets'
      );

      if (!projectTable) {
        throw new Error('Table Projet introuvable');
      }

      // Charger l'enregistrement du projet
      const response = await api.get(`/api/database/records/${projectId}/`);
      console.log('📋 Données du projet chargées:', response);
      
      setProjectData(response);
      return response;
    } catch (err) {
      console.error('Erreur lors du chargement du projet:', err);
      throw err;
    }
  }, [projectId, tables]);

  // Fonction pour trouver et charger les détails spécifiques du projet
  const loadProjectDetails = useCallback(async (project) => {
    try {
      // Extraire le type de projet
      const projectType = getFieldValue(project, 'type_projet', 'type', 'projet_type');
      console.log('🎯 Type de projet détecté:', projectType);

      if (!projectType) {
        console.log('⚠️ Aucun type de projet défini');
        return;
      }

      // Trouver la table {Type}Details correspondante
      const detailsTableName = `${projectType}Details`;
      const foundDetailsTable = tables.find(table => 
        table.name === detailsTableName ||
        table.name.toLowerCase() === detailsTableName.toLowerCase()
      );

      if (!foundDetailsTable) {
        console.log(`⚠️ Table ${detailsTableName} non trouvée`);
        return;
      }

      console.log('✅ Table Details trouvée:', foundDetailsTable.name);
      setDetailsTable(foundDetailsTable);

      // Charger tous les enregistrements de la table Details
      const detailsRecords = await fetchRecords(foundDetailsTable.id);
      console.log('📊 Enregistrements Details:', detailsRecords);

      // Logs détaillés pour le débogage
      console.log('🔍 Recherche de correspondance pour projet ID:', projectId);
      console.log('🔍 Type attendu:', typeof projectId);
      
      detailsRecords.forEach((record, index) => {
        console.log(`📝 Enregistrement ${index + 1}:`, record);
        console.log(`📝 Propriétés directes:`, {
          projet: record.projet,
          project: record.project,
          id_projet: record.id_projet,
          projet_id: record.projet_id,
          projet_auto: record.projet_auto
        });
        
        // Vérifier toutes les propriétés qui contiennent "projet"
        const allProjectKeys = Object.keys(record).filter(key => 
          key.toLowerCase().includes('projet') || key.toLowerCase().includes('project')
        );
        console.log(`📝 Toutes les clés contenant "projet":`, allProjectKeys);
        allProjectKeys.forEach(key => {
          console.log(`  - ${key}: ${record[key]} (type: ${typeof record[key]})`);
        });
      });

      // Trouver l'enregistrement qui correspond à notre projet
      // Chercher un enregistrement qui a une FK vers notre projet
      const projectRecord = detailsRecords.find(record => {
        console.log(`🔍 Test correspondance pour enregistrement:`, record.id);
        
        // Vérifier les propriétés directes avec comparaison de type flexible
        const directMatches = [
          { key: 'projet', value: record.projet },
          { key: 'project', value: record.project },
          { key: 'id_projet', value: record.id_projet },
          { key: 'projet_id', value: record.projet_id },
          { key: 'projet_auto', value: record.projet_auto },
          { key: 'id_projet_id', value: record.id_projet_id }
        ];
        
        for (const match of directMatches) {
          if (match.value !== undefined && match.value !== null) {
            // Comparaison flexible (string vs number)
            const valueAsString = String(match.value);
            const projectIdAsString = String(projectId);
            console.log(`  🔍 Test ${match.key}: "${valueAsString}" == "${projectIdAsString}" ?`, valueAsString === projectIdAsString);
            
            if (valueAsString === projectIdAsString) {
              console.log(`✅ Correspondance trouvée via ${match.key}!`);
              return true;
            }
          }
        }
        
        // Chercher dans les propriétés values si elles existent encore
        if (record.values && Array.isArray(record.values)) {
          console.log(`  🔍 Test dans values array:`, record.values);
          const found = record.values.some(value => {
            const hasProjectSlug = value.field_slug && 
              (value.field_slug.includes('projet') || value.field_slug.includes('project'));
            
            if (hasProjectSlug) {
              const valueAsString = String(value.value);
              const projectIdAsString = String(projectId);
              console.log(`    🔍 Test field ${value.field_slug}: "${valueAsString}" == "${projectIdAsString}" ?`, valueAsString === projectIdAsString);
              
              if (valueAsString === projectIdAsString) {
                console.log(`✅ Correspondance trouvée via values.${value.field_slug}!`);
                return true;
              }
            }
            
            return false;
          });
          
          if (found) return true;
        }
        
        console.log(`❌ Aucune correspondance pour enregistrement ${record.id}`);
        return false;
      });

      if (projectRecord) {
        console.log('✅ Enregistrement Details trouvé:', projectRecord);
        setProjectDetailsData(projectRecord);
      } else {
        console.log('⚠️ Aucun enregistrement Details trouvé pour ce projet');
      }

    } catch (err) {
      console.error('Erreur lors du chargement des détails:', err);
    }
  }, [tables, getFieldValue, fetchRecords, projectId]);

  // Charger toutes les données au montage
  useEffect(() => {
    const loadAllData = async () => {
      if (!tables.length || !projectId) return;

      setLoading(true);
      setError(null);

      try {
        const project = await loadProjectData();
        await loadProjectDetails(project);
      } catch (err) {
        setError(err.message || 'Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [tables, projectId, loadProjectData, loadProjectDetails]);

  // Fonction pour rendre une section de données
  const renderDataSection = useCallback((data, fields, title) => {
    if (!data || !fields) return null;

    return (
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h2 className="card-title text-xl mb-4">{title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((field) => {
              return (
                <div key={field.id} className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">{field.name}</span>
                  </label>
                  <div className="p-3 bg-base-200 rounded-lg">
                    <span>{formatValue(getFieldValue(data, field.slug, field.name.toLowerCase().replace(' ', '_')), field)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }, [getFieldValue, formatValue]);

  if (loading || isLoading) {
    return (
      <div className="hero min-h-screen">
        <div className="hero-content text-center">
          <div>
            <span className="loading loading-spinner loading-lg"></span>
            <p className="py-6">Chargement des détails du projet...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hero min-h-screen">
        <div className="hero-content text-center">
          <div>
            <h1 className="text-5xl font-bold text-error">Erreur</h1>
            <p className="py-6">{error}</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Retour au dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="hero min-h-screen">
        <div className="hero-content text-center">
          <div>
            <h1 className="text-5xl font-bold">Projet introuvable</h1>
            <p className="py-6">Le projet demandé n'existe pas ou a été supprimé.</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Retour au dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Trouver la table Projet pour récupérer ses champs
  const projectTable = tables.find(t => 
    t.name === 'Projet' || t.slug === 'projet' ||
    t.name === 'Projets' || t.slug === 'projets'
  );

  const projectName = getFieldValue(projectData, 'nom_projet', 'nom', 'name', 'title');
  const projectType = getFieldValue(projectData, 'type_projet', 'type', 'projet_type');

  return (
    <div className="min-h-screen bg-base-100">
      <div className="container mx-auto p-6 max-w-6xl">
        
        {/* Header */}
        <div className="mb-8">
          <div className="breadcrumbs text-sm mb-4">
            <ul>
              <li><Link to="/" className="link link-hover">Accueil</Link></li>
              <li><Link to="/dashboard" className="link link-hover">Projets</Link></li>
              <li>{projectName || `Projet #${projectId}`}</li>
            </ul>
          </div>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold mb-2">{projectName || `Projet #${projectId}`}</h1>
              {projectType && (
                <div className="badge badge-primary badge-lg">{projectType}</div>
              )}
            </div>
            
            <div className="flex gap-2">
              <button 
                className="btn btn-outline"
                onClick={() => navigate('/dashboard')}
              >
                ← Retour
              </button>
              <button className="btn btn-primary">
                ✏️ Modifier
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Section: Informations générales du projet */}
          {projectTable && renderDataSection(
            projectData, 
            projectTable.fields || [], 
            "📋 Informations générales"
          )}

          {/* Section: Détails spécifiques selon le type */}
          {detailsTable && projectDetailsData && renderDataSection(
            projectDetailsData, 
            detailsTable.fields?.filter(field => 
              // Exclure les champs FK vers Projet (déjà affiché dans la section générale)
              !(field.field_type === 'foreign_key' && 
                (field.slug.includes('projet') || field.slug.includes('project'))
              )
            ) || [], 
            `⚙️ Détails ${projectType}`
          )}

          {/* Section: Informations manquantes */}
          {detailsTable && !projectDetailsData && (
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="card-title text-xl mb-4">⚙️ Détails {projectType}</h2>
                <div className="alert alert-warning">
                  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span>Aucun détail spécifique trouvé pour ce projet de type "{projectType}".</span>
                </div>
              </div>
            </div>
          )}

          {/* Debug info en développement */}
          <div className="collapse collapse-arrow bg-base-300">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-medium">
              Informations de débogage
            </div>
            <div className="collapse-content">
              <div className="text-xs space-y-2">
                <div><strong>ID Projet:</strong> {projectId}</div>
                <div><strong>Type détecté:</strong> {projectType || 'Aucun'}</div>
                <div><strong>Table Details:</strong> {detailsTable?.name || 'Non trouvée'}</div>
                <div><strong>Données projet:</strong> {projectData ? 'Chargées' : 'Non chargées'}</div>
                <div><strong>Données details:</strong> {projectDetailsData ? 'Chargées' : 'Non chargées'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectDetails() {
  return (
    <DynamicTableProvider>
      <ProjectDetailsContent />
    </DynamicTableProvider>
  );
}

export default ProjectDetails; 