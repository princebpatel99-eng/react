import React, { useState } from 'react';
import { api } from '../utils/api';

export default function ListBuilder({ tables = [], onTableCreated, onCancel, showToast }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState([
    { name: 'title', display_name: 'Title', data_type: 'text', is_nullable: false, lookup_target_table: '', lookup_display_column: '' }
  ]);

  const handleAddColumn = () => {
    setColumns([
      ...columns,
      {
        name: '',
        display_name: '',
        data_type: 'text',
        is_nullable: true,
        lookup_target_table: '',
        lookup_display_column: 'full_name'
      }
    ]);
  };

  const handleRemoveColumn = (index) => {
    if (columns.length === 1) {
      showToast('At least one column is required.', 'warning');
      return;
    }
    const updated = [...columns];
    updated.splice(index, 1);
    setColumns(updated);
  };

  const handleColumnChange = (index, field, value) => {
    const updated = [...columns];
    updated[index][field] = value;
    
    // Auto-fill field slugs if modifying display name and slug is empty or matched
    if (field === 'display_name') {
      const slug = value.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
      if (!updated[index].name || updated[index].name === updated[index].prevSlug) {
        updated[index].name = slug;
        updated[index].prevSlug = slug;
      }
    }
    
    // Default lookups target columns
    if (field === 'data_type' && value === 'lookup') {
      updated[index].lookup_target_table = 'users';
      updated[index].lookup_display_column = 'full_name';
    }
    
    setColumns(updated);
  };

  const handleListNameChange = (val) => {
    setDisplayName(val);
    const slug = val.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    if (!name || name === name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_')) {
      setName(slug);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !displayName) {
      showToast('List name and display name are required.', 'error');
      return;
    }

    // Basic column validations
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (!col.name || !col.display_name) {
        showToast(`Column #${i + 1} is missing a name or label.`, 'error');
        return;
      }
      if (!/^[a-z][a-z0-9_]*$/.test(col.name)) {
        showToast(`Column #${i + 1} slug "${col.name}" must start with a letter and contain lowercase alphanumeric/underscores only.`, 'error');
        return;
      }
      if (col.data_type === 'lookup' && !col.lookup_target_table) {
        showToast(`Column #${i + 1} (Lookup) must select a target table.`, 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const schema = {
        table_name: name,
        display_name: displayName,
        description,
        columns: columns.map(col => {
          const formatted = {
            name: col.name,
            display_name: col.display_name,
            data_type: col.data_type,
            is_nullable: col.is_nullable
          };
          if (col.data_type === 'lookup') {
            formatted.lookup_target_table = col.lookup_target_table;
            formatted.lookup_target_column = 'id';
            formatted.lookup_display_column = col.lookup_display_column || 'full_name';
          }
          return formatted;
        })
      };

      const result = await api.registry.createTable(schema);
      showToast(`Custom list "${displayName}" successfully compiled and registered!`, 'success');
      onTableCreated(result);
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to create list', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 className="dash-title" style={{ fontSize: '1.75rem' }}>🛠️ Create Custom List</h2>
        <button className="btn btn-secondary btn-sm" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">List Display Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Sales Leads"
              value={displayName}
              onChange={(e) => handleListNameChange(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Database Table Name (Slug)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. sales_leads"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '2rem' }}>
          <label className="form-label">Description</label>
          <textarea
            className="form-control"
            rows="2"
            placeholder="What is the purpose of this list..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>

        <h3 className="form-label" style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
          Columns & Fields Schema
        </h3>

        {columns.map((col, index) => (
          <div key={index} className="builder-row">
            <div className="form-group" style={{ margin: 0 }}>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Field Label (e.g. Contact Email)"
                value={col.display_name}
                onChange={(e) => handleColumnChange(index, 'display_name', e.target.value)}
                disabled={loading}
                required
              />
            </div>
            
            <div className="form-group" style={{ margin: 0 }}>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="slug_name"
                value={col.name}
                onChange={(e) => handleColumnChange(index, 'name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <select
                className="form-control form-select"
                value={col.data_type}
                onChange={(e) => handleColumnChange(index, 'data_type', e.target.value)}
                disabled={loading}
              >
                <option value="text">Text</option>
                <option value="integer">Number (Int)</option>
                <option value="decimal">Decimal</option>
                <option value="boolean">Yes/No (Bool)</option>
                <option value="timestamp">Date/Time</option>
                <option value="lookup">Lookup Relation</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
              <input
                type="checkbox"
                className="form-checkbox"
                id={`nullable-${index}`}
                checked={col.is_nullable}
                onChange={(e) => handleColumnChange(index, 'is_nullable', e.target.checked)}
                disabled={loading}
              />
              <label htmlFor={`nullable-${index}`} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Optional
              </label>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.5rem', color: 'var(--accent-rose)', border: 'none', background: 'none' }}
              onClick={() => handleRemoveColumn(index)}
              disabled={loading}
            >
              ❌
            </button>

            {col.data_type === 'lookup' && (
              <div style={{
                gridColumn: '1 / span 4',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginTop: '-0.25rem',
                marginBottom: '0.5rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue-hover)', fontWeight: 'bold' }}>Relation:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>References Table:</span>
                  <select
                    className="form-control form-select"
                    style={{ padding: '0.35rem 2rem 0.35rem 0.75rem', width: 'auto', fontSize: '0.85rem' }}
                    value={col.lookup_target_table}
                    onChange={(e) => handleColumnChange(index, 'lookup_target_table', e.target.value)}
                    disabled={loading}
                  >
                    <option value="users">users (System Users)</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.display_name})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Display Property:</span>
                  <input
                    type="text"
                    className="form-control"
                    style={{ padding: '0.35rem 0.75rem', width: '120px', fontSize: '0.85rem' }}
                    placeholder="full_name or title"
                    value={col.lookup_display_column}
                    onChange={(e) => handleColumnChange(index, 'lookup_display_column', e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', borderStyle: 'dashed', marginTop: '0.5rem', marginBottom: '2rem' }}
          onClick={handleAddColumn}
          disabled={loading}
        >
          ➕ Add Column Field
        </button>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-success" disabled={loading}>
            {loading ? 'Compiling Schema...' : '🚀 Compile & Register List'}
          </button>
        </div>
      </form>
    </div>
  );
}
