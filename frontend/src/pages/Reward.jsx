import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { apiClient } from '../api/client';

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Reward() {
  const navigate = useNavigate();
  const location = useLocation();
  const [deviceToken, setDeviceToken] = useState('');
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const cardCaptureRef = useRef(null);

  // Only populated when arriving straight from CharacterReveal's "Claim My
  // Reward" button on the scan that completed the hunt — reward_description/
  // reward_code aren't persisted anywhere the API can hand back later, so a
  // direct nav or refresh here just shows the generic completion card below.
  const unlockedRewards = location.state?.unlockedRewards || [];

  useEffect(() => {
    const token = localStorage.getItem('device_token');
    if (!token) {
      navigate('/');
      return;
    }
    setDeviceToken(token);

    apiClient.getProgress(token)
      .then(data => {
        setProgress(data);
        setLoading(false);
      })
      .catch(err => {
        setLoading(false);
      });
  }, [navigate]);

  if (loading) {
    return (
      <div className="card pulse" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <h2>Loading Rewards Status...</h2>
      </div>
    );
  }

  const isCompleted = progress && progress.total_found >= progress.total_characters;

  const handleShare = async () => {
    if (!cardCaptureRef.current || sharing) return;
    setSharing(true);

    try {
      const canvas = await html2canvas(cardCaptureRef.current, {
        backgroundColor: '#151515',
        scale: 2,
        useCORS: true,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setSharing(false);
          alert('Could not generate share image. Please try again.');
          return;
        }

        const fileName = `cobbs-explorer-completion-${deviceToken.substring(0, 8)}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: "I completed Cobb's Adventure Park Scavenger Hunt!",
              text: "I found every character at Cobb's Adventure Park!",
            });
          } catch (err) {
            if (err.name !== 'AbortError') {
              downloadBlob(blob, fileName);
            }
          }
        } else {
          downloadBlob(blob, fileName);
        }

        setSharing(false);
      }, 'image/png');
    } catch (err) {
      setSharing(false);
      alert('Could not generate share image. Please try again.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      
      {isCompleted ? (
        <div className="completion-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div ref={cardCaptureRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div style={{ fontSize: '3.5rem' }}>🏆</div>

            <h1 style={{ color: 'var(--primary-color)', fontSize: '2.25rem', marginBottom: '0.25rem' }}>
              HUNT COMPLETED!
            </h1>

            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontStyle: 'italic' }}>
              Official Scavenger Explorer
            </p>

            <div style={{
              borderTop: '1px solid var(--card-border)',
              borderBottom: '1px solid var(--card-border)',
              padding: '1.5rem 0',
              margin: '0.5rem 0'
            }}>
              <h3 style={{ color: 'var(--success-color)' }}>Congratulations!</h3>
              <p style={{ fontSize: '0.95rem', lineHeight: '1.5', marginTop: '0.5rem' }}>
                You found all <strong>{progress.total_characters}</strong> characters hidden around Cobb's Adventure Park!
              </p>
            </div>

            {unlockedRewards.length > 0 && (
              <div style={{
                background: 'rgba(0,168,150,0.15)',
                border: '1px solid var(--success-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem',
                textAlign: 'left'
              }}>
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

            {/* Shareable card detail */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Explorer Token:</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', margin: '4px 0', fontSize: '0.8rem' }}>
                {deviceToken.substring(0, 16)}...
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>
                Show this screen to the main counter to claim your badge!
              </p>
            </div>

          </div>

          <button className="btn btn-primary" onClick={handleShare} disabled={sharing}>
            {sharing ? 'Preparing image...' : 'Share completion card!'}
          </button>

          <button className="btn btn-secondary" onClick={() => navigate('/progress')}>
            Back to Progress
          </button>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ fontSize: '3rem' }}>🔒</div>
          <h2>Reward Locked</h2>
          
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            You have scanned <strong>{progress?.total_found || 0}</strong> of <strong>{progress?.total_characters || 10}</strong> characters.
            Keep scanning to hit 100% completion and unlock your official explorer completion card!
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/scan')}>
              📷 Scan Characters
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/progress')}>
              View Progress
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
