import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

export default function Reward() {
  const navigate = useNavigate();
  const [deviceToken, setDeviceToken] = useState('');
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      
      {isCompleted ? (
        <div className="completion-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
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

          <button className="btn btn-primary" onClick={() => alert('Mock Sharing Initiated! Share this screen to Facebook/Instagram!')}>
            Share completion card!
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
