import React, { forwardRef } from 'react';

// html2canvas 1.4.1 cannot parse modern CSS color functions (color-mix(),
// oklch(), etc.) or var() chains that resolve through them, so every color
// used inside the captured card is computed here as a literal hex/rgb string
// in JS rather than pulled from CSS custom properties or color-mix().
function hexToRgb(hex) {
  const clean = (hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num) || full.length !== 6) return { r: 26, g: 26, b: 26 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function isLightColor(hex) {
  return relativeLuminance(hexToRgb(hex)) > 0.5;
}

// percent > 0 lightens toward white, percent < 0 darkens toward black
function shade(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const amt = Math.round(2.55 * percent);
  const clamp = v => Math.max(0, Math.min(255, v));
  return `rgb(${clamp(r + amt)}, ${clamp(g + amt)}, ${clamp(b + amt)})`;
}

// Nudges a brand color toward black/white until it reads clearly against a
// known-dark or known-light surface, instead of trusting arbitrary org input.
function ensureContrast(hex, backgroundIsDark) {
  const light = isLightColor(hex);
  if (backgroundIsDark) return light ? hex : shade(hex, 50);
  return light ? shade(hex, -50) : hex;
}

const DEFAULT_ORG = {
  name: 'Scavenger Hunt',
  logo_url: '',
  theme_primary: '#f7931e',
  theme_secondary: '#1a1a1a',
  theme_mode: 'dark',
};

const CompletionCard = forwardRef(function CompletionCard(
  { org, progress, deviceToken, unlockedRewards = [] },
  ref
) {
  const theme = { ...DEFAULT_ORG, ...(org || {}) };
  const primary = theme.theme_primary || DEFAULT_ORG.theme_primary;
  const secondary = theme.theme_secondary || DEFAULT_ORG.theme_secondary;
  const isDark = theme.theme_mode !== 'light';

  const bannerTextColor = isLightColor(primary) ? '#1a1a1a' : '#ffffff';
  const badgeRing = ensureContrast(secondary, !isLightColor(primary));
  // Logo artwork is designed for a specific background: dark logos expect a
  // light plate, light/reversed logos (e.g. "Logo-Dark-Alt") expect a dark
  // plate. theme_mode tells us which the org's logo was designed for.
  const badgeBg = isDark ? '#0d0d0f' : '#ffffff';

  const scrimBg = isDark ? 'rgba(12, 12, 16, 0.62)' : 'rgba(255, 255, 255, 0.9)';
  const textColor = isDark ? '#ffffff' : '#1a1a1a';
  const mutedTextColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(26,26,26,0.65)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)';
  const headingColor = ensureContrast(secondary, isDark);
  const successColor = '#02c39a';

  return (
    <div
      ref={ref}
      style={{
        background: `linear-gradient(160deg, ${primary} 0%, ${shade(primary, -32)} 100%)`,
        borderRadius: 28,
        border: `3px solid ${badgeRing}`,
        boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
        padding: '2rem 1.5rem 1.75rem',
        textAlign: 'center',
      }}
    >
      {/* Brand focal point: logo on a neutral plate matched to theme_mode so
          both dark-on-light and light-on-dark logo artwork stays legible. */}
      <div
        style={{
          width: 132,
          height: 132,
          borderRadius: '50%',
          background: badgeBg,
          border: `4px solid ${badgeRing}`,
          boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {theme.logo_url ? (
          // A background-image div, not an <img> with object-fit — html2canvas
          // 1.4.1 clips/mis-scales object-fit: contain images in the captured
          // canvas even though they render fine live in the browser.
          <div
            role="img"
            aria-label={`${theme.name} logo`}
            style={{
              width: '76%',
              height: '76%',
              backgroundImage: `url(${theme.logo_url})`,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        ) : (
          <span style={{ fontSize: '3rem' }}>🏆</span>
        )}
      </div>

      <div
        style={{
          marginTop: '0.85rem',
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 800,
          fontSize: '1.05rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: bannerTextColor,
        }}
      >
        {theme.name}
      </div>

      {/* Content scrim: guarantees legible text regardless of how light or
          dark the org's brand colors are. */}
      <div
        style={{
          marginTop: '1.5rem',
          background: scrimBg,
          borderRadius: 20,
          border: `2px solid ${badgeRing}`,
          padding: '1.75rem 1.5rem',
          color: textColor,
        }}
      >
        <h1 style={{ color: headingColor, fontSize: '1.85rem', marginBottom: '0.25rem' }}>
          HUNT COMPLETED!
        </h1>

        <p style={{ color: mutedTextColor, fontSize: '1rem', fontStyle: 'italic' }}>
          Official Scavenger Explorer
        </p>

        <div
          style={{
            borderTop: `1px solid ${dividerColor}`,
            padding: '1.5rem 0 0',
            margin: '1rem 0 0',
          }}
        >
          <h3 style={{ color: successColor }}>Congratulations!</h3>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.5', marginTop: '0.5rem', color: textColor }}>
            You found all <strong>{progress.total_characters}</strong> characters hidden around{' '}
            {theme.name}!
          </p>
        </div>

        {unlockedRewards.length > 0 && (
          <div
            style={{
              background: 'rgba(2,195,154,0.15)',
              border: `1px solid ${successColor}`,
              borderRadius: 12,
              padding: '1rem',
              textAlign: 'left',
            }}
          >
            {unlockedRewards.map((reward, idx) => (
              <div key={idx} style={{ marginBottom: idx < unlockedRewards.length - 1 ? '0.75rem' : 0 }}>
                <p style={{ margin: 0, color: textColor }}>{reward.reward_description}</p>
                {reward.reward_code && (
                  <p style={{ fontFamily: 'monospace', fontWeight: '700', margin: '0.25rem 0 0 0', color: textColor }}>
                    Code: {reward.reward_code}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default CompletionCard;
