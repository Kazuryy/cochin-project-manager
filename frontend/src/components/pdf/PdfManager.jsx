import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { pdfService } from '../../services/pdfService';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../common/Toast';

function PdfManager({ projectId, readonly = false }) {
  const [pdfFiles, setPdfFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    displayName: '',
    description: '',
    file: null
  });
  const [uploadErrors, setUploadErrors] = useState({});
  const { toasts, addToast, removeToast } = useToast();

  // Fonction pour afficher les toasts - utilise maintenant le nouveau système
  const showToast = useCallback((message, type = 'info') => {
    addToast(message, type);
  }, [addToast]);

  // Charger les fichiers PDF du projet
  const loadPdfFiles = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const files = await pdfService.getPdfsByProject(projectId);
      setPdfFiles(files);
      console.log(`✅ ${files.length} fichiers PDF chargés pour le projet ${projectId}`);
    } catch (error) {
      console.error('Erreur lors du chargement des PDFs:', error);
      
      // Gérer les erreurs d'authentification
      if (error.message?.includes('403') || error.message?.includes('401')) {
        showToast('Session expirée. Veuillez vous reconnecter.', 'warning');
      } else {
        showToast('Erreur lors du chargement des fichiers PDF', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  // Charger les PDFs au montage du composant
  useEffect(() => {
    loadPdfFiles();
  }, [projectId, loadPdfFiles]); // Simplifier les dépendances

  // Réinitialiser le formulaire d'upload
  const resetUploadForm = () => {
    setUploadForm({
      displayName: '',
      description: '',
      file: null
    });
    setSelectedFile(null);
    setUploadErrors({});
    setShowUploadForm(false);
  };

  // Gérer la sélection de fichier
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validation = pdfService.validatePdfFile(file);
    if (!validation.valid) {
      setUploadErrors({ file: validation.error });
      return;
    }

    setSelectedFile(file);
    setUploadForm(prev => ({
      ...prev,
      file: file,
      displayName: prev.displayName || file.name.replace('.pdf', '')
    }));
    setUploadErrors({});
  };

  // Valider le formulaire d'upload
  const validateUploadForm = () => {
    const errors = {};
    
    if (!uploadForm.displayName.trim()) {
      errors.displayName = 'Le nom d\'affichage est requis';
    }
    
    if (!selectedFile) {
      errors.file = 'Veuillez sélectionner un fichier PDF';
    }
    
    return errors;
  };

  // Uploader un fichier PDF
  const handleUploadPdf = async (e) => {
    e.preventDefault();
    
    const errors = validateUploadForm();
    if (Object.keys(errors).length > 0) {
      setUploadErrors(errors);
      return;
    }

    setUploading(true);
    try {
      await pdfService.uploadPdfForProject(
        projectId,
        selectedFile,
        uploadForm.displayName.trim(),
        uploadForm.description.trim()
      );

      showToast('Fichier PDF uploadé avec succès!', 'success');
      resetUploadForm();
      await loadPdfFiles(); // Recharger la liste

    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      
      // Gérer les erreurs spécifiques
      if (error.response?.data?.details) {
        const apiErrors = error.response.data.details;
        setUploadErrors(apiErrors);
      } else {
        showToast('Erreur lors de l\'upload du fichier', 'error');
      }
    } finally {
      setUploading(false);
    }
  };

  // Supprimer un fichier PDF
  const handleDeletePdf = async (pdfFile) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le fichier "${pdfFile.display_name}" ?`)) {
      return;
    }
    
    setLoading(true);
    try {
      await pdfService.deletePdf(pdfFile.id);
      showToast('Fichier supprimé avec succès', 'success');
      await loadPdfFiles();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Télécharger un fichier PDF
  const handleDownloadPdf = async (pdfFile) => {
    try {
      const url = pdfService.getPdfUrl(pdfFile);
      
      // Ouvrir dans un nouvel onglet avec gestion d'erreur
      const newWindow = window.open(url, '_blank');
      
      // Vérifier si la fenêtre a pu s'ouvrir (popup bloqué)
      if (!newWindow) {
        showToast('Téléchargement bloqué. Autorisez les pop-ups pour ce site.', 'warning');
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement PDF:', error);
      showToast('Erreur lors du téléchargement du fichier', 'error');
    }
  };

  // Rendu du formulaire d'upload
  const renderUploadForm = () => (
    <div className="card bg-base-100 shadow-lg border border-primary/20">
      <div className="card-body">
        <h3 className="card-title text-lg">📤 Ajouter un fichier PDF</h3>
        
        <form onSubmit={handleUploadPdf} className="space-y-4">
          {/* Sélection de fichier */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Fichier PDF <span className="text-error">*</span></span>
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className={`file-input file-input-bordered w-full ${uploadErrors.file ? 'file-input-error' : ''}`}
              disabled={uploading}
            />
            {uploadErrors.file && (
              <label className="label">
                <span className="label-text-alt text-error">{uploadErrors.file}</span>
              </label>
            )}
            {selectedFile && (
              <label className="label">
                <span className="label-text-alt text-success">
                  ✅ {selectedFile.name} ({pdfService.formatFileSize(selectedFile.size)})
                </span>
              </label>
            )}
          </div>

          {/* Nom d'affichage */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Nom d'affichage <span className="text-error">*</span></span>
            </label>
            <input
              type="text"
              value={uploadForm.displayName}
              onChange={(e) => setUploadForm(prev => ({ ...prev, displayName: e.target.value }))}
              placeholder="Ex: Cahier des charges"
              className={`input input-bordered w-full ${uploadErrors.displayName ? 'input-error' : ''}`}
              disabled={uploading}
            />
            {uploadErrors.displayName && (
              <label className="label">
                <span className="label-text-alt text-error">{uploadErrors.displayName}</span>
              </label>
            )}
          </div>

          {/* Description */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Description (optionnelle)</span>
            </label>
            <textarea
              value={uploadForm.description}
              onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description du document..."
              className="textarea textarea-bordered w-full"
              rows="2"
              disabled={uploading}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="btn btn-outline"
              onClick={resetUploadForm}
              disabled={uploading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${uploading ? 'loading' : ''}`}
              disabled={uploading}
            >
              {uploading ? 'Upload...' : 'Uploader'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Rendu de la liste des fichiers PDF
  const renderPdfList = () => {
    if (loading && pdfFiles.length === 0) {
      return (
        <div className="flex justify-center p-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      );
    }

    if (pdfFiles.length === 0) {
      return (
        <div className="text-center p-8 text-base-content/60">
          <div className="text-4xl mb-4">📄</div>
          <p>Aucun fichier PDF pour ce projet</p>
          {!readonly && (
            <button
              className="btn btn-outline btn-sm mt-4"
              onClick={() => setShowUploadForm(true)}
            >
              Ajouter le premier fichier PDF
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {pdfFiles.map((pdfFile) => (
          <div
            key={pdfFile.id}
            className="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow"
          >
            <div className="card-body p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-base flex items-center gap-2">
                    📄 {pdfFile.display_name}
                  </h4>
                  <div className="text-sm text-base-content/70 mt-1">
                    <span>Taille: {pdfFile.file_size_formatted}</span>
                    <span className="mx-2">•</span>
                    <span>Uploadé le {new Date(pdfFile.uploaded_at).toLocaleDateString('fr-FR')}</span>
                    {pdfFile.uploaded_by_username && (
                      <>
                        <span className="mx-2">•</span>
                        <span>par {pdfFile.uploaded_by_username}</span>
                      </>
                    )}
                  </div>
                  {pdfFile.description && (
                    <p className="text-sm text-base-content/80 mt-2">{pdfFile.description}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => handleDownloadPdf(pdfFile)}
                    title="Télécharger le PDF"
                  >
                    ⬇️
                  </button>
                  {!readonly && (
                    <button
                      className="btn btn-sm btn-outline btn-error"
                      onClick={() => handleDeletePdf(pdfFile)}
                      title="Supprimer le PDF"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          📄 Documents PDF
        </h2>
        {!readonly && !showUploadForm && pdfFiles.length > 0 && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowUploadForm(true)}
          >
            ➕ Ajouter un PDF
          </button>
        )}
      </div>

      {/* Formulaire d'upload */}
      {!readonly && showUploadForm && renderUploadForm()}

      {/* Liste des fichiers PDF */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          {renderPdfList()}
        </div>
      </div>
    </div>
  );
}

PdfManager.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  readonly: PropTypes.bool
};

export default PdfManager; 