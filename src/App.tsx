import { useState, useEffect } from 'react';
import { Header }               from './components/Header';
import { InstallBanner }        from './components/InstallBanner';
import { MetricCards }          from './components/MetricCards';
import { ConnectivityGauge }    from './components/ConnectivityGauge';
import { AIRecommendation }     from './components/AIRecommendation';
import { DtcCard }              from './components/DtcCard';
import { SkyMap }               from './components/SkyMap';
import { ConstellationFilter }  from './components/ConstellationFilter';
import { PassList }             from './components/PassList';
import { SatelliteList }        from './components/SatelliteList';
import { SignalHistory }        from './components/SignalHistory';
import { HistoricalInsight }    from './components/HistoricalInsight';
import { Footer }               from './components/Footer';
import { SettingsPanel }        from './components/SettingsPanel';
import { ChatPanel }            from './components/ChatPanel';
import { LocationPermission }   from './components/LocationPermission';
import { CountdownBanner }      from './components/CountdownBanner';
import { SatelliteDetail }      from './components/SatelliteDetail';
import { Onboarding, ONBOARDING_KEY } from './components/Onboarding';
import { HelpPanel }            from './components/HelpPanel';
import { PassLandingPage }      from './components/PassLandingPage';
import { ChangelogPanel }       from './components/ChangelogPanel';
import { useTheme }             from './hooks/useTheme';
import { useAuth }              from './hooks/useAuth';
import { useProfile }           from './hooks/useProfile';
import type { SavedLocation }   from './hooks/useProfile';
import { AuthModal }            from './components/AuthModal';
import { ProfilePage }          from './components/ProfilePage';
import { getConstellation }     from './utils/constellation';
import { loadHorizonSettings, saveHorizonSettings } from './utils/horizonProfile';
import type { HorizonSettings } from './utils/horizonProfile';
import type { Satellite }       from './types';
import { useSatellites }        from './hooks/useSatellites';
import { useRecommendation }    from './hooks/useRecommendation';
import { useWeather }           from './hooks/useWeather';
import { useLocation }          from './hooks/useLocation';

// ── Tab definition ────────────────────────────────────────────────────────────

type Tab = 'overview' | 'skymap' | 'passes' | 'insights';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',  label: 'Overview' },
  { id: 'skymap',    label: 'Sky Map'  },
  { id: 'passes',    label: 'Passes'   },
  { id: 'insights',  label: 'Insights' },
];
const TAB_KEY = 'startrack-active-tab';

function readStoredTab(): Tab {
  const v = localStorage.getItem(TAB_KEY) as Tab | null;
  return v && TABS.some(t => t.id === v) ? v : 'overview';
}

// ── AI chat insight prompts (Insights tab) ────────────────────────────────────

const CHAT_INSIGHTS = [
  "When's my best connectivity window today?",
  "Why is my signal strongest late at night?",
  "What pattern do you see in my signal data this week?",
];

function App() {
  const isPassRoute = window.location.pathname === '/pass';
  const { location, saveLocation, gpsAccuracy, permState, requestGPS, declineGPS } = useLocation();
  const { theme, toggleTheme }                  = useTheme();
  const { user, signOut }                       = useAuth();
  const { locations: savedLocations, addLocation } = useProfile(user?.id);

  const [authOpen,            setAuthOpen]            = useState(false);
  const [historyOpen,         setHistoryOpen]         = useState(false);
  const [settingsOpen,        setSettingsOpen]        = useState(false);
  const [chatOpen,            setChatOpen]            = useState(false);
  const [chatInitialInput,    setChatInitialInput]    = useState('');
  const [helpOpen,            setHelpOpen]            = useState(false);
  const [changelogOpen,       setChangelogOpen]       = useState(false);
  const [activeConstellation, setActiveConstellation] = useState('ALL');
  const [selectedSatellite,   setSelectedSatellite]   = useState<Satellite | null>(null);
  const [onboarded,           setOnboarded]           = useState(() => !!localStorage.getItem(ONBOARDING_KEY));
  const [activeTab,           setActiveTab]           = useState<Tab>(readStoredTab);
  const [horizonSettings,     setHorizonSettings]     = useState<HorizonSettings>(loadHorizonSettings);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    localStorage.setItem(TAB_KEY, tab);
  }

  function updateHorizonSettings(settings: HorizonSettings) {
    setHorizonSettings(settings);
    saveHorizonSettings(settings);
  }

  function switchToLocation(loc: SavedLocation) {
    saveLocation({ name: loc.label, lat: loc.lat, lon: loc.lon, alt: loc.alt });
  }

  async function saveLocationToProfile(label: string, loc: { name: string; lat: number; lon: number; alt: number }) {
    await addLocation({ label, name: loc.name, lat: loc.lat, lon: loc.lon, alt: loc.alt });
  }

  function openChatWithQuestion(q: string) {
    setChatInitialInput(q);
    setChatOpen(true);
  }

  // Cmd+K / Ctrl+K toggles chat
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setChatOpen(o => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { data: satData, lastUpdated, status, positions, posLastUpdate } = useSatellites(location);
  const { data: recData, loading: recLoading }  = useRecommendation(location);
  const { data: weather }                       = useWeather(location);

  const satellites     = satData?.satellites    ?? [];
  const topPasses      = recData?.topPasses     ?? [];
  const satname        = recData?.satname       ?? 'Starlink';
  const signalScore    = satData?.signalScore;
  const scoreBreakdown = satData?.scoreBreakdown;
  const starlinkSat    = satellites.find(s => s.satname.toUpperCase().includes('STARLINK'));
  const topSat         = satellites.reduce<Satellite | null>((best, s) => !best || s.elevation > best.elevation ? s : best, null);

  const filteredSatellites = activeConstellation === 'ALL'
    ? satellites
    : satellites.filter(s => getConstellation(s.satname) === activeConstellation);

  if (isPassRoute) return <PassLandingPage />;

  const liveContext = {
    satelliteCount:   filteredSatellites.length,
    bestElevation:    Math.round(topSat?.elevation ?? 0),
    signalScore:      Math.round(signalScore ?? 0),
    cloudCover:       weather?.cloudCover,
    temp:             weather?.temp,
    topSatName:       topSat?.satname,
    topSatElevation:  topSat ? Math.round(topSat.elevation) : undefined,
    hasDtcSat:        !!starlinkSat,
  };

  // Shared sky map header (used in overview + skymap tabs)
  const skyMapHeader = (
    <div className="section-label sky-header">
      <span>Sky Map{weather?.cloudCover != null ? ` · ☁ ${weather.cloudCover}%` : ': Azimuth / Elevation'}</span>
      <ConstellationFilter
        satellites={satellites}
        active={activeConstellation}
        onChange={setActiveConstellation}
      />
    </div>
  );

  return (
    <div className="app">
      <Header
        location={location}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onToggleTheme={toggleTheme}
        onOpenAuth={() => setAuthOpen(true)}
        onSignOut={signOut}
        onOpenHistory={() => setHistoryOpen(true)}
        theme={theme}
        wsStatus={status}
        lastUpdated={lastUpdated}
        gpsAccuracy={gpsAccuracy}
        topPasses={topPasses}
        user={user}
        savedLocations={savedLocations}
        onSwitchLocation={switchToLocation}
        onManageLocations={() => setSettingsOpen(true)}
      />

      <CountdownBanner passes={topPasses} />

      {/* ── Tab bar ── */}
      <nav className="tab-bar" aria-label="Main navigation">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn${activeTab === t.id ? ' tab-btn--active' : ''}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Tab content ── */}
      <div className="tab-content">

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="tab-pane tab-overview">
            <div className="section-label">Live Overview</div>
            <MetricCards
              satellites={filteredSatellites}
              topPasses={topPasses}
              activeConstellation={activeConstellation}
              loading={!satData}
            />
            <ConnectivityGauge
              satellites={satellites}
              lastUpdated={lastUpdated}
              signalScore={signalScore}
              scoreBreakdown={scoreBreakdown}
            />
            <AIRecommendation
              recommendation={recData?.recommendation ?? ''}
              loading={recLoading}
            />
            {starlinkSat && <DtcCard satellite={starlinkSat} />}

            {/* Compact sky map in overview */}
            {skyMapHeader}
            <SkyMap
              satellites={satellites}
              cloudCover={weather?.cloudCover}
              passes={topPasses}
              positions={positions}
              posLastUpdate={posLastUpdate}
              activeConstellation={activeConstellation}
              loading={!satData}
              compact={true}
              horizonSettings={horizonSettings}
            />
            <button
              className="tab-skymap-link"
              onClick={() => switchTab('skymap')}
            >
              View full sky map →
            </button>
          </div>
        )}

        {/* ── SKY MAP ── */}
        {activeTab === 'skymap' && (
          <div className="tab-pane tab-skymap">
            {skyMapHeader}
            <SkyMap
              satellites={satellites}
              cloudCover={weather?.cloudCover}
              passes={topPasses}
              positions={positions}
              posLastUpdate={posLastUpdate}
              activeConstellation={activeConstellation}
              loading={!satData}
              compact={false}
              horizonSettings={horizonSettings}
            />
            <SatelliteList
              satellites={filteredSatellites}
              onSelectSatellite={setSelectedSatellite}
              loading={!satData}
              fullHeight={true}
            />
          </div>
        )}

        {/* ── PASSES ── */}
        {activeTab === 'passes' && (
          <div className="tab-pane tab-passes">
            <div className="section-label">Upcoming Passes: Next 7 Days</div>
            <PassList
              passes={topPasses}
              satname={satname}
              locationName={location.name}
              loading={recLoading}
            />
          </div>
        )}

        {/* ── INSIGHTS ── */}
        {activeTab === 'insights' && (
          <div className="tab-pane tab-insights">
            {/* AI Chat Insights */}
            <div className="insight-chat-section">
              <div className="section-label">AI Chat Insights</div>
              <div className="insight-prompt-chips">
                {CHAT_INSIGHTS.map(q => (
                  <button
                    key={q}
                    className="insight-prompt-chip"
                    onClick={() => openChatWithQuestion(q)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Signal history — wider, taller */}
            <div className="insights-signal-wrap">
              <SignalHistory signalScore={signalScore} />
            </div>

            {/* Pattern insight — full width */}
            <HistoricalInsight />
          </div>
        )}
      </div>

      {/* ── Always-visible globals ── */}
      <Footer lastUpdated={lastUpdated} onOpenChangelog={() => setChangelogOpen(true)} />
      <InstallBanner />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        location={location}
        onSave={saveLocation}
        horizonSettings={horizonSettings}
        onSaveHorizon={updateHorizonSettings}
        isLoggedIn={!!user}
        onSaveToProfile={saveLocationToProfile}
      />

      <LocationPermission permState={permState} onAllow={requestGPS} onDecline={declineGPS} />

      <ChatPanel
        open={chatOpen}
        onClose={() => { setChatOpen(false); setChatInitialInput(''); }}
        context={liveContext}
        initialInput={chatInitialInput}
      />

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ChangelogPanel open={changelogOpen} onClose={() => setChangelogOpen(false)} />

      {!onboarded && (
        <Onboarding
          onComplete={loc => {
            saveLocation(loc);
            setOnboarded(true);
          }}
          onAutoSave={user ? loc => addLocation({ label: 'Home', name: loc.name, lat: loc.lat, lon: loc.lon, alt: loc.alt }) : undefined}
        />
      )}

      <SatelliteDetail
        satellite={selectedSatellite}
        allSatellites={satellites}
        positions={positions}
        location={location}
        horizonSettings={horizonSettings}
        onClose={() => setSelectedSatellite(null)}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <ProfilePage open={historyOpen} onClose={() => setHistoryOpen(false)} />

      <button
        className={`chat-bubble-btn${chatOpen ? ' open' : ''}`}
        onClick={() => { setChatInitialInput(''); setChatOpen(o => !o); }}
        aria-label={chatOpen ? 'Close AI chat' : 'Open AI chat'}
      >
        {chatOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="chat-bubble-badge">AI</span>
          </>
        )}
      </button>
    </div>
  );
}

export default App;
