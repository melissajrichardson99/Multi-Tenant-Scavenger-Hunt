import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

export default function Scan() {
  const navigate = useNavigate();
  const [deviceToken, setDeviceToken] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('device_token');
    if (!token) {
      setStatusMsg('No session found. Redirecting to home...');
      setTimeout(() => navigate('/'), 2000);
    } else {
      setDeviceToken(token);
    }
  }, [navigate]);

  const handleScanSubmit = async (codeVal) => {
    if (!codeVal) return;
    setLoading(true);
    setStatusMsg('');
    try {
      const response = await apiClient.recordScan(deviceToken, codeVal);
      if (response.success) {
        setStatusMsg('Success! Character scanned.');
        // Route to CharacterReveal page with character payload
        setTimeout(() => {
          navigate(`/reveal/${response.character.id}`, { state: { scanResult: response } });
        }, 800);
      } else {
        setStatusMsg(`Scan failed: ${response.reason}`);
        setLoading(false);
      }
    } catch (err) {
      setStatusMsg(`Error recording scan: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>Scan QR Code</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Find the physical signs around the park and scan them.
        </p>

        {/* Mock/Placeholder Camera Scanner Viewport */}
        <div className="camera-container">
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📷</div>
            <p>QR Scanner Placeholder</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Camera API loaded: html5-qrcode)</p>
          </div>
        </div>

        {statusMsg && (
          <div style={{ marginTop: '1rem', fontWeight: '600', color: statusMsg.includes('failed') || statusMsg.includes('Error') ? 'var(--danger-color)' : 'var(--success-color)' }}>
            {statusMsg}
          </div>
        )}
      </div>

      {/* Manual Input (Highly helpful for testing without printing codes) */}
      <div className="card">
        <h3>Local Test Simulator</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Simulate a QR scan scan by entering a character key below:
        </p>
        <div className="form-group">
          <input 
            type="text" 
            placeholder="e.g. char_cobb_2026, invalid, already"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            disabled={loading}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => handleScanSubmit(manualCode)}
            disabled={loading || !manualCode}
          >
            {loading ? 'Processing...' : 'Simulate QR Code Scan'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/progress')}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
