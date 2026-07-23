import React, { useState } from 'react';
import { apiClient } from '../api/client';

const EMPTY_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function ChangePassword() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const openForm = () => {
    setFormData(EMPTY_FORM);
    setError('');
    setSuccess('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData(EMPTY_FORM);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);
    try {
      await apiClient.changePassword(formData.currentPassword, formData.newPassword);
      setSaving(false);
      setFormData(EMPTY_FORM);
      setSuccess('Password changed successfully.');
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Failed to change password.');
    }
  };

  if (!showForm) {
    return (
      <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={openForm}>
        Change Password
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', background: 'rgba(0,0,0,0.15)', width: '100%', maxWidth: '360px' }}>
      <h4 style={{ marginBottom: '1rem' }}>Change Password</h4>

      {error && (
        <div style={{ background: 'rgba(255, 90, 95, 0.1)', border: '1px solid var(--danger-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--danger-color)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ background: 'rgba(80, 200, 120, 0.1)', border: '1px solid var(--success-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--success-color)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      <div className="form-group">
        <label>Current Password</label>
        <input
          type="password"
          required
          placeholder="••••••••"
          value={formData.currentPassword}
          onChange={e => setFormData({ ...formData, currentPassword: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>New Password</label>
        <input
          type="password"
          required
          placeholder="••••••••"
          value={formData.newPassword}
          onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Confirm New Password</label>
        <input
          type="password"
          required
          placeholder="••••••••"
          value={formData.confirmPassword}
          onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={saving}>
          {saving ? 'Saving...' : 'Update Password'}
        </button>
        <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={closeForm} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
