import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';

const OPTION_KEYS = ['a', 'b', 'c', 'd'];

export default function TriviaQuestion() {
  const { characterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Passed by CharacterReveal on a fresh completing scan so we know whether
  // to route onward to /reward instead of /progress. Absent on the
  // gallery-revisit path, where there's no "hunt complete" context anyway.
  const isHuntComplete = location.state?.isHuntComplete || false;
  const unlockedRewards = location.state?.unlockedRewards || [];

  const [trivia, setTrivia] = useState(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    const deviceToken = localStorage.getItem('device_token');
    if (!characterId || !deviceToken) {
      navigate('/progress', { replace: true });
      return;
    }

    let cancelled = false;
    apiClient.getTrivia(characterId, deviceToken)
      .then((data) => {
        if (!cancelled) setTrivia(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [characterId, navigate]);

  useEffect(() => {
    if (failed) {
      navigate('/progress', { replace: true });
    }
  }, [failed, navigate]);

  if (!trivia) {
    return null;
  }

  const isCorrect = selected === trivia.trivia_correct_answer;

  const handleSelect = (key) => {
    if (answered) return;
    setSelected(key);
    setAnswered(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
          🎓 FUN FACT
        </div>

        <h2 style={{ marginBottom: '1.5rem' }}>{trivia.trivia_question}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left', marginBottom: answered ? '1.5rem' : 0 }}>
          {OPTION_KEYS.map((key) => {
            const optionText = trivia[`trivia_option_${key}`];
            if (!optionText) return null;

            const isSelected = selected === key;
            const isThisCorrect = key === trivia.trivia_correct_answer;

            let borderColor = 'var(--card-border)';
            if (answered && isThisCorrect) {
              borderColor = 'var(--success-color)';
            } else if (answered && isSelected && !isThisCorrect) {
              borderColor = 'var(--danger-color)';
            } else if (isSelected) {
              borderColor = 'var(--secondary-color)';
            }

            return (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                disabled={answered}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.9rem 1.1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${borderColor}`,
                  background: 'rgba(0,0,0,0.15)',
                  color: 'inherit',
                  cursor: answered ? 'default' : 'pointer',
                  fontSize: '1rem',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontWeight: '700', textTransform: 'uppercase' }}>{key}</span>
                <span>{optionText}</span>
                {answered && isThisCorrect && <span style={{ marginLeft: 'auto' }}>✅</span>}
                {answered && isSelected && !isThisCorrect && <span style={{ marginLeft: 'auto' }}>❌</span>}
              </button>
            );
          })}
        </div>

        {answered && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              fontWeight: '700',
              color: isCorrect ? 'var(--success-color)' : 'var(--danger-color)',
            }}>
              {isCorrect ? '🎉 Correct!' : '❌ Not quite!'}
            </div>

            {trivia.trivia_description && (
              <p style={{
                fontSize: '1.05rem',
                lineHeight: '1.7',
                textAlign: 'left',
                background: 'rgba(0,0,0,0.2)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-sm)',
                borderLeft: '4px solid var(--secondary-color)',
                margin: 0,
              }}>
                {trivia.trivia_description}
              </p>
            )}

            <button
              className="btn btn-primary"
              onClick={() => (
                isHuntComplete
                  ? navigate('/reward', { state: { unlockedRewards } })
                  : navigate('/progress')
              )}
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
