import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useOrgTheme } from '../theme';

export default function HuntSelector() {
  const [hunts, setHunts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { clearActiveOrg } = useOrgTheme();

  // A guest lands back here between hunts (or to pick a different org
  // entirely) — reset branding immediately so the selector itself, and
  // whichever hunt they pick next, never inherit a stale org's theme.
  useEffect(() => {
    clearActiveOrg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiClient.getActiveHunts()
      .then(data => { if (!cancelled) setHunts(data); })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load hunts.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="card pulse" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <h2>Loading Hunts...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderColor: 'var(--danger-color)', marginTop: '2rem' }}>
        <h2 style={{ color: 'var(--danger-color)' }}>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.75rem', color: 'var(--primary-color)' }}>Choose Your Hunt</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Pick an active scavenger hunt to get started.</p>
      </div>

      {hunts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>No active hunts right now. Check back soon!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {hunts.map(hunt => (
            <Link
              key={hunt.hunt_id}
              to={`/start/${hunt.organization.slug}`}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                textDecoration: 'none',
                color: 'inherit',
                borderColor: hunt.organization.theme_primary || 'var(--card-border)',
              }}
            >
              {hunt.organization.logo_url && (
                <img
                  src={hunt.organization.logo_url}
                  alt={`${hunt.organization.name} logo`}
                  style={{ width: '48px', height: '48px', objectFit: 'contain', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {hunt.organization.name}
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                  {hunt.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {hunt.total_characters} characters to find
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
