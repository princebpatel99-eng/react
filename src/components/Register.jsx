import React, { useState } from 'react';
import { api } from '../utils/api';

export default function Register({ onRegisterSuccess, onNavigateToLogin, showToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      setError('Please fill in all the fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.auth.register(email, password, fullName);
      showToast('Registration successful! Please sign in.', 'success');
      onRegisterSuccess();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Registration failed. Check the details and try again.');
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">⚡</span>
          <h1 className="auth-title">CREATE ACCOUNT</h1>
          <p className="auth-subtitle">Register to manage your dynamic lists</p>
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
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Obi-Wan Kenobi"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="e.g. obiwan@jedi.org"
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
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <button onClick={onNavigateToLogin} className="btn-link" disabled={loading}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
