import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function RecordForm({ table, record = null, onSave, onCancel, showToast }) {
  const [formData, setFormData] = useState({});
  const [lookupOptions, setLookupOptions] = useState({});
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEdit = !!record;
  const columns = table.columns || [];

  // 1. Initialize Form Data
  useEffect(() => {
    const initialData = {};
    columns.forEach(col => {
      const colName = col.name || col.column_name;
      // Exclude read-only columns automatically managed by the engine
      if (['id', 'created_at', 'updated_at', 'deleted_at', 'version', 'created_by', 'updated_by'].includes(colName)) {
        return;
      }
      
      if (isEdit) {
        // If it's a lookup, let's keep the raw ID value
        if (col.data_type === 'lookup' && record[colName] && typeof record[colName] === 'object') {
          initialData[colName] = record[colName].id;
        } else {
          initialData[colName] = record[colName] !== null && record[colName] !== undefined ? record[colName] : '';
        }
      } else {
        // Default initial values
        if (col.data_type === 'boolean') {
          initialData[colName] = false;
        } else {
          initialData[colName] = '';
        }
      }
    });
    setFormData(initialData);
  }, [table, record, isEdit, columns]);

  // 2. Eagerly Load Lookup Table Options
  useEffect(() => {
    const fetchLookups = async () => {
      const lookupCols = columns.filter(col => col.data_type === 'lookup');
      if (lookupCols.length === 0) return;

      setLoadingLookups(true);
      const optionsMap = {};

      try {
        await Promise.all(
          lookupCols.map(async (col) => {
            const colName = col.name || col.column_name;
            const targetTable = col.lookup_table || col.lookup_target_table;
            try {
              // Fetch first 100 records for the dropdown select
              const res = await api.records.list(targetTable, { limit: 100 });
              optionsMap[colName] = res.data || [];
            } catch (err) {
              console.error(`Failed to load lookups for ${targetTable}`, err);
              // Fallback to empty if it fails
              optionsMap[colName] = [];
            }
          })
        );
        setLookupOptions(optionsMap);
      } catch (e) {
        showToast('Error loading lookup relations.', 'error');
      } finally {
        setLoadingLookups(false);
      }
    };

    fetchLookups();
  }, [table, columns, showToast]);

  const handleChange = (fieldName, value, type) => {
    let parsedVal = value;
    if (type === 'boolean') {
      parsedVal = value === true;
    } else if (type === 'integer') {
      parsedVal = value === '' ? '' : parseInt(value, 10);
    } else if (type === 'decimal') {
      parsedVal = value === '' ? '' : parseFloat(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [fieldName]: parsedVal
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Filter form payload (replace empty fields with null if nullable)
      const payload = {};
      columns.forEach(col => {
        const colName = col.name || col.column_name;
        if (['id', 'created_at', 'updated_at', 'deleted_at', 'version', 'created_by', 'updated_by'].includes(colName)) {
          return;
        }
        const val = formData[colName];
        
        if (val === '' || val === undefined) {
          payload[colName] = col.is_nullable ? null : '';
        } else {
          payload[colName] = val;
        }
      });

      let savedRecord;
      if (isEdit) {
        // Send request with If-Match version header for optimistic concurrency check
        savedRecord = await api.records.update(table.name, record.id, payload, record.version);
        showToast('Record successfully updated!', 'success');
      } else {
        savedRecord = await api.records.create(table.name, payload);
        showToast('New record successfully added!', 'success');
      }

      onSave(savedRecord);
    } catch (err) {
      console.error(err);
      if (err.status === 409) {
        showToast('❌ Version Mismatch: This record was modified by another user. Please refresh and try again.', 'error');
      } else if (err.details && Array.isArray(err.details)) {
        const errorSummary = err.details.map(d => `${d.field}: ${d.issue}`).join(', ');
        showToast(`❌ Validation Failed - ${errorSummary}`, 'error');
      } else {
        showToast(err.message || 'Failed to save record', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onCancel} disabled={saving}>
          ✕
        </button>

        <h2 className="dash-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
          {isEdit ? `✏️ Edit Record` : `➕ New Record`} in {table.display_name}
        </h2>

        {loadingLookups ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            🌀 Loading relations...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {columns.map(col => {
              const colName = col.name || col.column_name;
              // Skip automatically generated auditing properties
              if (['id', 'created_at', 'updated_at', 'deleted_at', 'version', 'created_by', 'updated_by'].includes(colName)) {
                return null;
              }

              const value = formData[colName] ?? '';

              return (
                <div key={colName} className="form-group">
                  <label className="form-label" htmlFor={colName}>
                    {col.display_name} {!col.is_nullable && <span style={{ color: 'var(--accent-rose)' }}>*</span>}
                  </label>

                  {col.data_type === 'boolean' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.25rem 0' }}>
                      <input
                        type="checkbox"
                        id={colName}
                        className="form-checkbox"
                        checked={!!value}
                        onChange={(e) => handleChange(colName, e.target.checked, 'boolean')}
                        disabled={saving}
                      />
                      <label htmlFor={colName} style={{ fontSize: '0.95rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        {value ? 'True / Active' : 'False / Inactive'}
                      </label>
                    </div>
                  ) : col.data_type === 'lookup' ? (
                    <select
                      id={colName}
                      className="form-control form-select"
                      value={value}
                      onChange={(e) => handleChange(colName, e.target.value, 'text')}
                      disabled={saving}
                      required={!col.is_nullable}
                    >
                      <option value="">-- Select {col.display_name} --</option>
                      {(lookupOptions[colName] || []).map(opt => {
                        const targetCol = col.lookup_column || col.lookup_display_column || 'display_name';
                        return (
                          <option key={opt.id} value={opt.id}>
                            {opt[targetCol] || opt.title || opt.email || opt.id}
                          </option>
                        );
                      })}
                    </select>
                  ) : col.data_type === 'timestamp' ? (
                    <input
                      type="datetime-local"
                      id={colName}
                      className="form-control"
                      value={value ? value.substring(0, 16) : ''}
                      onChange={(e) => handleChange(colName, e.target.value, 'text')}
                      disabled={saving}
                      required={!col.is_nullable}
                    />
                  ) : (
                    <input
                      type={col.data_type === 'integer' || col.data_type === 'decimal' ? 'number' : 'text'}
                      step={col.data_type === 'decimal' ? '0.01' : '1'}
                      id={colName}
                      className="form-control"
                      placeholder={`Enter ${col.display_name.toLowerCase()}`}
                      value={value}
                      onChange={(e) => handleChange(colName, e.target.value, col.data_type)}
                      disabled={saving}
                      required={!col.is_nullable}
                    />
                  )}
                </div>
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onCancel}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
