import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function WebhookSettings({ project, tables = [], showToast }) {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Form states
  const [targetTable, setTargetTable] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [triggers, setTriggers] = useState({
    INSERT: true,
    UPDATE: true,
    DELETE: true
  });

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const list = await api.admin.listWebhooks(project.id);
      setWebhooks(list || []);
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to list webhook triggers.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, [project.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!targetTable || !webhookUrl.trim()) return;

    // Compile active trigger points
    const activeTriggers = Object.entries(triggers)
      .filter(([_, active]) => active)
      .map(([name]) => name)
      .join(',');

    if (!activeTriggers) {
      showToast('⚠️ Must select at least one trigger event.', 'error');
      return;
    }

    setSaving(true);
    try {
      const newWebhook = await api.admin.createWebhook(project.id, {
        table_name: targetTable,
        url: webhookUrl.trim(),
        trigger_events: activeTriggers
      });
      setWebhooks(prev => [newWebhook, ...prev]);
      showToast('Webhook trigger successfully registered!', 'success');
      
      // Clear form inputs
      setWebhookUrl('');
      setTargetTable('');
      setTriggers({ INSERT: true, UPDATE: true, DELETE: true });
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to register webhook.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (webhookId) => {
    if (!window.confirm('Are you sure you want to delete this Webhook trigger?')) {
      return;
    }

    setDeletingId(webhookId);
    try {
      await api.admin.deleteWebhook(project.id, webhookId);
      setWebhooks(prev => prev.filter(w => w.id !== webhookId));
      showToast('Webhook trigger unregistered.', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to unregister webhook.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="dash-header">
        <div>
          <h2 className="dash-title">🪝 Workspace Webhook Triggers</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Configure HTTP POST endpoint targets to receive background event payloads whenever records are modified.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Creation Card form */}
        <div className="card" style={{ width: '400px', margin: 0 }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Add Webhook Endpoint
          </h3>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Target Dynamic Table</label>
              <select
                className="form-control form-select"
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value)}
                disabled={saving}
                required
              >
                <option value="">-- Select Table --</option>
                {tables.map(t => (
                  <option key={t.id} value={t.table_name}>
                    {t.display_name} ({t.table_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Payload URL</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://your-server.com/webhooks"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                disabled={saving}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>Trigger Events</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={triggers.INSERT}
                    onChange={(e) => setTriggers(prev => ({ ...prev, INSERT: e.target.checked }))}
                    disabled={saving}
                  />
                  INSERT (Record added)
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={triggers.UPDATE}
                    onChange={(e) => setTriggers(prev => ({ ...prev, UPDATE: e.target.checked }))}
                    disabled={saving}
                  />
                  UPDATE (Record modified)
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={triggers.DELETE}
                    onChange={(e) => setTriggers(prev => ({ ...prev, DELETE: e.target.checked }))}
                    disabled={saving}
                  />
                  DELETE (Record deleted / soft-deleted)
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', height: '42px', marginTop: '0.5rem' }}
              disabled={saving || !targetTable || !webhookUrl.trim()}
            >
              {saving ? 'Creating Webhook...' : '➕ Register Webhook Trigger'}
            </button>
          </form>
        </div>

        {/* Directory Listing card */}
        <div className="card" style={{ flex: '1 1 500px', margin: 0, overflowX: 'auto' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Webhook Integrations List
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
              🌀 Loading webhook configurations...
            </div>
          ) : webhooks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🪝</span>
              <p style={{ fontWeight: 'bold', margin: 0 }}>No Webhooks Configured</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Define webhook endpoints in the form to configure background relays.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th>Table Target</th>
                    <th>Webhook Target URL</th>
                    <th>Triggers</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map(webhook => (
                    <tr key={webhook.id}>
                      <td style={{ fontWeight: 'bold', color: 'var(--accent-purple)' }}>
                        📋 {webhook.table_name}
                      </td>
                      <td style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {webhook.url}
                      </td>
                      <td>
                        {webhook.trigger_events.split(',').map(ev => (
                          <span
                            key={ev}
                            className={`cell-badge ${
                              ev === 'INSERT' ? 'cell-badge-success' : ev === 'UPDATE' ? 'cell-badge-primary' : 'cell-badge-danger'
                            }`}
                            style={{ marginRight: '0.25rem', fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}
                          >
                            {ev}
                          </span>
                        ))}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: 'none' }}
                          onClick={() => handleDelete(webhook.id)}
                          disabled={deletingId === webhook.id}
                        >
                          {deletingId === webhook.id ? 'Deleting...' : '🗑️ Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
