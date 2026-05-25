import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function HistoryDrawer({ isOpen, onClose, tableName, recordId, showToast }) {
  const [historyList, setHistoryList] = useState([]);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && tableName && recordId) {
      const fetchHistory = async () => {
        setLoading(true);
        setSelectedAudit(null);
        try {
          const data = await api.records.getHistory(tableName, recordId);
          // Sort so newest versions are on top
          const sorted = [...data].sort((a, b) => b.version_number - a.version_number);
          setHistoryList(sorted);
          if (sorted.length > 0) {
            setSelectedAudit(sorted[0]); // Default to show latest change
          }
        } catch (err) {
          console.error(err);
          showToast('Failed to load version history.', 'error');
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen, tableName, recordId, showToast]);

  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    return new Date(isoStr).toLocaleString();
  };

  // Helper to parse dynamic JSON string if needed
  const parseJson = (val) => {
    if (!val) return {};
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch (e) {
      return {};
    }
  };

  const getAuditSummary = (audit) => {
    const action = audit.action;
    if (action === 'CREATE' || action === 'INSERT') {
      return 'Created new record';
    }
    if (action === 'DELETE') {
      return 'Soft-deleted record';
    }
    if (action === 'RESTORE') {
      return 'Restored record';
    }
    if (action === 'HARD_DELETE') {
      return 'Permanently purged record';
    }
    if (action === 'UPDATE') {
      const diff = parseJson(audit.diff);
      const keys = Object.keys(diff || {}).filter(k => 
        !['id', 'created_at', 'updated_at', 'deleted_at', 'version', 'created_by', 'updated_by', 'is_deleted', 'deleted_by'].includes(k)
      );
      if (keys.length > 0) {
        return `Changed: ${keys.join(', ')}`;
      }
      return 'Updated record metadata';
    }
    return 'Modified record';
  };

  const renderDiff = () => {
    if (!selectedAudit) return <p style={{ color: 'var(--text-muted)' }}>Select a version to inspect changes</p>;

    const action = selectedAudit.action;
    const version = selectedAudit.version_number;
    const snapshot = parseJson(selectedAudit.snapshot);
    const diff = parseJson(selectedAudit.diff) || null;

    let diffItems = []; // Array of { field, from, to, isChanged }

    if (action === 'CREATE' || action === 'INSERT') {
      // For creation, everything in snapshot is a new value (except system columns)
      Object.entries(snapshot).forEach(([key, val]) => {
        if (['id', 'created_at', 'updated_at', 'deleted_at', 'version', 'created_by', 'updated_by', 'is_deleted'].includes(key)) {
          return;
        }
        diffItems.push({
          field: key,
          from: '—',
          to: val !== null && val !== undefined ? String(val) : '—',
          isChanged: true
        });
      });
    } else if (action === 'UPDATE') {
      if (diff && Object.keys(diff).length > 0) {
        Object.entries(diff).forEach(([key, val]) => {
          if (['id', 'created_at', 'updated_at', 'deleted_at', 'version', 'created_by', 'updated_by', 'is_deleted'].includes(key)) {
            return;
          }
          diffItems.push({
            field: key,
            from: val.from !== null && val.from !== undefined ? String(val.from) : '—',
            to: val.to !== null && val.to !== undefined ? String(val.to) : '—',
            isChanged: true
          });
        });
      } else {
        // Fallback if no changes recorded in diff
        diffItems = [];
      }
    } else if (action === 'DELETE') {
      diffItems.push({
        field: 'is_deleted',
        from: 'False',
        to: 'True',
        isChanged: true
      });
    } else if (action === 'RESTORE') {
      diffItems.push({
        field: 'is_deleted',
        from: 'True',
        to: 'False',
        isChanged: true
      });
    }

    if (diffItems.length === 0) {
      return <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No dynamic properties changed.</p>;
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Delta Comparison (v{version})
          </h4>
          <span className={`cell-badge ${
            action === 'CREATE' || action === 'INSERT' ? 'cell-badge-success' :
            action === 'DELETE' ? 'cell-badge-danger' : 'cell-badge-primary'
          }`}>
            {action}
          </span>
        </div>

        <div className="diff-container">
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.5rem', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            <div>Field</div>
            <div>Old Value</div>
            <div>New Value</div>
          </div>

          {diffItems.map(item => (
            <div 
              key={item.field} 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: '1.2fr 1fr 1fr', 
                gap: '0.5rem', 
                padding: '0.35rem 0',
                borderBottom: '1px solid rgba(255,255,255,0.02)',
                background: item.isChanged ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                borderRadius: '4px'
              }}
            >
              <div style={{ fontWeight: '600', color: item.isChanged ? 'var(--accent-blue-hover)' : 'var(--text-secondary)' }}>
                {item.field}
              </div>
              <div>
                {item.isChanged && item.from !== '—' ? (
                  <span className="diff-val-removed">{item.from}</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>{item.from}</span>
                )}
              </div>
              <div>
                {item.isChanged ? (
                  <span className="diff-val-added">{item.to}</span>
                ) : (
                  <span>{item.to}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <p>✍️ <strong>Performed By:</strong> {selectedAudit.user_name || selectedAudit.user_email || 'System'}</p>
          <p style={{ marginTop: '0.25rem' }}>⏰ <strong>Timestamp:</strong> {formatDate(selectedAudit.changed_at)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className={`drawer ${isOpen ? 'open' : ''}`}>
      <div className="drawer-header">
        <h3 style={{ fontWeight: '700', fontSize: '1.2rem' }}>🕒 Version Time-Machine</h3>
        <button 
          onClick={onClose} 
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      <div className="drawer-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            🌀 Loading audit trail...
          </div>
        ) : historyList.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📂</span>
            <p className="empty-title">No Audit Records Found</p>
            <p style={{ fontSize: '0.85rem' }}>Modifications to this record will compile a dynamic version timeline.</p>
          </div>
        ) : (
          <div>
            <div className="timeline">
              {historyList.map(audit => (
                <div 
                  key={audit.version_id || audit.id}
                  className={`timeline-item ${selectedAudit?.version_id === audit.version_id || selectedAudit?.id === audit.id ? 'active' : ''}`}
                  onClick={() => setSelectedAudit(audit)}
                >
                  <div className="timeline-meta">
                    Version #{audit.version_number} &bull; {audit.action}
                  </div>
                  <div className="timeline-title" style={{ fontSize: '0.9rem' }}>
                    Modified by {audit.user_name || 'Obi-Wan'} ({audit.user_email || 'obiwan@yoda-tech.com'})
                  </div>
                  <div className="timeline-changes" style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--accent-blue-hover)', fontWeight: 'bold' }}>
                    📝 {getAuditSummary(audit)}
                  </div>
                  <div className="timeline-desc" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {formatDate(audit.changed_at || audit.created_at)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
              {renderDiff()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
