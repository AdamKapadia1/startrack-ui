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
import { HistoricalInsight }   from './components/HistoricalInsight';
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
import { getConstellation }     from './utils/constellation';
import type { Satellite }       from './types';
import { useSatellites }     from './hooks/useSatellites';
import { useRecommendation } from './hooks/useRecommendation';
import { useWeather }        from './hooks/useWeather';
import { useLocation }       from './hooks/useLocation';

function App() {
  const isPassRoute = window.location.pathname === '/pass';
  const { location, saveLocation, gpsAccuracy, permState, requestGPS, declineGPS } = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [settingsOpen,         setSettingsOpen]         = useState(false);
  const [chatOpen,             setChatOpen]             = useState(false);

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
  const [helpOpen,             setHelpOpen]             = useState(false);
  const [changelogOpen,        setChangelogOpen]        = useState(false);
  const [activeConstellation,  setActiveConstellation]  = useState('ALL');
  const [selectedSatellite,    setSelectedSatellite]    = useState<Satellite | null>(null);
  const [onboarded,            setOnboarded]            = useState(() => !!localStorage.getItem(ONBOARDING_KEY));

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

  return (
    <div className="app">
      <Header
        location={location}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onToggleTheme={toggleTheme}
        theme={theme}
        wsStatus={status}
        lastUpdated={lastUpdated}
        gpsAccuracy={gpsAccuracy}
        topPasses={topPasses}
      />

      <CountdownBanner passes={topPasses} />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        location={location}
        onSave={saveLocation}
      />

      <LocationPermission permState={permState} onAllow={requestGPS} onDecline={declineGPS} />

      <div className="dashboard">
        {/* ── Left column ── */}
        <div className="left-col">
          <div className="section-label">Live Overview</div>

          <MetricCards satellites={filteredSatellites} topPasses={topPasses} activeConstellation={activeConstellation} loading={!satData} />

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

          <SatelliteList satellites={filteredSatellites} onSelectSatellite={setSelectedSatellite} loading={!satData} />
        </div>

        {/* ── Right column ── */}
        <div className="right-col">
          <div className="section-label sky-header">
            <span>Sky Map{weather?.cloudCover != null ? ` · ☁ ${weather.cloudCover}%` : ' — Azimuth / Elevation'}</span>
            <ConstellationFilter
              satellites={satellites}
              active={activeConstellation}
              onChange={setActiveConstellation}
            />
          </div>

          <SkyMap
            satellites={satellites}
            cloudCover={weather?.cloudCover}
            passes={topPasses}
            positions={positions}
            posLastUpdate={posLastUpdate}
            activeConstellation={activeConstellation}
            loading={!satData}
          />

          <div className="passes-section">
            <div className="section-label">Upcoming Passes — Next 7 Days</div>
            <PassList passes={topPasses} satname={satname} locationName={location.name} loading={recLoading} />
          </div>

          <SignalHistory signalScore={signalScore} />
          <HistoricalInsight />
        </div>
      </div>

      <Footer lastUpdated={lastUpdated} onOpenChangelog={() => setChangelogOpen(true)} />
      <InstallBanner />

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} context={liveContext} />

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ChangelogPanel open={changelogOpen} onClose={() => setChangelogOpen(false)} />

      {!onboarded && (
        <Onboarding
          onComplete={loc => {
            saveLocation(loc);
            setOnboarded(true);
          }}
        />
      )}

      <SatelliteDetail
        satellite={selectedSatellite}
        allSatellites={satellites}
        positions={positions}
        location={location}
        onClose={() => setSelectedSatellite(null)}
      />

      <button
        className={`chat-bubble-btn${chatOpen ? ' open' : ''}`}
        onClick={() => setChatOpen(o => !o)}
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
