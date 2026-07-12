import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';

export default function Home() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  const [hunt, setHunt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [healthStatus, setHealthStatus] = useState(null);

  // Default slug to 'cobbs' if not specified
  const huntSlug = slug || 'cobbs';

  useEffect(() => {
    // 1. Check API Health connection
    apiClient.checkHealth()
      .then(status => setHealthStatus(status))
      .catch(err => setHealthStatus({ status: 'offline', database: 'error' }));

    // 2. Fetch Hunt Info
    apiClient.getHunt(huntSlug)
      .then(data => {
        setHunt(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load hunt info.');
        setLoading(false);
      });
  }, [huntSlug]);

  const handleStartHunt = async () => {
    if (!hunt) return;
    try {
      setLoading(true);
      const session = await apiClient.createSession(hunt.hunt_id);
      // Store token in localStorage in addition to cookies for client-side API helper use
      localStorage.setItem('device_token', session.device_token);
      navigate('/progress');
    } catch (err) {
      setError(err.message || 'Failed to start session');
      setLoading(false);
    }
  };

  const handleResumeHunt = () => {
    navigate('/progress');
  };

  const existingToken = localStorage.getItem('device_token');

  if (loading) {
    return (
      <div className="card pulse" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <h2>Loading Hunt Information...</h2>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexdir: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      
      {/* API Connection Health Check Indicator */}
      <div className="card" style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', borderColor: healthStatus?.status === 'ok' ? '#02c39a' : '#ff5a5f' }}>
        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
          <span>Backend Health Check:</span>
          <strong>
            {healthStatus ? (
              <span style={{ color: healthStatus.status === 'ok' ? '#02c39a' : '#ff5a5f' }}>
                {healthStatus.status.toUpperCase()} (DB: {healthStatus.database})
              </span>
            ) : (
              'Checking...'
            )}
          </strong>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ borderColor: 'var(--danger-color)' }}>
          <h2 style={{ color: 'var(--danger-color)' }}>Error</h2>
          <p>{error}</p>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h1 style={{ fontSize: '2rem', color: 'var(--primary-color)' }}>
            {hunt?.name}
          </h1>
          
          <div style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
            Welcome to <strong>{hunt?.organization.name}</strong>!
          </div>

          <p style={{ lineHeight: '1.6' }}>
            Find all <strong>{hunt?.total_characters}</strong> hidden QR codes around the park. 
            Scan each one to unlock characters, earn points, and receive special prizes!
          </p>

          <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
            {existingToken ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button className="btn btn-primary" onClick={handleResumeHunt}>
                  Resume Scavenger Hunt
                </button>
                <button className="btn btn-secondary" onClick={handleStartHunt}>
                  Restart New Hunt
                </button>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={handleStartHunt}>
                Start Hunt!
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        No account required. Your progress is saved automatically on this device.
      </div>
    </div>
  );
}
