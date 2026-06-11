import { Header }            from './components/Header';
import { MetricCards }       from './components/MetricCards';
import { ConnectivityGauge } from './components/ConnectivityGauge';
import { AIRecommendation }  from './components/AIRecommendation';
import { SkyMap }            from './components/SkyMap';
import { PassList }          from './components/PassList';
import { SatelliteList }     from './components/SatelliteList';
import { SignalHistory }     from './components/SignalHistory';
import { Footer }            from './components/Footer';
import { useSatellites }     from './hooks/useSatellites';
import { useRecommendation } from './hooks/useRecommendation';
import { useWeather }        from './hooks/useWeather';

function App() {
  const { data: satData, lastUpdated } = useSatellites();
  const { data: recData, loading: recLoading } = useRecommendation();
  const { data: weather } = useWeather();

  const satellites    = satData?.satellites    ?? [];
  const topPasses     = recData?.topPasses     ?? [];
  const satname       = recData?.satname       ?? 'Starlink';
  const signalScore   = satData?.signalScore;
  const scoreBreakdown = satData?.scoreBreakdown;

  return (
    <div className="app">
      <Header />

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

          <SkyMap satellites={satellites} cloudCover={weather?.cloudCover} />

          <div className="passes-section">
            <div className="section-label">Upcoming Passes — Next 7 Days</div>
            <PassList passes={topPasses} satname={satname} />
          </div>

          <SignalHistory />
        </div>
      </div>

      <Footer lastUpdated={lastUpdated} />
    </div>
  );
}

export default App;
