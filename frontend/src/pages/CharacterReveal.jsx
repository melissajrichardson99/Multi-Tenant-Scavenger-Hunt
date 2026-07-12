import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

export default function CharacterReveal() {
  const { characterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // If redirected from scanning, we might have the character data in location.state
  const scanResult = location.state?.scanResult;
  const character = scanResult?.character || {
    id: characterId || "33333333-4444-5555-6666-777777777777",
    name: "Cobb the Kangaroo",
    description: "Cobb is the friendly mascot of Cobb's Adventure Park! He loves bouncing around and greeting families. You found him near the Kangaroo Petting Area!",
    image_url: "https://example.com/cobb.png",
    points: 10
  };

  const totalFound = scanResult?.total_found ?? 4;
  const totalCharacters = scanResult?.total_characters ?? 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      
      <div className="card" style={{ textAlign: 'center', borderColor: 'var(--success-color)' }}>
        <div style={{ color: 'var(--success-color)', fontSize: '0.9rem', fontWeight: '800', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
          🎉 CHARACTER UNLOCKED!
        </div>
        
        <h1 style={{ fontSize: '2.25rem', color: 'var(--primary-color)', marginBottom: '1rem' }}>
          {character.name}
        </h1>

        {/* Character Image Placeholder */}
        <div style={{
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          border: '4px solid var(--primary-color)',
          margin: '0 auto 1.5rem auto',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {character.image_url ? (
            <img src={character.image_url} alt={character.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '5rem' }}>🦘</span>
          )}
        </div>

        {/* Points Badge */}
        <div style={{ 
          display: 'inline-block',
          background: 'rgba(0,168,150,0.2)',
          color: 'var(--accent-color)',
          fontWeight: '700',
          padding: '0.4rem 1rem',
          borderRadius: '20px',
          fontSize: '0.9rem',
          marginBottom: '1.5rem'
        }}>
          +{character.points} Points Added!
        </div>

        <p style={{ 
          fontSize: '1.05rem', 
          lineHeight: '1.7', 
          textAlign: 'left', 
          background: 'rgba(0,0,0,0.2)', 
          padding: '1.25rem', 
          borderRadius: 'var(--radius-sm)',
          borderLeft: '4px solid var(--primary-color)',
          marginBottom: '1.5rem'
        }}>
          {character.description}
        </p>

        {/* Progress Callout */}
        <div style={{ margin: '1rem 0 1.5rem 0', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
          You have found <strong>{totalFound}</strong> of <strong>{totalCharacters}</strong> characters!
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={() => navigate('/progress')}>
            View My Progress Gallery
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/scan')}>
            Scan Another QR Code
          </button>
        </div>

      </div>

    </div>
  );
}
