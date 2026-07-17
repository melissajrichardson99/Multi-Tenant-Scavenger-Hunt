import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import HuntSelector from './pages/HuntSelector';
import Start from './pages/Start';
import Scan from './pages/Scan';
import Progress from './pages/Progress';
import CharacterReveal from './pages/CharacterReveal';
import Reward from './pages/Reward';
import Admin from './pages/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin layout is separate and wider, but gameplay is wrapped in mobile-first viewport */}
        <Route 
          path="/admin" 
          element={
            <div className="app-container admin-layout" style={{ padding: '2rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <Link to="/" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  ← Back to Public Game
                </Link>
              </div>
              <Admin />
            </div>
          } 
        />
        
        {/* Public Mobile-First Gameplay Layout */}
        <Route
          path="*"
          element={
            <div className="app-container">
              <header>
                <Link to="/">
                  <h1>Cobb's Hunt</h1>
                </Link>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <Link to="/progress" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Gallery
                  </Link>
                  <Link to="/admin" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Admin
                  </Link>
                </div>
              </header>

              <main>
                <Routes>
                  <Route path="/" element={<HuntSelector />} />
                  <Route path="/start/:orgSlug" element={<Start />} />
                  <Route path="/scan" element={<Scan />} />
                  <Route path="/progress" element={<Progress />} />
                  <Route path="/reveal/:characterId" element={<CharacterReveal />} />
                  <Route path="/reward" element={<Reward />} />
                  {/* Fallback to the hunt selector */}
                  <Route path="*" element={<HuntSelector />} />
                </Routes>
              </main>

              <footer>
                <div>© 2026 Cobb's Adventure Park</div>
                <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                  Multi-tenant Scavenger Hunt System
                </div>
              </footer>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
