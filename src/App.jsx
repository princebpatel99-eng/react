import React, { useState, useEffect } from 'react';
import { 
  api, 
  getUserProfile, 
  getRoleName, 
  removeAuthToken, 
  removeUserProfile,
  getActiveProject,
  setActiveProject,
  removeActiveProject
} from './utils/api';
import Login from './components/Login';
import Register from './components/Register';
import Sidebar from './components/Sidebar';
import ListGrid from './components/ListGrid';
import ListBuilder from './components/ListBuilder';
import RecordForm from './components/RecordForm';
import HistoryDrawer from './components/HistoryDrawer';
import ProjectMembers from './components/ProjectMembers';
import WorkspaceLogs from './components/WorkspaceLogs';
import DocumentVault from './components/DocumentVault';
import SQLEditor from './components/SQLEditor';
import WebhookSettings from './components/WebhookSettings';
import EmailSettings from './components/EmailSettings';

export default function App() {
  const [user, setUser] = useState(getUserProfile());
  const [activeProject, setActiveProjectState] = useState(getActiveProject());
  const [projectRole, setProjectRole] = useState(localStorage.getItem('yoda_active_project_role') || 'Viewer');
  const [view, setView] = useState(getUserProfile() ? (getActiveProject() ? 'dashboard' : 'projects') : 'login');
  
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
  
  // Modals & drawers state
  const [projects, setProjects] = useState([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjDisplayName, setNewProjDisplayName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  const [editingRecord, setEditingRecord] = useState(null); // When set, shows RecordForm
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState(null); // When set, opens HistoryDrawer
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Floating Toasts
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 4.5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Fetch projects user belongs to
  const fetchProjectsList = async () => {
    if (!user) return;
    try {
      const list = await api.projects.list();
      setProjects(list);
    } catch (err) {
      console.error(err);
      showToast('Could not fetch projects list.', 'error');
    }
  };

  // Fetch registered dynamic lists inside the active project
  const fetchTables = async () => {
    if (!user || !activeProject) return;
    try {
      const list = await api.registry.listTables();
      setTables(list);
    } catch (err) {
      console.error(err);
      showToast('Could not fetch dynamic lists for this workspace.', 'error');
    }
  };

  // 1. Initial page load hook
  useEffect(() => {
    if (user) {
      if (activeProject) {
        fetchTables();
      } else {
        fetchProjectsList();
      }
    }
  }, [user, activeProject]);

  const handleLoginSuccess = (userProfile) => {
    setUser(userProfile);
    const activeProj = getActiveProject();
    if (activeProj) {
      setActiveProjectState(activeProj);
      setProjectRole(localStorage.getItem('yoda_active_project_role') || 'Viewer');
      setView('dashboard');
    } else {
      setView('projects');
      fetchProjectsList();
    }
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
      showToast('You have signed out.', 'success');
    } catch (e) {
      showToast('Logout failed', 'error');
    } finally {
      setUser(null);
      setActiveProjectState(null);
      setProjectRole('Viewer');
      removeActiveProject();
      localStorage.removeItem('yoda_active_project_role');
      setView('login');
      setTables([]);
      setActiveTable(null);
    }
  };

  const handleSelectProject = (project) => {
    setActiveProject(project);
    localStorage.setItem('yoda_active_project_role', project.member_role);
    setActiveProjectState(project);
    setProjectRole(project.member_role);
    showToast(`Switched workspace to: ${project.display_name}`, 'success');
    setView('dashboard');
  };

  const handleSelectTable = async (table) => {
    try {
      const fullTable = await api.registry.getTableSchema(table.id);
      setActiveTable(fullTable);
      setView('table');
    } catch (err) {
      showToast(err.message || 'Could not load table schema.', 'error');
    }
  };

  const handleSwitchProjectClick = () => {
    removeActiveProject();
    localStorage.removeItem('yoda_active_project_role');
    setActiveProjectState(null);
    setProjectRole('Viewer');
    setActiveTable(null);
    setTables([]);
    setView('projects');
    fetchProjectsList();
  };

  const handleCreateProjectSubmit = async (e) => {
    e.preventDefault();
    if (!newProjName || !newProjDisplayName) return;

    setCreatingProject(true);
    try {
      const proj = await api.projects.create({
        name: newProjName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        display_name: newProjDisplayName,
        description: newProjDesc
      });
      showToast(`Project workspace compiled successfully!`, 'success');
      
      // Clear form
      setNewProjName('');
      setNewProjDisplayName('');
      setNewProjDesc('');
      setShowProjectModal(false);

      // Auto join as Admin
      const enrichedProj = {
        ...proj,
        member_role: 'Administrator'
      };
      
      handleSelectProject(enrichedProj);
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to compile project workspace.', 'error');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleDeleteTable = async (e, tableId, tableName) => {
    e.stopPropagation();
    if (!window.confirm(`🚨 DANGER: Are you sure you want to drop list "${tableName}"?\n\nThis will DROP the physical SQL table from the PostgreSQL database, purging all columns and data forever!`)) {
      return;
    }

    try {
      await api.registry.deleteTable(tableId);
      showToast(`Custom table catalog "${tableName}" was dropped.`, 'success');
      
      // Update sidebar
      const updated = tables.filter(t => t.id !== tableId);
      setTables(updated);
      
      if (activeTable?.id === tableId) {
        setActiveTable(null);
        setView('dashboard');
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete table.', 'error');
    }
  };

  const handleDeleteProject = async (e, projectId, projectDisplayName) => {
    e.stopPropagation();
    if (!window.confirm(`🚨 DANGER: Are you sure you want to delete project workspace "${projectDisplayName}"?\n\nThis will completely wipe out the project, DROP all its custom tables in PostgreSQL, and permanently purge all secure documents, logs, and user memberships associated with it! This action is irreversible!`)) {
      return;
    }

    try {
      await api.projects.delete(projectId);
      showToast(`Project workspace "${projectDisplayName}" deleted successfully.`, 'success');
      
      // Update list
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      // If deleted project is active project, clear it
      if (activeProject?.id === projectId) {
        removeActiveProject();
        localStorage.removeItem('yoda_active_project_role');
        setActiveProjectState(null);
        setProjectRole('Viewer');
        setActiveTable(null);
        setTables([]);
        setView('projects');
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete workspace.', 'error');
    }
  };

  // Render auth flows
  if (!user) {
    if (view === 'register') {
      return (
        <>
          <Register
            onRegisterSuccess={() => setView('login')}
            onNavigateToLogin={() => setView('login')}
            showToast={showToast}
          />
          <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
        </>
      );
    }
    return (
      <>
        <Login
          onLoginSuccess={handleLoginSuccess}
          onNavigateToRegister={() => setView('register')}
          showToast={showToast}
        />
        <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      </>
    );
  }

  // Render project switcher landing dashboard
  if (!activeProject || view === 'projects') {
    return (
      <div className="auth-wrapper" style={{ flexDirection: 'column', padding: '2rem' }}>
        <div style={{ maxWidth: '900px', width: '100%', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="auth-title" style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚡ SELECT WORKSPACE
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Logged in as {user.full_name} ({user.email}). Choose a project tenant database below.
            </p>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            🚪 Sign Out
          </button>
        </div>

        <div style={{ maxWidth: '900px', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {projects.map(proj => (
            <div 
              key={proj.id} 
              className="card"
              onClick={() => handleSelectProject(proj)}
              style={{ cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}
            >
              <div>
                <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📁 {proj.display_name}
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', minHeight: '36px' }}>
                  {proj.description || 'No description provided.'}
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span className="cell-badge cell-badge-primary">
                  {proj.member_role}
                </span>
                
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {proj.member_role === 'Administrator' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ 
                        color: 'var(--accent-rose)', 
                        border: 'none', 
                        background: 'rgba(244, 63, 94, 0.05)', 
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem' 
                      }}
                      onClick={(e) => handleDeleteProject(e, proj.id, proj.display_name)}
                    >
                      🗑️ Delete
                    </button>
                  )}
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue-hover)', fontWeight: 'bold' }}>
                    Open Workspace →
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Create Project Trigger */}
          <div 
            className="card"
            onClick={() => setShowProjectModal(true)}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center', 
              padding: '2.5rem',
              border: '2px dashed var(--accent-blue-hover)',
              background: 'rgba(99, 102, 241, 0.02)',
              color: 'var(--accent-blue-hover)'
            }}
          >
            <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>➕</span>
            <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Create Collaborative Project</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Spin up a new Postgres isolated database</span>
          </div>
        </div>

        {/* Project Creation Modal overlay */}
        {showProjectModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px' }}>
              <button className="modal-close" onClick={() => setShowProjectModal(false)} disabled={creatingProject}>
                ✕
              </button>

              <h2 className="dash-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
                🛠️ Create Postgres Project Workspace
              </h2>

              <form onSubmit={handleCreateProjectSubmit}>
                <div className="form-group">
                  <label className="form-label">Project Workspace Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Sales Trackings"
                    value={newProjDisplayName}
                    onChange={(e) => {
                      setNewProjDisplayName(e.target.value);
                      const slug = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
                      if (!newProjName || newProjName === newProjName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_')) {
                        setNewProjName(slug);
                      }
                    }}
                    disabled={creatingProject}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Workspace Identifier (Database slug)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. sales_trackings"
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    disabled={creatingProject}
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    *Lowercase letters and underscores only. Defines physical table prefixes.
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="What is the purpose of this project..."
                    value={newProjDesc}
                    onChange={(e) => setNewProjDesc(e.target.value)}
                    disabled={creatingProject}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowProjectModal(false)}
                    disabled={creatingProject}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={creatingProject}
                  >
                    {creatingProject ? 'Initializing Workspace...' : '🚀 Spin Up Workspace'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 1. Sidebar Nav */}
      <Sidebar
        user={user}
        tables={tables}
        activeTable={activeTable}
        activeView={view}
        activeProject={activeProject}
        projectRole={projectRole}
        onSelectTable={handleSelectTable}
        onSelectDashboard={() => {
          setActiveTable(null);
          setView('dashboard');
        }}
        onCreateTableClick={() => {
          setActiveTable(null);
          setView('builder');
        }}
        onSelectSettings={() => {
          setActiveTable(null);
          setView('settings');
        }}
        onSelectLogs={() => {
          setActiveTable(null);
          setView('logs');
        }}
        onSelectVault={() => {
          setActiveTable(null);
          setView('vault');
        }}
        onSelectSqlEditor={() => {
          setActiveTable(null);
          setView('sql');
        }}
        onSelectWebhooks={() => {
          setActiveTable(null);
          setView('webhooks');
        }}
        onSelectEmail={() => {
          setActiveTable(null);
          setView('email');
        }}
        onSwitchProject={handleSwitchProjectClick}
        onLogout={handleLogout}
      />

      {/* 2. Main Content Panels */}
      <div className="main-content">
        {view === 'dashboard' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="dash-header">
              <h2 className="dash-title">{activeProject.display_name} Dashboard</h2>
            </div>
            
            <div className="card" style={{ marginBottom: '2.5rem', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(20, 22, 33, 0.6) 100%)' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Welcome to the project workspace!</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                You are currently signed in as <strong>{user.full_name}</strong> in the workspace database <strong style={{ color: 'var(--accent-purple)' }}>{activeProject.display_name}</strong>.
                Your security scope level within this project is <strong style={{ color: 'var(--accent-blue-hover)' }}>{projectRole}</strong>. 
                Use the left console sidebar to inspect the active custom catalogs or compile new database collections.
              </p>
            </div>

            <h3 className="form-label" style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
              Active Project Tables ({tables.length})
            </h3>

            {tables.length === 0 ? (
              <div className="empty-state card">
                <span className="empty-icon">📊</span>
                <p className="empty-title">No Tables Configured</p>
                <p style={{ fontSize: '0.85rem' }}>
                  {projectRole === 'Administrator' 
                    ? 'Click "Create Custom List" in the sidebar to define your dynamic table schema.'
                    : 'Contact your project administrator to set up database dynamic tables.'
                  }
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {tables.map(table => (
                  <div 
                    key={table.id} 
                    className="card" 
                    onClick={() => handleSelectTable(table)}
                    style={{ cursor: 'pointer', position: 'relative' }}
                  >
                    <h4 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      📋 {table.display_name}
                    </h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem', minHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {table.description || 'No description provided.'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue-hover)', fontWeight: 'bold' }}>
                        {table.columns?.length || 0} fields defined
                      </span>
                      {projectRole === 'Administrator' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--accent-rose)', border: 'none', background: 'rgba(244, 63, 94, 0.05)', padding: '0.35rem 0.65rem' }}
                          onClick={(e) => handleDeleteTable(e, table.id, table.display_name)}
                        >
                          🗑️ Drop List
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'builder' && (
          <ListBuilder
            tables={tables}
            onTableCreated={async (newTable) => {
              await fetchTables();
              setActiveTable(newTable);
              setView('table');
            }}
            onCancel={() => setView('dashboard')}
            showToast={showToast}
          />
        )}

        {view === 'settings' && (
          <ProjectMembers
            projectId={activeProject.id}
            currentUserId={user.id}
            showToast={showToast}
          />
        )}

        {view === 'logs' && (
          <WorkspaceLogs
            project={activeProject}
            showToast={showToast}
          />
        )}

        {view === 'vault' && (
          <DocumentVault
            project={activeProject}
            user={{ 
              ...user, 
              role_name: projectRole, 
              role_id: projectRole === 'Administrator' ? 1 : projectRole === 'Editor' ? 2 : 3 
            }}
            showToast={showToast}
          />
        )}

        {view === 'sql' && (
          <SQLEditor
            project={activeProject}
            showToast={showToast}
          />
        )}

        {view === 'webhooks' && (
          <WebhookSettings
            project={activeProject}
            tables={tables}
            showToast={showToast}
          />
        )}

        {view === 'email' && (
          <EmailSettings
            project={activeProject}
            showToast={showToast}
          />
        )}

        {view === 'table' && activeTable && (
          <ListGrid
            key={activeTable.id}
            table={activeTable}
            user={{ 
              ...user, 
              role_name: projectRole, 
              role_id: projectRole === 'Administrator' ? 1 : projectRole === 'Editor' ? 2 : 3 
            }} 
            refreshTrigger={refreshTrigger}
            onEditRecord={(record = null) => {
              setEditingRecord(record);
              setShowRecordForm(true);
            }}
            onOpenHistory={(recordId) => {
              setActiveHistoryId(recordId);
            }}
            onSchemaModified={async () => {
              try {
                const fullTable = await api.registry.getTableSchema(activeTable.id);
                setActiveTable(fullTable);
              } catch (e) {
                showToast('Failed to refresh table schema.', 'error');
              }
            }}
            showToast={showToast}
          />
        )}
      </div>

      {/* 3. Record Insert/Update Modal overlay */}
      {showRecordForm && activeTable && (
        <RecordForm
          table={activeTable}
          record={editingRecord}
          onSave={() => {
            setShowRecordForm(false);
            setEditingRecord(null);
            setRefreshTrigger(prev => prev + 1); // reload grid
          }}
          onCancel={() => {
            setShowRecordForm(false);
            setEditingRecord(null);
          }}
          showToast={showToast}
        />
      )}

      {/* 4. Side History Drawer */}
      <HistoryDrawer
        isOpen={!!activeHistoryId}
        onClose={() => setActiveHistoryId(null)}
        tableName={activeTable?.name}
        recordId={activeHistoryId}
        showToast={showToast}
      />

      {/* 5. Floating Toast Notification stack */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
}

// Internal Toast component helper
function ToastContainer({ toasts, onRemoveToast }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span style={{ fontSize: '1.1rem' }}>
            {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : t.type === 'warning' ? '🔑' : 'ℹ️'}
          </span>
          <div style={{ flex: 1, fontSize: '0.9rem', lineHeight: '1.4' }}>
            {t.message}
          </div>
          <button 
            onClick={() => onRemoveToast(t.id)} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', paddingLeft: '0.5rem' }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
