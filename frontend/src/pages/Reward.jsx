import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { apiClient } from '../api/client';
import { useOrgTheme } from '../theme';
import CompletionCard from '../components/CompletionCard';

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
  const { activeOrg } = useOrgTheme();
  const [deviceToken, setDeviceToken] = useState('');
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const cardCaptureRef = useRef(null);

  // Only populated when arriving straight from CharacterReveal's "Claim My
  // Badge" button on the scan that completed the hunt — reward_description/
  // reward_code aren't persisted anywhere the API can hand back later, so a
  // direct nav or refresh here just shows the generic completion card below.
  const unlockedRewards = location.state?.unlockedRewards || [];

  useEffect(() => {
    const token = localStorage.getItem('device_token');
    if (!token) {
      navigate(activeOrg?.slug ? `/start/${activeOrg.slug}` : '/');
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
  }, [navigate, activeOrg]);

  if (loading) {
    return (
      <div className="card pulse" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <h2>Loading Badge Status...</h2>
      </div>
    );
  }

  const isCompleted = progress && progress.total_found >= progress.total_characters;

  const handleShare = async () => {
    if (!cardCaptureRef.current || sharing) return;
    setSharing(true);

    try {
      const canvas = await html2canvas(cardCaptureRef.current, {
        backgroundColor: null,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <CompletionCard
            ref={cardCaptureRef}
            org={activeOrg}
            progress={progress}
            deviceToken={deviceToken}
            unlockedRewards={unlockedRewards}
          />

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
          <h2>Badge Locked</h2>

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
