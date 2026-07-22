import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useOrgTheme } from '../theme';

function SortBadge({ sortOrder }) {
  if (sortOrder === null || sortOrder === undefined) return null;
  return (
    <div style={{
      position: 'absolute',
      top: '8px',
      left: '8px',
      background: 'none',
      color: 'var(--text-primary)',
      fontSize: '0.7rem',
      fontWeight: '700',
      width: '20px',
      height: '20px',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    }}>
      {sortOrder}
    </div>
  );
}

// Toggle for the circular "plate" backdrop behind character images (see the
// matching `.character-plate` block in index.css). Flip to false to remove
// the plate entirely without touching the name/layout fix above it.
const SHOW_CHARACTER_PLATE = true;

function CharacterCard({ char, onClick }) {
  return (
    <div
      className={`character-card ${char.found ? 'found' : 'locked'}`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="character-card-image">
        <SortBadge sortOrder={char.sort_order} />
        {char.found ? (
          <>
            <div className="badge">FOUND</div>
            {SHOW_CHARACTER_PLATE && <div className="character-plate" />}
            {char.image_url ? (
              <img src={char.image_url} alt={char.name} />
            ) : (
              <div style={{ fontSize: '2rem', position: 'relative', zIndex: 1 }}>🦘</div>
            )}
          </>
        ) : (
          <>
            <div className="badge locked">LOCKED</div>
            {SHOW_CHARACTER_PLATE && <div className="character-plate" />}
            <div style={{ fontSize: '2rem', opacity: 0.3, position: 'relative', zIndex: 1 }}>❓</div>
          </>
        )}
      </div>
      <div className="character-card-name">{char.found ? char.name : '???'}</div>
    </div>
  );
}

export default function Progress() {
  const navigate = useNavigate();
  const { activeOrg } = useOrgTheme();
  const [loading, setLoading] = useState(true);
  const [deviceToken, setDeviceToken] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [hintCharacter, setHintCharacter] = useState(null);
  const [expandedAreas, setExpandedAreas] = useState(() => new Set());

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

  const handleCardClick = (char) => {
    if (char.found) {
      navigate(`/reveal/${char.id}`);
    } else {
      setHintCharacter(char);
    }
  };

  const toggleArea = (areaName) => {
    setExpandedAreas(prev => {
      const next = new Set(prev);
      if (next.has(areaName)) {
        next.delete(areaName);
      } else {
        next.add(areaName);
      }
      return next;
    });
  };

  const characters = progress?.characters || [];
  const hasAreas = characters.some(c => c.area);
  const foundCharacters = characters.filter(c => c.found);
  const lockedCharacters = characters.filter(c => !c.found);

  const lockedByArea = hasAreas
    ? lockedCharacters.reduce((groups, char) => {
        const key = char.area || 'Other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(char);
        return groups;
      }, {})
    : null;

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
      {hasAreas ? (
        <>
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Characters Found</h3>
            {foundCharacters.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>None found yet — get scanning!</div>
            ) : (
              <div className="character-grid">
                {foundCharacters.map((char) => (
                  <CharacterCard key={char.id} char={char} onClick={() => handleCardClick(char)} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 style={{ marginBottom: '1rem' }}>Still Out There</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(lockedByArea).map(([areaName, areaChars]) => {
                const isExpanded = expandedAreas.has(areaName);
                return (
                  <div key={areaName} className="card" style={{ padding: '1rem' }}>
                    <div
                      onClick={() => toggleArea(areaName)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <span style={{ fontWeight: '600' }}>{areaName}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {areaChars.length} locked {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="character-grid" style={{ marginTop: '1rem' }}>
                        {areaChars.map((char) => (
                          <CharacterCard key={char.id} char={char} onClick={() => handleCardClick(char)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div>
          <h3 style={{ marginBottom: '1rem' }}>Characters Gallery</h3>
          <div className="character-grid">
            {characters.map((char) => (
              <CharacterCard key={char.id} char={char} onClick={() => handleCardClick(char)} />
            ))}
          </div>
        </div>
      )}

      {/* Hint Modal */}
      {hintCharacter && (
        <div
          onClick={() => setHintCharacter(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '360px', width: '100%', textAlign: 'center' }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❓</div>
            <h3 style={{ marginBottom: '0.75rem' }}>Hint</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {hintCharacter.hint || 'No hint available for this character yet.'}
            </p>
            <button className="btn btn-primary" onClick={() => setHintCharacter(null)}>
              Close
            </button>
          </div>
        </div>
      )}

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
