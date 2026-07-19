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
  trivia_question: '',
  trivia_option_a: '',
  trivia_option_b: '',
  trivia_option_c: '',
  trivia_option_d: '',
  trivia_correct_answer: '',
  trivia_description: '',
};

export default function CharacterManager({ huntId }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

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
    setUploadError('');
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
      trivia_question: character.trivia_question || '',
      trivia_option_a: character.trivia_option_a || '',
      trivia_option_b: character.trivia_option_b || '',
      trivia_option_c: character.trivia_option_c || '',
      trivia_option_d: character.trivia_option_d || '',
      trivia_correct_answer: character.trivia_correct_answer || '',
      trivia_description: character.trivia_description || '',
    });
    setError('');
    setUploadError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setUploadError('');
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const result = await apiClient.uploadCharacterImage(file);
      setFormData(prev => ({ ...prev, image_url: result.image_url }));
    } catch (err) {
      setUploadError(err.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
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
        trivia_question: formData.trivia_question,
        trivia_option_a: formData.trivia_option_a,
        trivia_option_b: formData.trivia_option_b,
        trivia_option_c: formData.trivia_option_c,
        trivia_option_d: formData.trivia_option_d,
        trivia_correct_answer: formData.trivia_correct_answer,
        trivia_description: formData.trivia_description,
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

          <div className="form-group">
            <label>Or Upload an Image</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageFileChange}
              disabled={uploading}
            />
            {uploading && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                Uploading...
              </div>
            )}
            {uploadError && (
              <div style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                {uploadError}
              </div>
            )}
            {formData.image_url && (
              <img
                src={formData.image_url}
                alt="Preview"
                style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)', marginTop: '0.6rem' }}
              />
            )}
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

          <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Trivia Mini-Game (optional)</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Leave the question blank to skip trivia entirely for this character — the "Fun Fact" button
            only appears once a question is set.
          </p>

          <div className="form-group">
            <label>Trivia Question</label>
            <textarea
              rows={2}
              value={formData.trivia_question}
              onChange={e => setFormData({ ...formData, trivia_question: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2">
            <div className="form-group">
              <label>Option A</label>
              <input
                type="text"
                value={formData.trivia_option_a}
                onChange={e => setFormData({ ...formData, trivia_option_a: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Option B</label>
              <input
                type="text"
                value={formData.trivia_option_b}
                onChange={e => setFormData({ ...formData, trivia_option_b: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Option C</label>
              <input
                type="text"
                value={formData.trivia_option_c}
                onChange={e => setFormData({ ...formData, trivia_option_c: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Option D</label>
              <input
                type="text"
                value={formData.trivia_option_d}
                onChange={e => setFormData({ ...formData, trivia_option_d: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Correct Answer</label>
            <select
              value={formData.trivia_correct_answer}
              onChange={e => setFormData({ ...formData, trivia_correct_answer: e.target.value })}
            >
              <option value="">— Select —</option>
              <option value="a">Option A</option>
              <option value="b">Option B</option>
              <option value="c">Option C</option>
              <option value="d">Option D</option>
            </select>
          </div>

          <div className="form-group">
            <label>Trivia Description (fact shown after answering, right or wrong)</label>
            <textarea
              rows={3}
              value={formData.trivia_description}
              onChange={e => setFormData({ ...formData, trivia_description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={saving || uploading}>
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
