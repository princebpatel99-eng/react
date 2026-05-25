import React, { useState } from 'react';
import { api } from '../utils/api';

export default function SQLEditor({ project, showToast }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState(null);

  const handleExecute = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setExecuting(true);
    setError(null);
    setResults([]);

    try {
      const res = await api.admin.executeSQL(project.id, query);
      setResults(res || []);
      showToast('Query executed successfully.', 'success');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to execute query.');
      showToast(err.message || 'SQL execution failed.', 'error');
    } finally {
      setExecuting(false);
    }
  };

  const getHeaders = () => {
    if (results.length === 0) return [];
    return Object.keys(results[0]);
  };

  const handleQuickSnippet = (tableName) => {
    setQuery(`SELECT * FROM "p_${project.id.replace(/-/g, '').toLowerCase()}_${tableName.toLowerCase()}" LIMIT 20;`);
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="dash-header">
        <div>
          <h2 className="dash-title">💻 SQL Query Editor</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Execute custom SQL query commands against this project's database scope. Direct access to system core tables is strictly prohibited.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Editor Console card */}
        <div className="card" style={{ flex: '1 1 500px', margin: 0 }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            SQL Workspace Console
          </h3>

          <form onSubmit={handleExecute} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <textarea
                className="form-control"
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  height: '180px',
                  background: '#090a11',
                  color: '#c7d2fe',
                  border: '1px solid var(--border-color)',
                  padding: '1rem',
                  lineHeight: '1.5'
                }}
                placeholder="-- Type your custom PostgreSQL query here...&#10;SELECT * FROM your_project_table LIMIT 10;"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={executing}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Guarded Admin query space
              </span>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ height: '38px', minWidth: '140px' }}
                disabled={executing || !query.trim()}
              >
                {executing ? 'Executing...' : '⚡ Run Query'}
              </button>
            </div>
          </form>
        </div>

        {/* Quick helpers sidebar */}
        <div className="card" style={{ width: '320px', margin: 0, border: '1px solid rgba(99, 102, 241, 0.15)', background: 'rgba(20,22,33,0.5)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            📋 Quick Query Targets
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '1rem' }}>
            Click any project custom table to quickly compile a standard SELECT query template:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={() => setQuery(`SELECT id, name, display_name, description FROM projects WHERE id = '${project.id}';`)}
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
            >
              📁 Query Active Project Meta
            </button>
            
            <button
              onClick={() => setQuery(`SELECT * FROM metadata_tables WHERE project_id = '${project.id}';`)}
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
            >
              📋 Query Registered Table Meta
            </button>
            
            <div style={{ margin: '0.5rem 0', borderBottom: '1px dashed var(--border-color)' }}></div>
            
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your Dynamic Tables:
            </span>

            <button
              onClick={() => handleQuickSnippet('contracts')}
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.75rem', padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}
            >
              📊 contracts
            </button>
            <button
              onClick={() => handleQuickSnippet('saleslead')}
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.75rem', padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}
            >
              📊 saleslead
            </button>
            <button
              onClick={() => handleQuickSnippet('marketingmanager')}
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.75rem', padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}
            >
              📊 marketingmanager
            </button>
          </div>
        </div>
      </div>

      {/* SQL Query Results Table Panel */}
      <div className="card" style={{ margin: 0, overflowX: 'auto', minHeight: '150px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Query Results Output
        </h3>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid var(--accent-rose)',
            color: 'var(--accent-rose)',
            padding: '1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap'
          }}>
            ⚠️ Query execution failed: {error}
          </div>
        )}

        {!error && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
            {executing ? '🌀 Querying dynamic records...' : '📊 No records fetched. Run query to inspect results.'}
          </div>
        )}

        {!error && results.length > 0 && (
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue-hover)', fontWeight: 'bold', marginBottom: '0.75rem' }}>
              Returned {results.length} rows successfully
            </div>
            
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                    {getHeaders().map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.75rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, idx) => (
                    <tr key={idx}>
                      {getHeaders().map(h => {
                        const val = row[h];
                        let stringVal = '—';
                        if (val !== null && val !== undefined) {
                          if (typeof val === 'object') {
                            stringVal = JSON.stringify(val);
                          } else {
                            stringVal = String(val);
                          }
                        }
                        return (
                          <td key={h} style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace' }} title={stringVal}>
                            {stringVal}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
