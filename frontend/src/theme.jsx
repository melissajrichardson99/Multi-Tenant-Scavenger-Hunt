import React, { createContext, useContext, useState, useCallback } from 'react';

const ACTIVE_ORG_KEY = 'active_org';
const OrgThemeContext = createContext(null);

function readStoredOrg() {
  try {
    const raw = localStorage.getItem(ACTIVE_ORG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Wraps the guest-facing hunt pages only (never the admin route), so CSS
// variable overrides for an organization's theme are scoped to this
// subtree via inline style + className rather than the document root —
// that's what keeps them from leaking into the separately-rendered admin
// layout during client-side navigation.
export function OrgThemeProvider({ children }) {
  const [activeOrg, setActiveOrgState] = useState(readStoredOrg);

  const setActiveOrg = useCallback((org) => {
    localStorage.setItem(ACTIVE_ORG_KEY, JSON.stringify(org));
    setActiveOrgState(org);
  }, []);

  const clearActiveOrg = useCallback(() => {
    localStorage.removeItem(ACTIVE_ORG_KEY);
    setActiveOrgState(null);
  }, []);

  const style = {};
  if (activeOrg?.theme_primary) style['--primary-color'] = activeOrg.theme_primary;
  if (activeOrg?.theme_secondary) style['--secondary-color'] = activeOrg.theme_secondary;

  // org-themed only applies once an org's branding is actually active, so the
  // primary-driven page background (see index.css) never bleeds into
  // HuntSelector or other org-less states, which must stay on the generic
  // default background.
  const themeClasses = ['app-container'];
  if (activeOrg) themeClasses.push('org-themed');
  if (activeOrg?.theme_mode === 'light') themeClasses.push('theme-light');

  return (
    <OrgThemeContext.Provider value={{ activeOrg, setActiveOrg, clearActiveOrg }}>
      <div className={themeClasses.join(' ')} style={style}>
        {children}
      </div>
    </OrgThemeContext.Provider>
  );
}

export function useOrgTheme() {
  const ctx = useContext(OrgThemeContext);
  if (!ctx) {
    throw new Error('useOrgTheme must be used within an OrgThemeProvider');
  }
  return ctx;
}
