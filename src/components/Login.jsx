import React, { useState } from 'react';
import { api } from '../utils/api';

export default function Login({ onLoginSuccess, onNavigateToRegister, showToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await api.auth.login(email, password);
      showToast(`Welcome back, ${user.full_name || 'User'}!`, 'success');
      onLoginSuccess(user);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Login failed. Please verify your credentials.');
      showToast(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = () => {
    setEmail('admin@yoda-tech.com');
    setPassword('YodaTech@123');
    showToast('Credentials filled. Click Sign In!', 'warning');
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">⚡</span>
          <h1 className="auth-title">YODA ENGINE</h1>
          <p className="auth-subtitle">Dynamic SharePoint-like Admin Portal</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '12px',
            padding: '0.85rem 1.2rem',
            color: '#fda4af',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            lineHeight: '1.4'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="e.g. luke@skywalker.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <button onClick={onNavigateToRegister} className="btn-link" disabled={loading}>
            Create one
          </button>
        </div>

        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px dashed var(--border-color)',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Testing credentials:
          </p>
          <button 
            onClick={handleQuickLogin}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', background: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.2)' }}
            disabled={loading}
          >
            🔑 Pre-fill Administrator Login
          </button>
        </div>
      </div>
    </div>
  );
}
