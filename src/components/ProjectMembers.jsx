import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function ProjectMembers({ projectId, currentUserId, showToast }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(3); // Default to Viewer (3)
  const [inviting, setInviting] = useState(false);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const list = await api.projects.listUsers(projectId);
      setMembers(list);
    } catch (err) {
      console.error(err);
      showToast('Failed to load project members.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchMembers();
    }
  }, [projectId]);

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    try {
      await api.projects.addUser(projectId, {
        email: inviteEmail,
        role_id: Number(inviteRole)
      });
      showToast(`User successfully added to project!`, 'success');
      setInviteEmail('');
      fetchMembers();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to add user to project.', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId, userEmail) => {
    if (userId === currentUserId) {
      showToast('Cannot remove yourself from the project workspace.', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ${userEmail} from this project?`)) {
      return;
    }

    try {
      await api.projects.removeUser(projectId, userId);
      showToast('User removed from project workspace.', 'success');
      fetchMembers();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to remove user.', 'error');
    }
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
      <h2 className="dash-title" style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>
        ⚙️ Project Members & Settings
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2.5rem' }}>
        Manage member authorization tiers and invite new users to collaborate inside this project registry database.
      </p>

      {/* Invite Member Section */}
      <form onSubmit={handleInviteSubmit} className="card" style={{ background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed', padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--accent-blue-hover)' }}>
          ➕ Invite Collaborative Member
        </h3>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <input
              type="email"
              className="form-control"
              placeholder="Collaborator's email (e.g. luke@skywalker.com)"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviting}
              required
            />
          </div>
          <div style={{ width: '150px' }}>
            <select
              className="form-control form-select"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              disabled={inviting}
            >
              <option value={3}>Viewer</option>
              <option value={2}>Editor</option>
              <option value={1}>Admin</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={inviting}>
            {inviting ? 'Inviting...' : 'Invite Member'}
          </button>
        </div>
      </form>

      {/* Members Grid List */}
      <h3 className="form-label" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        Active Project Members ({members.length})
      </h3>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          🌀 Loading project members...
        </div>
      ) : (
        <div className="table-container" style={{ marginTop: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Email Address</th>
                <th>Security Role</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id}>
                  <td>
                    <strong>{member.display_name}</strong> {member.id === currentUserId && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(You)</span>}
                  </td>
                  <td>{member.email}</td>
                  <td>
                    <span className={`cell-badge ${
                      member.role_id === 1 ? 'cell-badge-success' :
                      member.role_id === 2 ? 'cell-badge-primary' : 'cell-badge-muted'
                    }`}>
                      {member.role_name}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {member.id !== currentUserId ? (
                      <button
                        onClick={() => handleRemove(member.id, member.email)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--accent-rose)', border: 'none', background: 'rgba(244, 63, 94, 0.03)', padding: '0.35rem 0.65rem' }}
                      >
                        Remove
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingRight: '0.5rem' }}>Owner</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
