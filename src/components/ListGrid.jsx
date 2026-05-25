import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function ListGrid({
  table,
  user,
  onEditRecord,
  onOpenHistory,
  onSchemaModified,
  showToast,
  refreshTrigger
}) {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('active'); // 'active' (Active Catalog) | 'recycle' (Recycle Bin)

  // Scoped project permissions passed down inside user object
  const isAdmin = user && (user.role_name === 'Administrator' || Number(user.role_id) === 1);
  const isViewer = user && (user.role_name === 'Viewer' || Number(user.role_id) === 3);

  // Schema settings modal state
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDisplayName, setNewColDisplayName] = useState('');
  const [newColDataType, setNewColDataType] = useState('text');
  const [newColIsNullable, setNewColIsNullable] = useState(true);
  const [newColLookupTable, setNewColLookupTable] = useState('users');
  const [newColLookupColumn, setNewColLookupColumn] = useState('full_name');
  const [addingCol, setAddingCol] = useState(false);
  const [droppingColName, setDroppingColName] = useState('');

  const handleAddColumnSubmit = async (e) => {
    e.preventDefault();
    if (!newColName || !newColDisplayName) return;

    setAddingCol(true);
    try {
      const colDef = {
        column_name: newColName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        display_name: newColDisplayName,
        data_type: newColDataType,
        is_nullable: newColIsNullable
      };

      if (newColDataType === 'lookup') {
        colDef.is_lookup = true;
        colDef.lookup_table = newColLookupTable;
        colDef.lookup_column = newColLookupColumn;
      }

      await api.registry.addColumn(table.id, colDef);
      showToast(`Column "${newColDisplayName}" successfully appended!`, 'success');
      
      // Clear form inputs
      setNewColName('');
      setNewColDisplayName('');
      setNewColDataType('text');
      setNewColIsNullable(true);
      
      // Trigger schema refresh
      if (onSchemaModified) {
        await onSchemaModified();
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to append column.', 'error');
    } finally {
      setAddingCol(false);
    }
  };

  const handleDropColumn = async (columnName, colDisplayName) => {
    if (!window.confirm(`🚨 DANGER: Are you sure you want to drop column "${colDisplayName}" (${columnName})?\n\nThis will physically ALTER the table, dropping the SQL column from Postgres and permanently purging any data stored inside it!`)) {
      return;
    }

    setDroppingColName(columnName);
    try {
      await api.registry.deleteColumn(table.id, columnName);
      showToast(`Column "${colDisplayName}" was dropped successfully.`, 'success');
      
      // Trigger schema refresh
      if (onSchemaModified) {
        await onSchemaModified();
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to drop column.', 'error');
    } finally {
      setDroppingColName('');
    }
  };
  const columns = table.columns || [];

  // Define All 15 dynamic table REST endpoints code snippets
  const getListSnippet = () => {
    return `// 1. GET ALL RECORDS (Pagination, Sorting, Filtering)
fetch('http://localhost:3000/v1/${table.name}?page=1&limit=10&sort=created_at&order=desc', {
  headers: {
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  }
})
.then(res => res.json())
.then(data => console.log(data));`;
  };

  const getGetOneSnippet = () => {
    return `// 2. RETRIEVE ONE RECORD
fetch('http://localhost:3000/v1/${table.name}/' + recordId, {
  headers: {
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  }
})
.then(res => res.json())
.then(data => console.log(data));`;
  };

  const getCreateSnippet = () => {
    const fieldsStr = columns.length > 0
      ? columns.map(c => `    "${c.name || c.column_name}": ${c.data_type === 'boolean' ? 'false' : c.data_type === 'integer' || c.data_type === 'decimal' ? '123' : '"value"'}`).join(',\n')
      : '    "title": "..."';
    return `// 3. CREATE RECORD (Dynamic Zod Validation)
fetch('http://localhost:3000/v1/${table.name}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}',
    'Idempotency-Key': 'unique-key-123'
  },
  body: JSON.stringify({
${fieldsStr}
  })
})
.then(res => res.json());`;
  };

  const getUpdateSnippet = () => {
    const firstCol = columns[0] ? `    "${columns[0].name || columns[0].column_name}": ${columns[0].data_type === 'boolean' ? 'true' : columns[0].data_type === 'integer' ? '456' : '"updated"'}` : '    "title": "..."';
    return `// 4. PARTIAL UPDATE (Optimistic Locking Lock Check)
fetch('http://localhost:3000/v1/${table.name}/' + recordId, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  },
  body: JSON.stringify({
    "version": currentVersion, // Lock check
${firstCol}
  })
})
.then(res => res.json());`;
  };

  const getDeleteSnippet = () => {
    return `// 5. SOFT DELETE BY DEFAULT
fetch('http://localhost:3000/v1/${table.name}/' + recordId, {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  }
})
.then(res => res.json());`;
  };

  const getRestoreSnippet = () => {
    return `// 6. RESTORE SOFT-DELETED RECORD
fetch('http://localhost:3000/v1/${table.name}/' + recordId + '/restore', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  }
})
.then(res => res.json());`;
  };

  const getHardDeleteSnippet = () => {
    return `// 7. HARD DELETE (Admin Only)
fetch('http://localhost:3000/v1/${table.name}/' + recordId + '?hard=true', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  }
})
.then(res => res.json());`;
  };

  const getBulkCreateSnippet = () => {
    const rowStr = columns.length > 0
      ? `  { ${columns.slice(0, 2).map(c => `"${c.name || c.column_name}": ${c.data_type === 'boolean' ? 'false' : '"val"'}`).join(', ')} }`
      : '  { "title": "..." }';
    return `// 8. BULK CREATE / UPSERT
fetch('http://localhost:3000/v1/${table.name}/bulk', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  },
  body: JSON.stringify([
  ${rowStr},
  ${rowStr}
  ])
})
.then(res => res.json());`;
  };

  const getBulkUpdateSnippet = () => {
    const updateStr = columns.length > 0
      ? `  { "id": "RECORD_ID_1", "${columns[0].name || columns[0].column_name}": ${columns[0].data_type === 'boolean' ? 'true' : '"updated"'} }`
      : '  { "id": "RECORD_ID_1", "title": "..." }';
    return `// 9. BULK UPDATE (Transactional)
fetch('http://localhost:3000/v1/${table.name}/bulk', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  },
  body: JSON.stringify([
  ${updateStr}
  ])
})
.then(res => res.json());`;
  };

  const getBulkDeleteSnippet = () => {
    return `// 10. BULK SOFT DELETE
fetch('http://localhost:3000/v1/${table.name}/bulk', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  },
  body: JSON.stringify([
    "RECORD_ID_1",
    "RECORD_ID_2"
  ])
})
.then(res => res.json());`;
  };

  const getSearchSnippet = () => {
    return `// 11. ADVANCED FULL-TEXT SEARCH
fetch('http://localhost:3000/v1/${table.name}/search?q=query_text', {
  headers: {
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  }
})
.then(res => res.json());`;
  };

  const getCountSnippet = () => {
    return `// 12. COUNT RECORDS
fetch('http://localhost:3000/v1/${table.name}/count?filter[is_deleted]=false', {
  headers: {
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  }
})
.then(res => res.json());`;
  };

  const getExportSnippet = () => {
    return `// 13. EXPORT JSON / CSV DATA
fetch('http://localhost:3000/v1/${table.name}/export?format=csv&fields=id,created_at', {
  headers: {
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  }
})
.then(res => res.text())
.then(csv => console.log(csv));`;
  };

  const getHistorySnippet = () => {
    return `// 14. VERSION AUDIT TIMELINE LOGS
fetch('http://localhost:3000/v1/${table.name}/' + recordId + '/history', {
  headers: {
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  }
})
.then(res => res.json());`;
  };

  const getSnapshotSnippet = () => {
    return `// 15. TIME-MACHINE SNAPSHOT CHECKOUT
fetch('http://localhost:3000/v1/${table.name}/' + recordId + '/history/' + versionNumber, {
  headers: {
    'Authorization': 'Bearer ' + token,
    'X-Project-Id': '${table.project_id || 'PROJECT_ID'}'
  }
})
.then(res => res.json());`;
  };

  // Fetch data
  const fetchRecords = async () => {
    setLoading(true);
    try {
      // Find lookup fields to include
      const lookups = columns.filter(c => c.data_type === 'lookup').map(c => c.name || c.column_name);
      
      // Auto-include standard auditing system fields
      const includeParams = [...lookups, 'created_by', 'updated_by'];

      const params = {
        page: currentPage,
        limit: 10,
        sort: sortField,
        order: sortOrder,
        include: includeParams.join(','),
      };

      if (searchTerm) {
        params.q = searchTerm;
      }

      // Recycle Bin mode: fetch soft-deleted records only
      if (activeTab === 'recycle') {
        params.include_deleted = 'true';
        params['filter[is_deleted]'] = 'true';
      }

      const res = await api.records.list(table.name, params);
      setRecords(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to retrieve list records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when parameters, table, or tab changes
  useEffect(() => {
    fetchRecords();
  }, [table.name, currentPage, sortField, sortOrder, activeTab, refreshTrigger]);

  // Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchRecords();
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleSoftDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await api.records.delete(table.name, id, false);
      showToast('Record soft-deleted successfully!', 'success');
      fetchRecords();
    } catch (err) {
      showToast(err.message || 'Failed to delete record.', 'error');
    }
  };

  const handleRestore = async (id) => {
    try {
      await api.records.restore(table.name, id);
      showToast('Record restored to active catalog!', 'success');
      fetchRecords();
    } catch (err) {
      showToast(err.message || 'Failed to restore record.', 'error');
    }
  };

  const handleHardDelete = async (id) => {
    if (!window.confirm('🚨 DANGER: Are you sure you want to permanently purge this record?\n\nThis will physically delete the record from the database. This action is irreversible!')) {
      return;
    }
    try {
      await api.records.delete(table.name, id, true);
      showToast('Record permanently purged from database!', 'success');
      fetchRecords();
    } catch (err) {
      showToast(err.message || 'Failed to purge record.', 'error');
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleString();
  };

  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap', width: '100%' }}>
      <div className="card" style={{ flex: '1 1 650px', margin: 0, width: '100%', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="dash-title" style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{table.display_name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{table.description || 'Dynamic database catalog list'}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {isAdmin && (
              <button className="btn btn-secondary" onClick={() => setShowSchemaModal(true)}>
                ⚙️ Manage Columns
              </button>
            )}
            {!isViewer && activeTab === 'active' && (
              <button className="btn btn-primary" onClick={() => onEditRecord()}>
                ➕ Add Record
              </button>
            )}
          </div>
        </div>

        {/* Double Tab Selector */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', gap: '1.5rem' }}>
          <button 
            type="button"
            onClick={() => { setActiveTab('active'); setCurrentPage(1); }}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.75rem 0.5rem',
              color: activeTab === 'active' ? 'var(--accent-blue-hover)' : 'var(--text-muted)',
              borderBottom: activeTab === 'active' ? '2px solid var(--accent-blue-hover)' : '2px solid transparent',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.95rem',
              transition: 'var(--transition-smooth)'
            }}
          >
            📂 Active Catalog
          </button>
          {!isViewer && (
            <button 
              type="button"
              onClick={() => { setActiveTab('recycle'); setCurrentPage(1); }}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.75rem 0.5rem',
                color: activeTab === 'recycle' ? 'var(--accent-rose)' : 'var(--text-muted)',
                borderBottom: activeTab === 'recycle' ? '2px solid var(--accent-rose)' : '2px solid transparent',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.95rem',
                transition: 'var(--transition-smooth)'
              }}
            >
              🗑️ Recycle Bin
            </button>
          )}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="search-bar-container" style={{ marginBottom: '1.5rem' }}>
          <div className="search-input-wrapper">
            <input
              type="text"
              className="form-control search-input"
              placeholder={activeTab === 'recycle' ? "Search deleted items..." : "Search active catalog..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>

        {/* Grid Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            🌀 Loading dynamic list catalog...
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">{activeTab === 'recycle' ? '🗑️' : '📁'}</span>
            <p className="empty-title">
              {activeTab === 'recycle' ? 'Recycle Bin is Empty' : 'No Records Found'}
            </p>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {activeTab === 'recycle' 
                ? 'Soft-deleted records will appear here for restoration.' 
                : 'This list currently contains no data records.'}
            </p>
            {!isViewer && activeTab === 'active' && (
              <button className="btn btn-secondary btn-sm" onClick={() => onEditRecord()}>
                Create First Record
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    {columns.map(col => {
                      const colName = col.name || col.column_name;
                      return (
                        <th 
                          key={colName} 
                          onClick={() => handleSort(colName)}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          {col.display_name} {sortField === colName ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                        </th>
                      );
                    })}
                    <th onClick={() => handleSort('version')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Ver {sortField === 'version' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(rec => {
                    const isRecDeleted = !!rec.is_deleted;
                    return (
                      <tr key={rec.id} style={{ opacity: isRecDeleted ? 0.75 : 1 }}>
                        {columns.map(col => {
                          const colName = col.name || col.column_name;
                          const val = rec[colName];
                          let cellContent = '—';

                          if (col.data_type === 'boolean') {
                            cellContent = val ? (
                              <span className="cell-badge cell-badge-success">True</span>
                            ) : (
                              <span className="cell-badge cell-badge-muted">False</span>
                            );
                          } else if (col.data_type === 'timestamp') {
                            cellContent = formatDate(val);
                          } else if (col.data_type === 'lookup') {
                            const displayVal = rec[`${colName}_display`] || val;
                            cellContent = displayVal ? (
                              <span className="cell-badge cell-badge-primary" style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                                🔗 {String(displayVal)}
                              </span>
                            ) : '—';
                          } else {
                            cellContent = val !== null && val !== undefined ? String(val) : '—';
                          }

                          return (
                            <td key={colName} title={val !== null ? String(val) : ''}>
                              {isRecDeleted ? <del style={{ color: 'var(--text-muted)' }}>{cellContent}</del> : cellContent}
                            </td>
                          );
                        })}
                        <td>
                          <span className="cell-badge cell-badge-muted" style={{ fontStyle: 'monospace' }}>
                            v{rec.version}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            {activeTab === 'active' ? (
                              <>
                                {!isViewer && (
                                  <button 
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                    onClick={() => onEditRecord(rec)}
                                  >
                                    ✏️ Edit
                                  </button>
                                )}
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                  onClick={() => onOpenHistory(rec.id)}
                                >
                                  🕒 History
                                </button>
                                {!isViewer && (
                                  <button 
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: 'none' }}
                                    onClick={() => handleSoftDelete(rec.id)}
                                  >
                                    🗑️ Delete
                                  </button>
                                )}
                              </>
                            ) : (
                              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                {!isViewer && (
                                  <button 
                                    className="btn btn-success btn-sm"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                    onClick={() => handleRestore(rec.id)}
                                  >
                                    ♻️ Restore
                                  </button>
                                )}
                                {isAdmin && (
                                  <button 
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: 'none' }}
                                    onClick={() => handleHardDelete(rec.id)}
                                  >
                                    🚨 Purge
                                  </button>
                                )}
                                {isViewer && (
                                  <span className="cell-badge cell-badge-danger" style={{ fontSize: '0.7rem' }}>Soft-Deleted</span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="pagination">
              <div className="pagination-info">
                Showing page <strong>{pagination.page}</strong> of <strong>{pagination.total_pages || 1}</strong> &bull; Total records: <strong>{pagination.total}</strong>
              </div>
              <div className="pagination-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                >
                  ◀ Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage >= pagination.total_pages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.total_pages))}
                >
                  Next ▶
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Column: Developer API Quick Reference Panel */}
      <div className="card" style={{ 
        width: '370px', 
        margin: 0, 
        border: '1px solid rgba(99, 102, 241, 0.15)', 
        background: 'linear-gradient(180deg, rgba(20, 22, 33, 0.95) 0%, rgba(10, 11, 17, 0.98) 100%)', 
        position: 'sticky', 
        top: '1.5rem',
        animation: 'fadeIn 0.5s ease',
        maxHeight: 'calc(100vh - 4.5rem)',
        overflowY: 'auto',
        scrollbarWidth: 'thin'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>💻</span>
          <h3 className="dash-title" style={{ fontSize: '1.1rem', margin: 0, letterSpacing: '0.5px' }}>API QUICK REFERENCE</h3>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '1.25rem' }}>
          Standard RESTful workspace URLs physically isolated inside Postgres. Set the headers on all client queries:
        </p>

        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--accent-blue-hover)', fontWeight: 'bold' }}>Authorization</span>
            <span style={{ color: 'var(--text-secondary)' }}>Bearer &lt;token&gt;</span>
          </div>
          <div style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>X-Project-Id</span>
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.7rem', wordBreak: 'break-all' }}>{table.project_id || 'PROJECT_ID'}</span>
          </div>
        </div>

        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.25rem' }}>
          ALL 15 COMPLIANT ENDPOINTS
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          
          {/* Endpoint 1: List */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-success" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>GET</span>
              <span>List Dynamic Records</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getListSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 2: Get One */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-success" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>GET</span>
              <span>Retrieve One Record</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getGetOneSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 3: Create */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-primary" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', background: 'rgba(99,102,241,0.2)', color: 'var(--accent-blue-hover)' }}>POST</span>
              <span>Create Record</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getCreateSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 4: Update */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-warning" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d' }}>PATCH</span>
              <span>Partial Update (Optimistic)</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getUpdateSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 5: Delete */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-danger" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', background: 'rgba(244, 63, 94, 0.2)', color: 'var(--accent-rose)' }}>DEL</span>
              <span>Soft Delete Record</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getDeleteSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 6: Restore */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-primary" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', background: 'rgba(99,102,241,0.2)', color: 'var(--accent-blue-hover)' }}>POST</span>
              <span>Restore Soft-Deleted</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getRestoreSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 7: Hard Delete */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-danger" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', background: 'rgba(244, 63, 94, 0.2)', color: 'var(--accent-rose)' }}>DEL</span>
              <span>Hard Delete (Admin Only)</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getHardDeleteSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 8: Bulk Create */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-primary" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', background: 'rgba(99,102,241,0.2)', color: 'var(--accent-blue-hover)' }}>POST</span>
              <span>Bulk Create / Upsert</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getBulkCreateSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 9: Bulk Update */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-warning" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d' }}>PATCH</span>
              <span>Bulk Update</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getBulkUpdateSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 10: Bulk Delete */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-danger" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', background: 'rgba(244, 63, 94, 0.2)', color: 'var(--accent-rose)' }}>DEL</span>
              <span>Bulk Soft Delete</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getBulkDeleteSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 11: Search */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-success" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>GET</span>
              <span>Advanced Search</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getSearchSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 12: Count */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-success" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>GET</span>
              <span>Count Matching</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getCountSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 13: Export */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-success" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>GET</span>
              <span>Export CSV / JSON</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getExportSnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 14: History */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-success" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>GET</span>
              <span>Version History Timeline</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getHistorySnippet()}
              </pre>
            </div>
          </details>

          {/* Endpoint 15: Snapshot */}
          <details style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
            <summary style={{ padding: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="cell-badge cell-badge-success" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>GET</span>
              <span>Snapshot Time-Machine</span>
            </summary>
            <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <pre style={{ margin: 0, padding: '0.5rem', background: '#0a0b11', borderRadius: '4px', fontSize: '0.7rem', overflowX: 'auto', color: '#c7d2fe', fontFamily: 'monospace' }}>
                {getSnapshotSnippet()}
              </pre>
            </div>
          </details>

        </div>
      </div>

      {/* Schema / Columns settings Modal overlay */}
      {showSchemaModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', width: '100%' }}>
            <button className="modal-close" onClick={() => setShowSchemaModal(false)}>
              ✕
            </button>

            <h2 className="dash-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
              🛠️ Schema Settings: {table.display_name}
            </h2>

            {/* A. Current Columns List */}
            <h3 className="form-label" style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Current Columns Configuration
            </h3>

            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '2rem', background: 'rgba(0,0,0,0.1)' }}>
              <table className="data-table" style={{ margin: 0, fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '0.5rem' }}>Column Name</th>
                    <th style={{ padding: '0.5rem' }}>Data Type</th>
                    <th style={{ padding: '0.5rem' }}>Nullability</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map(col => {
                    const colName = col.name || col.column_name;
                    const isSystemField = ['id', 'created_at', 'updated_at', 'deleted_at', 'version', 'created_by', 'updated_by', 'is_deleted', 'deleted_by'].includes(colName);
                    return (
                      <tr key={colName} style={{ opacity: isSystemField ? 0.5 : 1 }}>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 'bold' }}>
                          {col.display_name} <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>({colName})</span>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textTransform: 'capitalize' }}>
                          {col.data_type === 'lookup' ? `Lookup 🔗 (${col.lookup_table})` : col.data_type}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          {col.is_nullable ? 'Optional' : 'Required'}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                          {isSystemField ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>System</span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', border: 'none' }}
                              onClick={() => handleDropColumn(colName, col.display_name)}
                              disabled={droppingColName === colName}
                            >
                              {droppingColName === colName ? 'Dropping...' : '🗑️ Drop'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* B. Append New Column Form */}
            <h3 className="form-label" style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
              ➕ Add New Column Field
            </h3>

            <form onSubmit={handleAddColumnSubmit}>
              <div className="form-row" style={{ marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Field Display Label</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Phone Number"
                    value={newColDisplayName}
                    onChange={(e) => {
                      setNewColDisplayName(e.target.value);
                      const slug = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
                      if (!newColName || newColName === newColName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_')) {
                        setNewColName(slug);
                      }
                    }}
                    disabled={addingCol}
                    required
                  />
                </div>
                
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Database Identifier (Slug)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. phone_number"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    disabled={addingCol}
                    required
                  />
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: '1rem', alignItems: 'center' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Data Type</label>
                  <select
                    className="form-control form-select form-control-sm"
                    value={newColDataType}
                    onChange={(e) => setNewColDataType(e.target.value)}
                    disabled={addingCol}
                  >
                    <option value="text">Text</option>
                    <option value="integer">Number (Int)</option>
                    <option value="decimal">Decimal</option>
                    <option value="boolean">Yes/No (Bool)</option>
                    <option value="timestamp">Date/Time</option>
                    <option value="lookup">Lookup Relation</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', height: '100%', paddingTop: '1.25rem' }}>
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    id="new-col-nullable"
                    checked={newColIsNullable}
                    onChange={(e) => setNewColIsNullable(e.target.checked)}
                    disabled={addingCol}
                  />
                  <label htmlFor="new-col-nullable" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                    Optional (Nullable)
                  </label>
                </div>
              </div>

              {newColDataType === 'lookup' && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                  animation: 'fadeIn 0.3s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>References Table:</span>
                    <select
                      className="form-control form-select form-control-sm"
                      value={newColLookupTable}
                      onChange={(e) => setNewColLookupTable(e.target.value)}
                      disabled={addingCol}
                    >
                      <option value="users">users (System Users)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Display Property:</span>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="full_name or email"
                      value={newColLookupColumn}
                      onChange={(e) => setNewColLookupColumn(e.target.value)}
                      disabled={addingCol}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSchemaModal(false)}
                  disabled={addingCol}
                >
                  Close Settings
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={addingCol}
                >
                  {addingCol ? 'Adding Column...' : '➕ Append Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
