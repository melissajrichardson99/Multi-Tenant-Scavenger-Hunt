import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { apiClient } from '../api/client';
import { useOrgTheme } from '../theme';

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
  const { activeOrg } = useOrgTheme();
  const [searchParams] = useSearchParams();
  const codeParam = searchParams.get('code');
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
    if (token) {
      setDeviceToken(token);
      return;
    }

    // No session yet. If a code arrived via the URL (e.g. a physical sign
    // scanned with the phone's regular camera app, before ever visiting an
    // entrance screen), we don't yet know which org/hunt it belongs to —
    // look it up so we can route to the right entrance screen instead of
    // silently discarding the code at the generic hunt selector.
    if (codeParam) {
      apiClient.lookupHuntByCode(codeParam)
        .then((data) => {
          navigate(`/start/${data.organization_slug}?pendingCode=${encodeURIComponent(codeParam)}`);
        })
        .catch(() => {
          setStatusMsg("That code doesn't match any character. Double-check the sign and try again.");
          setStatusType('error');
          setTimeout(() => navigate('/'), 2500);
        });
      return;
    }

    setStatusMsg('No session found. Redirecting to home...');
    setStatusType('error');
    setTimeout(() => navigate(activeOrg?.slug ? `/start/${activeOrg.slug}` : '/'), 2000);
  }, [navigate, activeOrg, codeParam]);

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

  // If a code arrived via the URL and we already have a session (e.g.
  // re-opening the QR's own URL, or arriving here after Start.jsx resumed
  // a session for a pending code), auto-submit it exactly like manual
  // entry — the guest shouldn't need to re-scan or retype anything.
  useEffect(() => {
    if (deviceToken && codeParam) {
      handleScanSubmit(codeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceToken, codeParam]);

  // Start the camera-based scanner once we have a session to scan into.
  useEffect(() => {
    if (!deviceToken) return;

    let unmounted = false;
    // Captured directly (not via a React ref prop) so it stays reachable
    // from the cleanup below even after React has detached the DOM subtree
    // and nulled out any ref props for the unmount.
    const containerEl = document.getElementById(QR_REGION_ID);

    const scanner = new Html5Qrcode(QR_REGION_ID);
    html5QrcodeRef.current = scanner;

    // Defense-in-depth: html5-qrcode acquires the camera via getUserMedia
    // (turning on the hardware indicator) well before its own `isScanning`
    // flag flips true — that only happens once the <video> element fires
    // "playing". If we unmount inside that window, the library's stop()
    // throws ("not running") and clear() only wipes the DOM, so the raw
    // stream is never told to stop. Reach into the video element directly
    // and kill its tracks regardless of what state the library thinks it's in.
    const killAnyActiveStream = () => {
      const videoEl = containerEl?.querySelector('video');
      const stream = videoEl?.srcObject;
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Already stopped — nothing to do.
          }
        });
      }
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };

    const teardownScanner = () => {
      // Grab the stream before stop()/clear() has a chance to tear down or
      // detach the video element out from under us.
      killAnyActiveStream();
      if (scanner.isScanning) {
        scanner.stop().then(() => scanner.clear()).catch(() => {}).finally(killAnyActiveStream);
      } else {
        try {
          scanner.clear();
        } catch {
          // Nothing rendered yet, or already cleared — fine either way.
        }
      }
    };

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
      .then(() => {
        // start() resolves slightly before `isScanning` flips true (that
        // happens on the video's "playing" event). If the component
        // unmounted in that gap, finish tearing the camera down now instead
        // of leaving it running unattended.
        if (unmounted) {
          teardownScanner();
        }
      })
      .catch(() => {
        if (!unmounted) {
          setCameraError(
            'Camera unavailable (permission denied or no camera found). Use "Enter Code Manually" below instead.'
          );
        }
        // A stream can be briefly acquired even on a path that ultimately
        // rejects (e.g. a later constraint failure) — sweep regardless.
        killAnyActiveStream();
      });

    return () => {
      unmounted = true;
      teardownScanner();
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
            placeholder="e.g. K7XQ-2M9P-T4RN"
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
