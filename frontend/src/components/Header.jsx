import React from 'react';
import { Link } from 'react-router-dom';
import { useOrgTheme } from '../theme';

export default function Header() {
  const { activeOrg } = useOrgTheme();

  const homeLink = activeOrg?.slug ? `/start/${activeOrg.slug}` : '/';

  return (
    <header>
      <Link to={homeLink}>
        {activeOrg ? (
          activeOrg.logo_url ? (
            <img src={activeOrg.logo_url} alt={`${activeOrg.name} logo`} className="logo" />
          ) : (
            <h1>{activeOrg.name}</h1>
          )
        ) : (
          <h1>Scavenger Hunt</h1>
        )}
      </Link>
    </header>
  );
}
