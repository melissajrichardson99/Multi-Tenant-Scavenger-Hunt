import React, { useState } from 'react';
import { apiClient } from '../api/client';

const EMPTY_FORM = {
  organization_id: '',
  name: '',
  description: '',
  is_active: true,
  start_date: '',
  end_date: '',
};

function toDateInputValue(isoString) {
  return isoString ? isoString.slice(0, 10) : '';
}

function formatDate(isoString) {
  return isoString ? new Date(isoString).toLocaleDateString() : '—';
}

export default function HuntManager({ hunts, loadingHunts, onHuntsChanged, organizations }) {
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [expandedHuntId, setExpandedHuntId] = useState(null);
  const [statsByHuntId, setStatsByHuntId] = useState({});
  const [statsLoadingId, setStatsLoadingId] = useState(null);
  const [printingId, setPrintingId] = useState(null);

  const isSuperAdmin = !(apiClient.getCurrentAdminClaims()?.organization_id);

  const orgNameFor = (organizationId) => {
    const org = organizations.find(o => o.id === organizationId);
    return org ? org.name : organizationId;
  };

  const openAddForm = () => {
    setEditingId(null);
    setFormData({
      ...EMPTY_FORM,
      organization_id: organizations.length === 1 ? organizations[0].id : '',
    });
    setError('');
    setShowForm(true);
  };

  const openEditForm = (hunt) => {
    setEditingId(hunt.id);
    setFormData({
      organization_id: hunt.organization_id || '',
      name: hunt.name || '',
      description: hunt.description || '',
      is_active: !!hunt.is_active,
      start_date: toDateInputValue(hunt.start_date),
      end_date: toDateInputValue(hunt.end_date),
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
        await apiClient.updateHunt({
          id: editingId,
          name: formData.name,
          description: formData.description,
          is_active: formData.is_active,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        });
      } else {
        await apiClient.createHunt({
          organization_id: formData.organization_id,
          name: formData.name,
          description: formData.description,
          is_active: formData.is_active,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        });
      }

      setSaving(false);
      closeForm();
      onHuntsChanged();
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Failed to save hunt.');
    }
  };

  const toggleStats = (huntId) => {
    if (expandedHuntId === huntId) {
      setExpandedHuntId(null);
      return;
    }
    setExpandedHuntId(huntId);
    if (!statsByHuntId[huntId]) {
      setStatsLoadingId(huntId);
      setError('');
      apiClient.getHuntStats(huntId)
        .then(data => {
          setStatsByHuntId(prev => ({ ...prev, [huntId]: data }));
          setStatsLoadingId(null);
        })
        .catch(err => {
          setStatsLoadingId(null);
          setError(err.message || 'Failed to fetch hunt stats.');
        });
    }
  };

  const handlePrintQrCodes = async (hunt) => {
    setPrintingId(hunt.id);
    setError('');
    try {
      const blob = await apiClient.printQrCodes(hunt.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${hunt.name.replace(/\s+/g, '_')}_qr_codes.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to generate QR code PDF.');
    } finally {
      setPrintingId(null);
    }
  };

  const needsOrgPicker = !editingId && organizations.length > 1;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3>Hunts</h3>
        {isSuperAdmin && (
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={openAddForm}>
            + Add Hunt
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
          <h4 style={{ marginBottom: '1rem' }}>{editingId ? 'Edit Hunt' : 'New Hunt'}</h4>

          {!editingId && (
            <div className="form-group">
              <label>Organization</label>
              {needsOrgPicker ? (
                <select
                  required
                  value={formData.organization_id}
                  onChange={e => setFormData({ ...formData, organization_id: e.target.value })}
                >
                  <option value="" disabled>Select an organization...</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              ) : (
                <input type="text" value={orgNameFor(formData.organization_id) || ''} disabled />
              )}
            </div>
          )}

          {editingId && (
            <div className="form-group">
              <label>Organization</label>
              <input type="text" value={orgNameFor(formData.organization_id)} disabled />
            </div>
          )}

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
            <label>Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="checkbox"
              id="hunt-is-active"
              style={{ width: 'auto' }}
              checked={formData.is_active}
              onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
            />
            <label htmlFor="hunt-is-active" style={{ marginBottom: 0 }}>Active</label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Hunt'}
            </button>
            <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={closeForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loadingHunts ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading hunts...</div>
      ) : hunts.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No hunts yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--card-border)' }}>
                <th style={{ padding: '0.5rem' }}>Name</th>
                <th style={{ padding: '0.5rem' }}>Organization</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
                <th style={{ padding: '0.5rem' }}>Start</th>
                <th style={{ padding: '0.5rem' }}>End</th>
                <th style={{ padding: '0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hunts.map(hunt => (
                <React.Fragment key={hunt.id}>
                  <tr style={{ borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.5rem' }}>{hunt.name}</td>
                    <td style={{ padding: '0.5rem' }}>{orgNameFor(hunt.organization_id)}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{ color: hunt.is_active ? 'var(--success-color)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {hunt.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem' }}>{formatDate(hunt.start_date)}</td>
                    <td style={{ padding: '0.5rem' }}>{formatDate(hunt.end_date)}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                          onClick={() => openEditForm(hunt)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                          onClick={() => toggleStats(hunt.id)}
                        >
                          {expandedHuntId === hunt.id ? 'Hide Stats' : 'View Stats'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                          onClick={() => handlePrintQrCodes(hunt)}
                          disabled={printingId === hunt.id}
                        >
                          {printingId === hunt.id ? 'Generating...' : 'Print QR Codes'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedHuntId === hunt.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: '1rem', background: 'rgba(0,0,0,0.15)' }}>
                        {statsLoadingId === hunt.id ? (
                          <div style={{ color: 'var(--text-muted)' }}>Loading stats...</div>
                        ) : statsByHuntId[hunt.id] ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', maxWidth: '400px' }}>
                              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                                  {statsByHuntId[hunt.id].total_sessions}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Sessions</div>
                              </div>
                              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success-color)' }}>
                                  {Math.round(statsByHuntId[hunt.id].completion_rate * 100)}%
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Completion Rate</div>
                              </div>
                            </div>

                            <div>
                              <h4 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Character Scan Counts</h4>
                              {statsByHuntId[hunt.id].character_stats.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No characters for this hunt yet.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                  {statsByHuntId[hunt.id].character_stats.map((char, index) => (
                                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                                      <span>{char.name}</span>
                                      <strong style={{ color: 'var(--primary-color)' }}>{char.scan_count} scans</strong>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)' }}>No stats available.</div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
