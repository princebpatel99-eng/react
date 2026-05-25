import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function WorkspaceLogs({ project, showToast }) {
  const [logs, setLogs] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [whitelist, setWhitelist] = useState(project.whitelisted_domains || '');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState(null);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await api.projects.getLogs(project.id);
      setLogs(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load access logs.', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchBlocks = async () => {
    setLoadingBlocks(true);
    try {
      const data = await api.projects.getBlocks(project.id);
      setBlocks(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load active rate blocks.', 'error');
    } finally {
      setLoadingBlocks(false);
    }
  };

  useEffect(() => {
    if (project?.id) {
      fetchLogs();
      fetchBlocks();
    }
  }, [project.id]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.projects.updateSettings(project.id, whitelist);
      showToast('Workspace domain whitelist updated successfully!', 'success');
      project.whitelisted_domains = whitelist; // Mutate local reference
    } catch (err) {
      showToast(err.message || 'Failed to update whitelist settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUnblock = async (userId, userEmail) => {
    setUnblockingUserId(userId);
    try {
      await api.projects.unblockUser(project.id, userId);
      showToast(`User ${userEmail} unblocked successfully!`, 'success');
      fetchBlocks();
      fetchLogs();
    } catch (err) {
      showToast(err.message || 'Failed to unblock user.', 'error');
    } finally {
      setUnblockingUserId(null);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleString();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', animation: 'fadeIn 0.5s ease' }}>
      
      {/* Whitelist Domain Control Card */}
      <div className="card" style={{ margin: 0 }}>
        <h3 className="dash-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🛡️ Origin Whitelist settings
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
          Restricts API queries for this project. When configured, incoming requests from browsers must match one of the allowed host domains (e.g. <code>localhost:5173</code>, <code>yoda-app.com</code>). Separate multiple domains using commas. Leave empty to allow any origin.
        </p>

        <form onSubmit={handleSaveSettings} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '1 1 400px', margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Allowed Domains Whitelist</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. localhost:5173, my-corp-portal.com"
              value={whitelist}
              onChange={(e) => setWhitelist(e.target.value)}
              disabled={savingSettings}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingSettings} style={{ height: '42px', minWidth: '150px' }}>
            {savingSettings ? 'Saving...' : '💾 Save Settings'}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', width: '100%', alignItems: 'flex-start' }}>
        
        {/* Left Card: Access Audit Logs */}
        <div className="card" style={{ flex: '1 1 600px', margin: 0, overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 className="dash-title" style={{ fontSize: '1.2rem', margin: 0 }}>
              📊 Real-Time API Access Auditor
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loadingLogs}>
              🔄 Refresh Logs
            </button>
          </div>

          {loadingLogs ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              🌀 Querying audit trail...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No API request logs recorded in this project workspace yet.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Method</th>
                    <th>Endpoint</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const isBlocked = !!log.is_blocked_activity;
                    return (
                      <tr key={log.id} style={{ background: isBlocked ? 'rgba(244, 63, 94, 0.04)' : 'transparent' }}>
                        <td>{formatDate(log.created_at)}</td>
                        <td title={log.user_email}>
                          <span style={{ fontWeight: 'bold' }}>{log.user_name || 'System'}</span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.user_email || '—'}</div>
                        </td>
                        <td>
                          <span className={`cell-badge ${
                            log.method === 'GET' ? 'cell-badge-success' :
                            log.method === 'POST' ? 'cell-badge-primary' : 'cell-badge-warning'
                          }`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem' }}>
                            {log.method}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                          {log.endpoint}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`cell-badge ${
                            log.status_code < 300 ? 'cell-badge-success' :
                            log.status_code === 429 ? 'cell-badge-danger' : 'cell-badge-muted'
                          }`} style={{ fontSize: '0.7rem' }}>
                            {log.status_code}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{log.ip_address || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Card: Rate limit blocks */}
        <div className="card" style={{ flex: '1 1 350px', margin: 0, border: '1px solid rgba(244, 63, 94, 0.15)', background: 'linear-gradient(180deg, rgba(25, 12, 16, 0.95) 0%, rgba(10, 5, 8, 0.98) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(244, 63, 94, 0.1)', paddingBottom: '0.75rem' }}>
            <h3 className="dash-title" style={{ fontSize: '1.1rem', margin: 0, color: 'var(--accent-rose)' }}>
              🚨 Rate Limit Intruder Alerts
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={fetchBlocks} disabled={loadingBlocks} style={{ borderColor: 'rgba(244,63,94,0.3)', color: 'var(--accent-rose)' }}>
              🔄 Refresh
            </button>
          </div>

          {loadingBlocks ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              🌀 Checking blocks...
            </div>
          ) : blocks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              💚 Awesome! No users are currently rate-blocked in this workspace.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {blocks.map(block => (
                <div 
                  key={block.user_id}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(244, 63, 94, 0.2)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    animation: 'fadeIn 0.3s ease'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{block.user_name}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{block.user_email}</div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', background: 'rgba(244,63,94,0.05)', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid var(--accent-rose)' }}>
                    🚨 <strong>Reason:</strong> {block.reason || 'Exceeded dynamic rate threshold'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Blocked Until: <br />
                      <strong style={{ color: 'var(--text-secondary)' }}>{formatDate(block.blocked_until)}</strong>
                    </span>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ background: 'var(--accent-rose)', border: 'none', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => handleUnblock(block.user_id, block.user_email)}
                      disabled={unblockingUserId === block.user_id}
                    >
                      {unblockingUserId === block.user_id ? '⚡ Unblocking...' : '⚡ Unblock'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
