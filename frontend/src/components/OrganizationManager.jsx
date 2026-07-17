import React, { useState } from 'react';
import { apiClient } from '../api/client';

const EMPTY_FORM = {
  name: '',
  slug: '',
  theme_primary: '#000000',
  theme_secondary: '#ffffff',
  logo_url: '',
};

export default function OrganizationManager({ organizations, loadingOrganizations, onOrganizationsChanged }) {
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = !(apiClient.getCurrentAdminClaims()?.organization_id);

  const openAddForm = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setError('');
    setShowForm(true);
  };

  const openEditForm = (org) => {
    setEditingId(org.id);
    setFormData({
      name: org.name || '',
      slug: org.slug || '',
      theme_primary: org.theme_primary || '#000000',
      theme_secondary: org.theme_secondary || '#ffffff',
      logo_url: org.logo_url || '',
    });
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.updateOrganization({
          id: editingId,
          name: formData.name,
          slug: formData.slug,
          theme_primary: formData.theme_primary,
          theme_secondary: formData.theme_secondary,
          logo_url: formData.logo_url,
        });
      } else {
        await apiClient.createOrganization({
          name: formData.name,
          slug: formData.slug,
          theme_primary: formData.theme_primary,
          theme_secondary: formData.theme_secondary,
          logo_url: formData.logo_url,
        });
      }

      setSaving(false);
      closeForm();
      onOrganizationsChanged();
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Failed to save organization.');
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3>Organizations</h3>
        {isSuperAdmin && (
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={openAddForm}>
            + Add Organization
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(255, 90, 95, 0.1)', border: '1px solid var(--danger-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--danger-color)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.15)' }}>
          <h4 style={{ marginBottom: '1rem' }}>{editingId ? 'Edit Organization' : 'New Organization'}</h4>

          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Slug</label>
            <input
              type="text"
              required
              placeholder="e.g. cobbs-adventure-park"
              value={formData.slug}
              onChange={e => setFormData({ ...formData, slug: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Logo URL</label>
            <input
              type="text"
              placeholder="https://..."
              value={formData.logo_url}
              onChange={e => setFormData({ ...formData, logo_url: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2">
            <div className="form-group">
              <label>Primary Color</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="color"
                  style={{ width: '48px', padding: '0.2rem' }}
                  value={formData.theme_primary}
                  onChange={e => setFormData({ ...formData, theme_primary: e.target.value })}
                />
                <input
                  type="text"
                  value={formData.theme_primary}
                  onChange={e => setFormData({ ...formData, theme_primary: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Secondary Color</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="color"
                  style={{ width: '48px', padding: '0.2rem' }}
                  value={formData.theme_secondary}
                  onChange={e => setFormData({ ...formData, theme_secondary: e.target.value })}
                />
                <input
                  type="text"
                  value={formData.theme_secondary}
                  onChange={e => setFormData({ ...formData, theme_secondary: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Organization'}
            </button>
            <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={closeForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loadingOrganizations ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading organizations...</div>
      ) : organizations.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No organizations yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--card-border)' }}>
                <th style={{ padding: '0.5rem' }}>Name</th>
                <th style={{ padding: '0.5rem' }}>Slug</th>
                <th style={{ padding: '0.5rem' }}>Theme</th>
                <th style={{ padding: '0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map(org => (
                <tr key={org.id} style={{ borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.5rem' }}>{org.name}</td>
                  <td style={{ padding: '0.5rem' }}>{org.slug}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '4px', display: 'inline-block', background: org.theme_primary, border: '1px solid var(--card-border)' }} title={org.theme_primary} />
                      <span style={{ width: '18px', height: '18px', borderRadius: '4px', display: 'inline-block', background: org.theme_secondary, border: '1px solid var(--card-border)' }} title={org.theme_secondary} />
                    </div>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                      onClick={() => openEditForm(org)}
                    >
                      Edit
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
