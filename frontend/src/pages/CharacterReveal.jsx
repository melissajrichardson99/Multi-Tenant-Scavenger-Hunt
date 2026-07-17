import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';

export default function CharacterReveal() {
  const { characterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Two ways to land here: Scan.jsx passes the full scan response via route
  // state right after a fresh find, or Progress.jsx's gallery links to
  // /reveal/:characterId with no state so a previously-found character can
  // be revisited. Route state wins when present; otherwise we fetch the
  // character by ID (proving ownership via device_token) for the revisit case.
  const scanResult = location.state?.scanResult;
  const isRevisit = !scanResult;

  const [revisitCharacter, setRevisitCharacter] = useState(null);
  const [revisitFailed, setRevisitFailed] = useState(false);

  useEffect(() => {
    if (scanResult) return;

    const deviceToken = localStorage.getItem('device_token');
    if (!characterId || !deviceToken) {
      navigate('/progress', { replace: true });
      return;
    }

    let cancelled = false;
    apiClient.getCharacter(characterId, deviceToken)
      .then((data) => {
        if (!cancelled) setRevisitCharacter(data);
      })
      .catch(() => {
        if (!cancelled) setRevisitFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [scanResult, characterId, navigate]);

  useEffect(() => {
    if (revisitFailed) {
      navigate('/progress', { replace: true });
    }
  }, [revisitFailed, navigate]);

  const character = scanResult?.character || revisitCharacter;

  if (!character) {
    return null;
  }

  const totalFound = scanResult?.total_found;
  const totalCharacters = scanResult?.total_characters;
  const unlockedRewards = scanResult?.newly_unlocked_rewards || [];
  const isHuntComplete = unlockedRewards.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>

      <div className="card" style={{ textAlign: 'center', borderColor: isRevisit ? 'var(--secondary-color)' : 'var(--success-color)' }}>
        {isRevisit ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
            YOU FOUND THIS CHARACTER
          </div>
        ) : (
          <div style={{ color: 'var(--success-color)', fontSize: '0.9rem', fontWeight: '800', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            🎉 CHARACTER UNLOCKED!
          </div>
        )}

        <h1 style={{ fontSize: '2.25rem', color: 'var(--secondary-color)', marginBottom: '1rem' }}>
          {character.name}
        </h1>

        {/* Character Image Placeholder */}
        <div style={{
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          border: '4px solid var(--secondary-color)',
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
        {!isRevisit && (
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
        )}

        <p style={{
          fontSize: '1.05rem',
          lineHeight: '1.7',
          textAlign: 'left',
          background: 'rgba(0,0,0,0.2)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '4px solid var(--secondary-color)',
          marginBottom: '1.5rem'
        }}>
          {character.description}
        </p>

        {/* Progress Callout */}
        {!isRevisit && (
          <div style={{ margin: '1rem 0 1.5rem 0', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            You have found <strong>{totalFound}</strong> of <strong>{totalCharacters}</strong> characters!
          </div>
        )}

        {!isRevisit && isHuntComplete && (
          <div style={{
            background: 'rgba(0,168,150,0.15)',
            border: '1px solid var(--success-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            textAlign: 'left'
          }}>
            <div style={{ fontWeight: '700', color: 'var(--success-color)', marginBottom: '0.5rem' }}>
              🎁 Reward Unlocked!
            </div>
            {unlockedRewards.map((reward, idx) => (
              <div key={idx} style={{ marginBottom: idx < unlockedRewards.length - 1 ? '0.75rem' : 0 }}>
                <p style={{ margin: 0 }}>{reward.reward_description}</p>
                {reward.reward_code && (
                  <p style={{ fontFamily: 'monospace', fontWeight: '700', margin: '0.25rem 0 0 0' }}>
                    Code: {reward.reward_code}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {isRevisit ? (
            <button className="btn btn-primary" onClick={() => navigate('/progress')}>
              Back to Progress Gallery
            </button>
          ) : isHuntComplete ? (
            <button className="btn btn-primary" onClick={() => navigate('/reward', { state: { unlockedRewards } })}>
              🏆 Claim My Reward
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => navigate('/progress')}>
              View My Progress Gallery
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => navigate('/scan')}>
            Scan Another QR Code
          </button>
        </div>

      </div>

    </div>
  );
}
