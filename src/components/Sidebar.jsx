import React from 'react';
import { getRoleName } from '../utils/api';

export default function Sidebar({
  user,
  tables = [],
  activeTable = null,
  activeView = 'dashboard',
  activeProject = null,
  projectRole = 'Viewer',
  onSelectTable,
  onSelectDashboard,
  onCreateTableClick,
  onSelectSettings,
  onSelectLogs,
  onSelectVault,
  onSwitchProject,
  onLogout,
  onSelectSqlEditor,
  onSelectWebhooks,
  onSelectEmail
}) {
  const isProjectAdmin = projectRole === 'Administrator';

  return (
    <div className="sidebar">
      <div className="sidebar-logo" style={{ flexDirection: 'column', alignItems: 'flex-start', paddingBottom: '1rem', borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>⚡</span> YODA CONSOLE
        </div>
        {activeProject && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            📁 {activeProject.display_name}
          </div>
        )}
      </div>

      <div className="sidebar-user">
        <span className="sidebar-user-name">{user?.display_name || user?.full_name || 'Obi-Wan Kenobi'}</span>
        <span className="sidebar-user-role" style={{ color: 'var(--accent-purple)' }}>{projectRole} Scoped</span>
      </div>

      <div className="sidebar-nav">
        <button
          className={`sidebar-link ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={onSelectDashboard}
        >
          📊 Dashboard
        </button>

        <button
          className={`sidebar-link ${activeView === 'vault' ? 'active' : ''}`}
          onClick={onSelectVault}
        >
          🔒 Document Vault
        </button>

        <div className="sidebar-heading">Dynamic Lists</div>
        
        {tables.length === 0 ? (
          <div style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No lists registered
          </div>
        ) : (
          tables.map((table) => {
            const isActive = activeView === 'table' && activeTable?.id === table.id;
            return (
              <button
                key={table.id}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTable(table)}
                title={table.description || table.display_name}
              >
                📋 {table.display_name}
              </button>
            );
          })
        )}

        {isProjectAdmin && (
          <>
            <div className="sidebar-heading">Project Administration</div>
            <button
              className={`sidebar-link ${activeView === 'builder' ? 'active' : ''}`}
              onClick={onCreateTableClick}
              style={{
                border: '1px dashed var(--accent-blue-hover)',
                color: 'var(--accent-blue-hover)',
                background: 'rgba(99, 102, 241, 0.03)',
                marginBottom: '0.5rem'
              }}
            >
              ➕ Create Custom List
            </button>
            <button
              className={`sidebar-link ${activeView === 'settings' ? 'active' : ''}`}
              onClick={onSelectSettings}
            >
              ⚙️ Project Members
            </button>
            <button
              className={`sidebar-link ${activeView === 'logs' ? 'active' : ''}`}
              onClick={onSelectLogs}
            >
              📊 Workspace Logs
            </button>
            <button
              className={`sidebar-link ${activeView === 'sql' ? 'active' : ''}`}
              onClick={onSelectSqlEditor}
            >
              💻 SQL Editor
            </button>
            <button
              className={`sidebar-link ${activeView === 'webhooks' ? 'active' : ''}`}
              onClick={onSelectWebhooks}
            >
              🪝 Webhooks
            </button>
            <button
              className={`sidebar-link ${activeView === 'email' ? 'active' : ''}`}
              onClick={onSelectEmail}
            >
              📧 Email Dispatcher
            </button>
          </>
        )}
      </div>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button
          onClick={onSwitchProject}
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.02)' }}
        >
          🔄 Switch Workspace
        </button>
        <button
          onClick={onLogout}
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}
