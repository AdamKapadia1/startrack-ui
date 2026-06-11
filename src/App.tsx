import { useState } from 'react';
import { Header }            from './components/Header';
import { InstallBanner }     from './components/InstallBanner';
import { MetricCards }       from './components/MetricCards';
import { ConnectivityGauge } from './components/ConnectivityGauge';
import { AIRecommendation }  from './components/AIRecommendation';
import { SkyMap }            from './components/SkyMap';
import { PassList }          from './components/PassList';
import { SatelliteList }     from './components/SatelliteList';
import { SignalHistory }     from './components/SignalHistory';
import { Footer }            from './components/Footer';
import { SettingsPanel }     from './components/SettingsPanel';
import { useSatellites }     from './hooks/useSatellites';
import { useRecommendation } from './hooks/useRecommendation';
import { useWeather }        from './hooks/useWeather';
import { useLocation }       from './hooks/useLocation';

function App() {
  const { location, saveLocation } = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: satData, lastUpdated } = useSatellites(location);
  const { data: recData, loading: recLoading } = useRecommendation(location);
  const { data: weather } = useWeather(location);

  const satellites     = satData?.satellites    ?? [];
  const topPasses      = recData?.topPasses     ?? [];
  const satname        = recData?.satname       ?? 'Starlink';
  const signalScore    = satData?.signalScore;
  const scoreBreakdown = satData?.scoreBreakdown;

  return (
    <div className="app">
      <Header location={location} onOpenSettings={() => setSettingsOpen(true)} />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        location={location}
        onSave={saveLocation}
      />

      <div className="dashboard">
        {/* ── Left column ── */}
        <div className="left-col">
          <div className="section-label">Live Overview</div>

          <MetricCards satellites={satellites} topPasses={topPasses} />

          <ConnectivityGauge
            satellites={satellites}
            lastUpdated={lastUpdated}
            signalScore={signalScore}
            scoreBreakdown={scoreBreakdown}
          />

          <AIRecommendation
            recommendation={recData?.recommendation ?? ''}
            satellites={satellites}
            loading={recLoading}
          />

          <SatelliteList satellites={satellites} />
        </div>

        {/* ── Right column ── */}
        <div className="right-col">
          <div className="section-label">Sky Map — Azimuth / Elevation</div>

          <SkyMap satellites={satellites} cloudCover={weather?.cloudCover} passes={topPasses} />

          <div className="passes-section">
            <div className="section-label">Upcoming Passes — Next 7 Days</div>
            <PassList passes={topPasses} satname={satname} locationName={location.name} />
          </div>

          <SignalHistory />
        </div>
      </div>

      <Footer lastUpdated={lastUpdated} />
      <InstallBanner />
    </div>
  );
}

export default App;
