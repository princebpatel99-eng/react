import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function DocumentVault({ project, user, showToast }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [deletingDocId, setDeletingDocId] = useState(null);

  // Scoped project permissions passed down inside user object
  const isViewer = user && (user.role_name === 'Viewer' || Number(user.role_id) === 3);
  const isAdmin = user && (user.role_name === 'Administrator' || Number(user.role_id) === 1);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const data = await api.projects.listDocuments(project.id);
      setDocuments(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to retrieve secure documents catalog.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (project?.id) {
      fetchDocuments();
    }
  }, [project.id]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    // Check size limit: 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (selectedFile.size > MAX_SIZE) {
      showToast('Confidential files are limited to 10MB in secure database store.', 'error');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const base64Content = event.target.result.split(',')[1];
          const payload = {
            filename: selectedFile.name,
            mime_type: selectedFile.type || 'application/octet-stream',
            file_data: base64Content
          };

          await api.projects.uploadDocument(project.id, payload);
          showToast(`Document "${selectedFile.name}" uploaded securely!`, 'success');
          setSelectedFile(null);
          
          // Clear file input
          const fileInput = document.getElementById('secure-file-input');
          if (fileInput) fileInput.value = '';

          fetchDocuments();
        } catch (err) {
          console.error(err);
          showToast(err.message || 'Failed to complete document upload.', 'error');
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        showToast('Failed to read file from filesystem.', 'error');
        setUploading(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (err) {
      console.error(err);
      showToast('Unexpected file reader failure.', 'error');
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    setDownloadingDocId(doc.id);
    try {
      const blob = await api.projects.downloadDocument(project.id, doc.id);
      
      // Create local temporary Object URL
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      window.URL.revokeObjectURL(url);
      showToast('Document downloaded securely!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Unauthorized access. Download blocked or expired.', 'error');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleDeleteDocument = async (docId, filename) => {
    if (!window.confirm(`Are you sure you want to delete secure document "${filename}"? This action is irreversible!`)) {
      return;
    }
    setDeletingDocId(docId);
    try {
      await api.projects.deleteDocument(project.id, docId);
      showToast('Document deleted from secure vault.', 'success');
      fetchDocuments();
    } catch (err) {
      showToast(err.message || 'Failed to delete document.', 'error');
    } finally {
      setDeletingDocId(null);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleString();
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', width: '100%', alignItems: 'flex-start', animation: 'fadeIn 0.5s ease' }}>
      
      {/* Left Card: Document Inventory List */}
      <div className="card" style={{ flex: '1 1 600px', margin: 0, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div>
            <h2 className="dash-title" style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🔒 Secure Document Vault</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Confidential project assets backed securely in PostgreSQL database binary blocks.</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchDocuments} disabled={loading}>
            🔄 Refresh Vault
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            🌀 Querying secure vault directory...
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state" style={{ padding: '4rem 2rem' }}>
            <span className="empty-icon">🛡️</span>
            <p className="empty-title">Vault is Empty</p>
            <p style={{ fontSize: '0.85rem' }}>Confidential files and records uploaded here are strictly secure.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>File Size</th>
                  <th>Mime Type</th>
                  <th>Uploaded By</th>
                  <th>Date Uploaded</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                      📄 {doc.filename}
                    </td>
                    <td>{formatSize(doc.file_size)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{doc.mime_type}</td>
                    <td title={doc.uploader_email}>
                      <strong>{doc.uploader_name}</strong>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{doc.uploader_email}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{formatDate(doc.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingDocId === doc.id}
                        >
                          {downloadingDocId === doc.id ? '🌀 Downloading...' : '⬇️ Download'}
                        </button>
                        {isAdmin && (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', border: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                            disabled={deletingDocId === doc.id}
                          >
                            {deletingDocId === doc.id ? 'Deleting...' : '🗑️ Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right Card: Upload Form */}
      {!isViewer && (
        <div className="card" style={{ width: '350px', margin: 0, border: '1px solid rgba(99, 102, 241, 0.15)', background: 'linear-gradient(180deg, rgba(20, 22, 33, 0.95) 0%, rgba(10, 11, 17, 0.98) 100%)' }}>
          <h3 className="dash-title" style={{ fontSize: '1.2rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            ➕ Secure File Upload
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
            Files uploaded to this secure directory are stored in encrypted byte chunks. Access requires authentication and active workspace membership.
          </p>

          <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Select Local Document</label>
              <input
                type="file"
                className="form-control"
                id="secure-file-input"
                onChange={handleFileChange}
                disabled={uploading}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                required
              />
              {selectedFile && (
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue-hover)', marginTop: '0.5rem', fontWeight: '500' }}>
                  📊 File size: {formatSize(selectedFile.size)}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', height: '42px' }}
              disabled={!selectedFile || uploading}
            >
              {uploading ? '🌀 Uploading file...' : '⬆️ Upload to Secure Vault'}
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
