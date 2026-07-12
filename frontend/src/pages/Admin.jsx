import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [hunts, setHunts] = useState([]);
  const [selectedHuntId, setSelectedHuntId] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      // Fetch initial admin lists
      apiClient.getAdminHunts()
        .then(data => {
          setHunts(data);
          if (data.length > 0) {
            setSelectedHuntId(data[0].id);
          }
        })
        .catch(err => {
          if (err.message.includes('401') || err.message.includes('403')) {
            handleLogout();
          } else {
            setError('Failed to fetch hunts list.');
          }
        });
    }
  }, [token]);

  useEffect(() => {
    if (selectedHuntId) {
      apiClient.getHuntStats(selectedHuntId)
        .then(data => setStats(data))
        .catch(() => setError('Failed to fetch stats for this hunt.'));
    }
  }, [selectedHuntId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiClient.adminLogin(email, password);
      setToken(response.access_token);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Login failed.');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiClient.adminLogout();
    setToken(null);
    setHunts([]);
    setStats(null);
  };

  if (!token) {
    // Admin Login Screen
    return (
      <div style={{ maxWidth: '400px', margin: '2rem auto', width: '100%' }}>
        <div className="card">
          <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--primary-color)' }}>
            Admin Portal Login
          </h2>
          
          {error && (
            <div style={{ background: 'rgba(255, 90, 95, 0.1)', border: '1px solid var(--danger-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--danger-color)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                required 
                placeholder="admin@cobbsadventurepark.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label>Password</label>
              <input 
                type="password" 
                required 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Admin Dashboard Screen
  return (
    <div style={{ width: '100%' }}>
      
      {/* Top Banner */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>ADMIN PORTAL</span>
          <h2>Scavenger Hunt Dashboard</h2>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={handleLogout}>
          Sign Out
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        
        {/* Statistics and Hunt Selector */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3>Hunt Analytics</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ whiteSpace: 'nowrap' }}>Active Hunt: </label>
              <select 
                value={selectedHuntId} 
                onChange={e => setSelectedHuntId(e.target.value)}
                style={{ width: 'auto', padding: '0.4rem 1rem' }}
              >
                {hunts.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          </div>

          {stats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                    {stats.total_sessions}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Player Sessions</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--success-color)' }}>
                    {Math.round(stats.completion_rate * 100)}%
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Completion Rate</div>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: '0.75rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem' }}>
                  Character Scan Leaderboard
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {stats.character_stats.map((char, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                      <span>{char.name}</span>
                      <strong style={{ color: 'var(--primary-color)' }}>{char.scan_count} Scans</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>No statistics available.</div>
          )}
        </div>

        {/* Management stub operations */}
        <div className="card">
          <h3>Campaign Configuration Management</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            CRUD panel skeleton. Add, modify or delete properties, campaigns, characters and unlock triggers.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)', padding: '1rem', background: 'rgba(0,0,0,0.1)' }}>
              <h4>Properties (Orgs)</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem 0' }}>Configure logos, slugs & visual primary/secondary styles.</p>
              <button className="btn btn-secondary" onClick={() => alert('Feature stub: Properties Configuration')}>Manage Orgs</button>
            </div>
            
            <div style={{ border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)', padding: '1rem', background: 'rgba(0,0,0,0.1)' }}>
              <h4>Hunts</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem 0' }}>Set active schedule timelines, and associate characters.</p>
              <button className="btn btn-secondary" onClick={() => alert('Feature stub: Hunts Configuration')}>Manage Hunts</button>
            </div>

            <div style={{ border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)', padding: '1rem', background: 'rgba(0,0,0,0.1)' }}>
              <h4>Characters</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1rem 0' }}>Upload image assets, write reveal copy, and output QR sheets.</p>
              <button className="btn btn-secondary" onClick={() => alert('Feature stub: Characters Configuration')}>Manage Characters</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
