import React, { useState } from 'react';
import { api } from '../utils/api';

export default function EmailSettings({ project, showToast }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [lastDispatch, setLastDispatch] = useState(null);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!to.trim() || !subject.trim() || !body.trim()) return;

    setSending(true);
    setLastDispatch(null);

    try {
      const res = await api.admin.sendEmail(project.id, {
        to: to.trim(),
        subject: subject.trim(),
        text: body.trim()
      });
      setLastDispatch(res);
      showToast('Email successfully sent and audited!', 'success');
      
      // Clear inputs
      setTo('');
      setSubject('');
      setBody('');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to dispatch email.', 'error');
    } finally {
      setSending(false);
    }
  };

  const getCurlSnippet = () => {
    return `curl -X POST "http://localhost:3000/v1/projects/${project.id}/admin/email" \\
  -H "Authorization: Bearer <your_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "recipient@example.com",
    "subject": "System Warning Triggered",
    "text": "Hello, this is a system alert from Yoda Engine..."
  }'`;
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="dash-header">
        <div>
          <h2 className="dash-title">📧 Transactional Email API</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Dispatch secure transactional emails from this workspace. Audit records and sent email bodies are preserved in the workspace file vault log.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Email Dispatcher form card */}
        <div className="card" style={{ flex: '1 1 450px', margin: 0 }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Test Email Dispatcher Panel
          </h3>

          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Recipient Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="recipient@yoda-tech.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={sending}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Subject Line</label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Message Plaintext Body</label>
              <textarea
                className="form-control"
                rows="5"
                placeholder="Type your message body details here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={sending}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', height: '42px', marginTop: '0.5rem' }}
              disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
            >
              {sending ? 'Sending Transactional Email...' : '📧 Send Email'}
            </button>
          </form>
        </div>

        {/* API documentation & status */}
        <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quick API Docs */}
          <div className="card" style={{ margin: 0, border: '1px solid rgba(99, 102, 241, 0.15)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              📚 Quick REST API Integration
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '1rem' }}>
              Administrators can invoke transactional email dispatches using the workspace REST endpoint:
            </p>
            <pre style={{
              margin: 0,
              padding: '0.75rem',
              background: '#090a11',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '0.7rem',
              overflowX: 'auto',
              color: '#c7d2fe',
              fontFamily: 'monospace',
              lineHeight: '1.5'
            }}>
              {getCurlSnippet()}
            </pre>
          </div>

          {/* Auditable persistence status returns */}
          {lastDispatch && (
            <div className="card" style={{ margin: 0, border: '1px solid rgba(16, 185, 129, 0.25)', background: 'rgba(16, 185, 129, 0.02)', animation: 'fadeIn 0.3s ease' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--accent-blue-hover)', marginBottom: '0.75rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                ✅ Sent Email Audit Persistent Log
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem' }}>
                <div>
                  <strong>Message ID:</strong> <span style={{ fontFamily: 'monospace' }}>{lastDispatch.messageId}</span>
                </div>
                <div>
                  <strong>Timestamp:</strong> <span>{new Date(lastDispatch.timestamp).toLocaleString()}</span>
                </div>
                <div>
                  <strong>Local Persistent Audit File:</strong> 
                  <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', wordBreak: 'break-all', marginTop: '0.25rem', padding: '0.4rem', background: '#090a11', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    {lastDispatch.auditPath}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
