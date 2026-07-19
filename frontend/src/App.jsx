import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import HuntSelector from './pages/HuntSelector';
import Start from './pages/Start';
import Scan from './pages/Scan';
import Progress from './pages/Progress';
import CharacterReveal from './pages/CharacterReveal';
import TriviaQuestion from './pages/TriviaQuestion';
import Reward from './pages/Reward';
import Admin from './pages/Admin';
import Header from './components/Header';
import Footer from './components/Footer';
import { OrgThemeProvider } from './theme';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin layout is separate and wider, and intentionally never wrapped in
            OrgThemeProvider — its styling stays generic regardless of which hunt
            is selected in its dropdown. */}
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
            <OrgThemeProvider>
              <Header />

              <main>
                <Routes>
                  <Route path="/" element={<HuntSelector />} />
                  <Route path="/start/:orgSlug" element={<Start />} />
                  <Route path="/scan" element={<Scan />} />
                  <Route path="/progress" element={<Progress />} />
                  <Route path="/reveal/:characterId" element={<CharacterReveal />} />
                  <Route path="/trivia/:characterId" element={<TriviaQuestion />} />
                  <Route path="/reward" element={<Reward />} />
                  {/* Fallback to the hunt selector */}
                  <Route path="*" element={<HuntSelector />} />
                </Routes>
              </main>

              <Footer />
            </OrgThemeProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
