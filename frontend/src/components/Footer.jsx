import React from 'react';
import { useOrgTheme } from '../theme';

export default function Footer() {
  const { activeOrg } = useOrgTheme();

  return (
    <footer>
      <div>{activeOrg ? `© 2026 ${activeOrg.name}` : '© 2026 Scavenger Hunt Platform'}</div>
      <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>
        Multi-tenant Scavenger Hunt System
      </div>
    </footer>
  );
}
