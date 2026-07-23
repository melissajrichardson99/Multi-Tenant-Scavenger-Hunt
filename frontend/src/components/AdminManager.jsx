import React, { useState } from 'react';
import { apiClient } from '../api/client';

const EMPTY_FORM = {
  email: '',
  password: '',
  confirmPassword: '',
  organization_id: '',
};

export default function AdminManager({ adminUsers, loadingAdminUsers, onAdminUsersChanged, organizations }) {
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const isSuperAdmin = !(apiClient.getCurrentAdminClaims()?.organization_id);

  if (!isSuperAdmin) {
    return null;
  }

  const openAddForm = () => {
    setFormData(EMPTY_FORM);
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);
    try {
      await apiClient.createAdminUser({
        email: formData.email,
        password: formData.password,
        organization_id: formData.organization_id || null,
      });

      setSaving(false);
      closeForm();
      onAdminUsersChanged();
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Failed to create admin account.');
    }
  };

  const handleToggleActive = async (adminUser) => {
    setError('');
    setTogglingId(adminUser.id);
    try {
      if (adminUser.is_active) {
        await apiClient.deactivateAdminUser(adminUser.id);
      } else {
        await apiClient.reactivateAdminUser(adminUser.id);
      }
      setTogglingId(null);
      onAdminUsersChanged();
    } catch (err) {
      setTogglingId(null);
      setError(err.message || 'Failed to update admin account status.');
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3>Manage Admins</h3>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={openAddForm}>
          + Add Admin
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(255, 90, 95, 0.1)', border: '1px solid var(--danger-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--danger-color)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.15)' }}>
          <h4 style={{ marginBottom: '1rem' }}>New Admin</h4>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              required
              placeholder="admin@example.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Organization Scope</label>
            <select
              value={formData.organization_id}
              onChange={e => setFormData({ ...formData, organization_id: e.target.value })}
            >
              <option value="">Super Admin (all organizations)</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={saving}>
              {saving ? 'Saving...' : 'Create Admin'}
            </button>
            <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={closeForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loadingAdminUsers ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading admins...</div>
      ) : adminUsers.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No admin accounts yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--card-border)' }}>
                <th style={{ padding: '0.5rem' }}>Email</th>
                <th style={{ padding: '0.5rem' }}>Scope</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
                <th style={{ padding: '0.5rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.5rem' }}>{a.email}</td>
                  <td style={{ padding: '0.5rem' }}>{a.organization_name}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <span style={{ color: a.is_active ? 'var(--success-color)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ width: 'auto', padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}
                      onClick={() => handleToggleActive(a)}
                      disabled={togglingId === a.id}
                    >
                      {togglingId === a.id ? 'Working...' : (a.is_active ? 'Deactivate' : 'Reactivate')}
                    </button>
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
