import { useState } from 'react';
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
import { Footer }               from './components/Footer';
import { SettingsPanel }        from './components/SettingsPanel';
import { ChatPanel }            from './components/ChatPanel';
import { LocationPermission }   from './components/LocationPermission';
import { CountdownBanner }      from './components/CountdownBanner';
import { getConstellation }     from './utils/constellation';
import { useSatellites }     from './hooks/useSatellites';
import { useRecommendation } from './hooks/useRecommendation';
import { useWeather }        from './hooks/useWeather';
import { useLocation }       from './hooks/useLocation';

function App() {
  const { location, saveLocation, gpsAccuracy, permState, requestGPS, declineGPS } = useLocation();
  const [settingsOpen,         setSettingsOpen]         = useState(false);
  const [chatOpen,             setChatOpen]             = useState(false);
  const [activeConstellation,  setActiveConstellation]  = useState('ALL');

  const { data: satData, lastUpdated, status, positions, posLastUpdate } = useSatellites(location);
  const { data: recData, loading: recLoading }  = useRecommendation(location);
  const { data: weather }                       = useWeather(location);

  const satellites     = satData?.satellites    ?? [];
  const topPasses      = recData?.topPasses     ?? [];
  const satname        = recData?.satname       ?? 'Starlink';
  const signalScore    = satData?.signalScore;
  const scoreBreakdown = satData?.scoreBreakdown;
  const starlinkSat    = satellites.find(s => s.satname.toUpperCase().includes('STARLINK'));

  const filteredSatellites = activeConstellation === 'ALL'
    ? satellites
    : satellites.filter(s => getConstellation(s.satname) === activeConstellation);

  return (
    <div className="app">
      <Header
        location={location}
        onOpenSettings={() => setSettingsOpen(true)}
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

          <MetricCards satellites={filteredSatellites} topPasses={topPasses} activeConstellation={activeConstellation} />

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

          <SatelliteList satellites={filteredSatellites} />
        </div>

        {/* ── Right column ── */}
        <div className="right-col">
          <div className="section-label">Sky Map — Azimuth / Elevation</div>

          <ConstellationFilter
            satellites={satellites}
            active={activeConstellation}
            onChange={setActiveConstellation}
          />

          <SkyMap
            satellites={satellites}
            cloudCover={weather?.cloudCover}
            passes={topPasses}
            positions={positions}
            posLastUpdate={posLastUpdate}
            activeConstellation={activeConstellation}
          />

          <div className="passes-section">
            <div className="section-label">Upcoming Passes — Next 7 Days</div>
            <PassList passes={topPasses} satname={satname} locationName={location.name} />
          </div>

          <SignalHistory />
        </div>
      </div>

      <Footer lastUpdated={lastUpdated} />
      <InstallBanner />

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />

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
