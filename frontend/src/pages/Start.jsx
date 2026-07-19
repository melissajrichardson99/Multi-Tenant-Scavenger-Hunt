import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useOrgTheme } from '../theme';

export default function Start() {
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const { setActiveOrg } = useOrgTheme();

  const [hunt, setHunt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        // 1. Fetch hunt info
        const huntData = await apiClient.getHunt(orgSlug);
        if (cancelled) return;
        setHunt(huntData);

        // Store this org's branding so it can be applied on this and every
        // other hunt-specific guest page; overwrites whatever the previous
        // hunt (if any) had left behind so theming never leaks across orgs.
        setActiveOrg({
          name: huntData.organization?.name,
          slug: huntData.organization?.slug || orgSlug,
          logo_url: huntData.organization?.logo_url,
          theme_primary: huntData.organization?.theme_primary,
          theme_secondary: huntData.organization?.theme_secondary,
          theme_mode: huntData.organization?.theme_mode,
        });

        // 2. Validate existing session from localStorage
        const storedToken = localStorage.getItem('device_token');
        if (storedToken) {
          try {
            const sessionData = await apiClient.getSession(storedToken);
            // Token is valid, but only offer Resume if it belongs to *this* hunt —
            // the same device_token can carry over from a different organization's hunt.
            if (!cancelled) setHasValidSession(sessionData.hunt_id === huntData.hunt_id);
          } catch (sessionErr) {
            // 404 or network error — token is stale; clear it so we get a fresh one on Start
            localStorage.removeItem('device_token');
            if (!cancelled) setHasValidSession(false);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load hunt info.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initialize();
    return () => { cancelled = true; };
  }, [orgSlug, setActiveOrg]);

  const handleStartHunt = async () => {
    if (!hunt) return;
    try {
      setLoading(true);
      const session = await apiClient.createSession(hunt.hunt_id);
      // Store device_token in localStorage; all subsequent calls read it from here
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

  if (loading) {
    return (
      <div className="card pulse" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <h2>Loading Hunt Information...</h2>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>

      {error ? (
        <div className="card" style={{ borderColor: 'var(--danger-color)' }}>
          <h2 style={{ color: 'var(--danger-color)' }}>Error</h2>
          <p>{error}</p>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h1 style={{ fontSize: '2rem', color: 'var(--secondary-color)' }}>
            {hunt?.name}
          </h1>

          <div style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
            Welcome to <strong>{hunt?.organization?.name}</strong>!
          </div>

          <p style={{ lineHeight: '1.6' }}>
            Find all <strong>{hunt?.total_characters}</strong> hidden QR codes around <strong>{hunt?.organization?.name}</strong>.
            Scan each one to unlock characters, earn points, and receive a special badge!
          </p>

          <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
            {hasValidSession ? (
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
