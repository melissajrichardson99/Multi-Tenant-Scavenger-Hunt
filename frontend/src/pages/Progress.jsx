import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useOrgTheme } from '../theme';

export default function Progress() {
  const navigate = useNavigate();
  const { activeOrg } = useOrgTheme();
  const [loading, setLoading] = useState(true);
  const [deviceToken, setDeviceToken] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('device_token');
    if (!token) {
      navigate(activeOrg?.slug ? `/start/${activeOrg.slug}` : '/');
      return;
    }
    setDeviceToken(token);

    apiClient.getProgress(token)
      .then(data => {
        setProgress(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load progress.');
        setLoading(false);
      });
  }, [navigate, activeOrg]);

  if (loading) {
    return (
      <div className="card pulse" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <h2>Loading Progress...</h2>
      </div>
    );
  }

  const completionPercent = progress 
    ? Math.round((progress.total_found / progress.total_characters) * 100) 
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Progress Dashboard Header */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3>Hunt Progress</h3>
          <span style={{ fontWeight: '700', color: 'var(--secondary-color)' }}>
            {progress?.total_found} / {progress?.total_characters} Found
          </span>
        </div>
        
        {/* Progress Bar */}
        <div style={{ background: 'rgba(255,255,255,0.1)', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ 
            background: 'linear-gradient(90deg, var(--secondary-color), var(--success-color))',
            height: '100%', 
            width: `${completionPercent}%`,
            transition: 'width 0.5s ease-out'
          }} />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={() => navigate('/scan')}>
            📷 Scan QR Code
          </button>
          
          {completionPercent >= 100 && (
            <button className="btn btn-secondary" style={{ borderColor: 'var(--success-color)' }} onClick={() => navigate('/reward')}>
              🎖️ Claim My Badge
            </button>
          )}
        </div>
      </div>

      {/* Grid of Characters */}
      <div>
        <h3 style={{ marginBottom: '1rem' }}>Characters Gallery</h3>
        <div className="character-grid">
          {progress?.characters.map((char) => (
            <div 
              key={char.id} 
              className={`character-card ${char.found ? 'found' : 'locked'}`}
              onClick={() => char.found && navigate(`/reveal/${char.id}`)}
              style={{ cursor: char.found ? 'pointer' : 'default' }}
            >
              {char.found ? (
                <>
                  <div className="badge">FOUND</div>
                  {char.image_url ? (
                    <img src={char.image_url} alt={char.name} />
                  ) : (
                    <div style={{ fontSize: '2rem' }}>🦘</div>
                  )}
                  <div className="name">{char.name}</div>
                </>
              ) : (
                <>
                  <div className="badge locked">LOCKED</div>
                  <div style={{ fontSize: '2rem', opacity: 0.3 }}>❓</div>
                  <div className="name">???</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
        <button className="btn btn-secondary" style={{ width: 'auto', fontSize: '0.85rem' }} onClick={() => navigate(activeOrg?.slug ? `/start/${activeOrg.slug}` : '/')}>
          🏠 Back to Home
        </button>
        <button className="btn btn-secondary" style={{ width: 'auto', fontSize: '0.85rem' }} onClick={() => navigate('/reward')}>
          🎖️ My Badge
        </button>
      </div>

    </div>
  );
}
