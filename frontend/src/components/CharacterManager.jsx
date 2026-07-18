import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

const EMPTY_FORM = {
  name: '',
  description: '',
  image_url: '',
  points: 10,
  sort_order: 0,
  hint: '',
  area: '',
};

export default function CharacterManager({ huntId }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const refreshCharacters = () => {
    if (!huntId) return;
    setLoading(true);
    apiClient.getAdminCharacters(huntId)
      .then(data => {
        setCharacters(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch characters.');
        setLoading(false);
      });
  };

  useEffect(() => {
    refreshCharacters();
    setShowForm(false);
    setEditingId(null);
    setDeleteConfirmId(null);
  }, [huntId]);

  const openAddForm = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setError('');
    setShowForm(true);
  };

  const openEditForm = (character) => {
    setEditingId(character.id);
    setFormData({
      name: character.name || '',
      description: character.description || '',
      image_url: character.image_url || '',
      points: character.points ?? 10,
      sort_order: character.sort_order ?? 0,
      hint: character.hint || '',
      area: character.area || '',
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
      const payload = {
        name: formData.name,
        description: formData.description,
        image_url: formData.image_url,
        points: Number(formData.points),
        sort_order: Number(formData.sort_order),
        hint: formData.hint,
        area: formData.area,
      };

      if (editingId) {
        await apiClient.updateCharacter({ id: editingId, ...payload });
      } else {
        await apiClient.createCharacter({ hunt_id: huntId, ...payload });
      }

      setSaving(false);
      closeForm();
      refreshCharacters();
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Failed to save character.');
    }
  };

  const handleDelete = async (characterId) => {
    setError('');
    setDeletingId(characterId);
    try {
      await apiClient.deleteCharacter(characterId);
      setDeletingId(null);
      setDeleteConfirmId(null);
      refreshCharacters();
    } catch (err) {
      setDeletingId(null);
      setError(err.message || 'Failed to delete character.');
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3>Characters</h3>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={openAddForm} disabled={!huntId}>
          + Add Character
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(255, 90, 95, 0.1)', border: '1px solid var(--danger-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--danger-color)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)', padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.15)' }}>
          <h4 style={{ marginBottom: '1rem' }}>{editingId ? 'Edit Character' : 'New Character'}</h4>

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

          <div className="form-group">
            <label>Image URL</label>
            <input
              type="text"
              placeholder="https://..."
              value={formData.image_url}
              onChange={e => setFormData({ ...formData, image_url: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2">
            <div className="form-group">
              <label>Points</label>
              <input
                type="number"
                value={formData.points}
                onChange={e => setFormData({ ...formData, points: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Sort Order</label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={e => setFormData({ ...formData, sort_order: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Hint (shown to guests before they find this character)</label>
            <textarea
              rows={2}
              value={formData.hint}
              onChange={e => setFormData({ ...formData, hint: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Area (optional — enables area grouping on the progress page)</label>
            <input
              type="text"
              placeholder="e.g. Animals, Games"
              value={formData.area}
              onChange={e => setFormData({ ...formData, area: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Character'}
            </button>
            <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={closeForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading characters...</div>
      ) : characters.length === 0 ? (
        <div style={{ color: 'var(--text-muted)' }}>No characters yet for this hunt.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--card-border)' }}>
                <th style={{ padding: '0.5rem' }}>Image</th>
                <th style={{ padding: '0.5rem' }}>Name</th>
                <th style={{ padding: '0.5rem' }}>Points</th>
                <th style={{ padding: '0.5rem' }}>QR Code</th>
                <th style={{ padding: '0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {characters.map(char => (
                <tr key={char.id} style={{ borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.5rem' }}>
                    {char.image_url ? (
                      <img
                        src={char.image_url}
                        alt={char.name}
                        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}
                      />
                    ) : (
                      <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        None
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem' }}>{char.name}</td>
                  <td style={{ padding: '0.5rem' }}>{char.points}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {char.qr_code_image_url ? (
                      <a href={char.qr_code_image_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={char.qr_code_image_url}
                          alt={`QR code for ${char.name}`}
                          style={{ width: '48px', height: '48px', objectFit: 'contain', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}
                        />
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                        onClick={() => openEditForm(char)}
                      >
                        Edit
                      </button>

                      {deleteConfirmId === char.id ? (
                        <>
                          <button
                            className="btn btn-danger"
                            style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                            onClick={() => handleDelete(char.id)}
                            disabled={deletingId === char.id}
                          >
                            {deletingId === char.id ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                            onClick={() => setDeleteConfirmId(null)}
                            disabled={deletingId === char.id}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-danger"
                          style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                          onClick={() => setDeleteConfirmId(char.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
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
