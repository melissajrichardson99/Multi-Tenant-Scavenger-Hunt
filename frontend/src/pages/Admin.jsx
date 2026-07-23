import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import CharacterManager from '../components/CharacterManager';
import HuntManager from '../components/HuntManager';
import OrganizationManager from '../components/OrganizationManager';
import AdminManager from '../components/AdminManager';

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [hunts, setHunts] = useState([]);
  const [loadingHunts, setLoadingHunts] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false);
  const [selectedHuntId, setSelectedHuntId] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  // Only super-admins (organization_id is null on their JWT claims) can see
  // the admin roster — matches the backend restriction on GET /admin-users.
  const isSuperAdmin = !(apiClient.getCurrentAdminClaims()?.organization_id);

  const refreshAdminUsers = () => {
    if (!isSuperAdmin) return;
    setLoadingAdminUsers(true);
    apiClient.getAdminUsers()
      .then(data => {
        setAdminUsers(data);
        setLoadingAdminUsers(false);
      })
      .catch(err => {
        setLoadingAdminUsers(false);
        if (err.status === 401 || err.status === 403) {
          handleLogout();
        } else {
          setError('Failed to fetch admin accounts list.');
        }
      });
  };

  const refreshOrganizations = () => {
    setLoadingOrganizations(true);
    apiClient.getOrganizations()
      .then(data => {
        setOrganizations(data);
        setLoadingOrganizations(false);
      })
      .catch(err => {
        setLoadingOrganizations(false);
        if (err.status === 401 || err.status === 403) {
          handleLogout();
        } else {
          setError('Failed to fetch organizations list.');
        }
      });
  };

  const refreshHunts = () => {
    setLoadingHunts(true);
    apiClient.getAdminHunts()
      .then(data => {
        setHunts(data);
        setSelectedHuntId(prevSelected => {
          if (prevSelected && data.some(h => h.id === prevSelected)) {
            return prevSelected;
          }
          return data.length > 0 ? data[0].id : '';
        });
        setLoadingHunts(false);
      })
      .catch(err => {
        setLoadingHunts(false);
        if (err.status === 401 || err.status === 403) {
          handleLogout();
        } else {
          setError('Failed to fetch hunts list.');
        }
      });
  };

  useEffect(() => {
    if (token) {
      refreshHunts();
      refreshOrganizations();
      refreshAdminUsers();
    }
  }, [token]);

  useEffect(() => {
    if (selectedHuntId) {
      apiClient.getHuntStats(selectedHuntId)
        .then(data => setStats(data))
        .catch(err => {
          if (err.status === 401 || err.status === 403) {
            handleLogout();
          } else {
            setError('Failed to fetch stats for this hunt.');
          }
        });
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
    setOrganizations([]);
    setAdminUsers([]);
    setStats(null);
    setEmail('');
    setPassword('');
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

          <form onSubmit={handleLogin} noValidate>
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

        <OrganizationManager
          organizations={organizations}
          loadingOrganizations={loadingOrganizations}
          onOrganizationsChanged={refreshOrganizations}
        />

        <HuntManager
          hunts={hunts}
          loadingHunts={loadingHunts}
          onHuntsChanged={refreshHunts}
          organizations={organizations}
        />

        <CharacterManager huntId={selectedHuntId} />

        <AdminManager
          adminUsers={adminUsers}
          loadingAdminUsers={loadingAdminUsers}
          onAdminUsersChanged={refreshAdminUsers}
          organizations={organizations}
        />

      </div>
    </div>
  );
}
