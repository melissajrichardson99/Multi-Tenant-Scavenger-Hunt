import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { apiClient } from '../api/client';

const QR_REGION_ID = 'qr-reader-region';

// QR codes encode a full scan URL (e.g. http://localhost:3000/scan?code=xyz),
// not the bare code, so pull the `code` param out before submitting. If the
// decoded text isn't a URL at all, fall back to treating it as the raw code.
function extractCodeFromScan(decodedText) {
  try {
    const url = new URL(decodedText);
    const code = url.searchParams.get('code');
    return code || decodedText;
  } catch {
    return decodedText;
  }
}

const REASON_MESSAGES = {
  invalid_code: "That code doesn't match any character in this hunt. Double-check the sign and try again.",
  already_scanned: "You've already found this character — check your progress gallery!",
};

export default function Scan() {
  const navigate = useNavigate();
  const [deviceToken, setDeviceToken] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState(''); // 'success' | 'error'
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const html5QrcodeRef = useRef(null);
  const processingRef = useRef(false); // guards against duplicate submits while a scan is in flight

  useEffect(() => {
    const token = localStorage.getItem('device_token');
    if (!token) {
      setStatusMsg('No session found. Redirecting to home...');
      setStatusType('error');
      setTimeout(() => navigate('/'), 2000);
    } else {
      setDeviceToken(token);
    }
  }, [navigate]);

  const resumeCamera = () => {
    const scanner = html5QrcodeRef.current;
    if (scanner && scanner.isScanning) {
      scanner.resume();
    }
  };

  const handleScanSubmit = useCallback(async (codeVal) => {
    if (!codeVal || processingRef.current) return;
    processingRef.current = true;
    setLoading(true);
    setStatusMsg('');
    setStatusType('');

    try {
      const response = await apiClient.recordScan(deviceToken, codeVal);
      if (response.success) {
        setStatusMsg('Success! Character found.');
        setStatusType('success');
        setTimeout(() => {
          navigate(`/reveal/${response.character.id}`, { state: { scanResult: response } });
        }, 800);
      } else {
        setStatusMsg(REASON_MESSAGES[response.reason] || `Scan failed: ${response.reason}`);
        setStatusType('error');
        setLoading(false);
        processingRef.current = false;
        resumeCamera();
      }
    } catch (err) {
      setStatusMsg(`Error recording scan: ${err.message}`);
      setStatusType('error');
      setLoading(false);
      processingRef.current = false;
      resumeCamera();
    }
  }, [deviceToken, navigate]);

  // Start the camera-based scanner once we have a session to scan into.
  useEffect(() => {
    if (!deviceToken) return;

    const scanner = new Html5Qrcode(QR_REGION_ID);
    html5QrcodeRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          const activeScanner = html5QrcodeRef.current;
          if (activeScanner && activeScanner.isScanning) {
            activeScanner.pause(true);
          }
          handleScanSubmit(extractCodeFromScan(decodedText));
        },
        () => {
          // Fired continuously while no code is in view — not an error worth surfacing.
        }
      )
      .catch((err) => {
        setCameraError(
          'Camera unavailable (permission denied or no camera found). Use "Enter Code Manually" below instead.'
        );
      });

    return () => {
      const activeScanner = html5QrcodeRef.current;
      if (activeScanner) {
        if (activeScanner.isScanning) {
          activeScanner.stop().then(() => activeScanner.clear()).catch(() => {});
        } else {
          activeScanner.clear();
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceToken]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>Scan QR Code</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Find the physical signs around the park and scan them.
        </p>

        <div className="camera-container">
          <div id={QR_REGION_ID} style={{ width: '100%', height: '100%' }} />
          {cameraError && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📷</div>
              <p style={{ fontSize: '0.85rem' }}>{cameraError}</p>
            </div>
          )}
        </div>

        {statusMsg && (
          <div
            style={{
              marginTop: '1rem',
              fontWeight: '600',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              color: statusType === 'error' ? 'var(--danger-color)' : 'var(--success-color)',
              background: statusType === 'error' ? 'rgba(255,90,95,0.1)' : 'rgba(2,195,154,0.1)',
              border: `1px solid ${statusType === 'error' ? 'var(--danger-color)' : 'var(--success-color)'}`,
            }}
          >
            {statusMsg}
          </div>
        )}
      </div>

      {/* Manual entry — a permanent fallback for guests if QR scanning fails on-site */}
      <div className="card">
        <h3>Enter Code Manually</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Trouble scanning? Type the code printed on the sign below.
        </p>
        <div className="form-group">
          <input
            type="text"
            placeholder="e.g. cobb-kangaroo-01"
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
            {loading ? 'Processing...' : 'Submit Code'}
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
