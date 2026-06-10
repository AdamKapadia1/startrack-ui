import { Header }             from './components/Header';
import { MetricCards }        from './components/MetricCards';
import { ConnectivityGauge }  from './components/ConnectivityGauge';
import { AIRecommendation }   from './components/AIRecommendation';
import { SkyMap }             from './components/SkyMap';
import { PassList }           from './components/PassList';
import { Footer }             from './components/Footer';
import { useSatellites }      from './hooks/useSatellites';
import { useRecommendation }  from './hooks/useRecommendation';

function App() {
  const { data: satData, lastUpdated } = useSatellites();
  const { data: recData, loading: recLoading } = useRecommendation();

  const satellites = satData?.satellites ?? [];
  const topPasses  = recData?.topPasses  ?? [];
  const satname    = recData?.satname    ?? 'ISS';

  return (
    <div className="app">
      <Header />

      <div className="dashboard">
        {/* ── Left column ── */}
        <div className="left-col">
          <div className="section-label">Live Overview</div>

          <MetricCards satellites={satellites} topPasses={topPasses} />

          <ConnectivityGauge satellites={satellites} lastUpdated={lastUpdated} />

          <AIRecommendation
            recommendation={recData?.recommendation ?? ''}
            satellites={satellites}
            loading={recLoading}
          />
        </div>

        {/* ── Right column ── */}
        <div className="right-col">
          <div className="section-label">Sky Map — Azimuth / Elevation</div>

          <SkyMap satellites={satellites} />

          <div className="passes-section">
            <div className="section-label">Upcoming Passes — Next 2 Hours</div>
            <PassList passes={topPasses} satname={satname} />
          </div>
        </div>
      </div>

      <Footer lastUpdated={lastUpdated} />
    </div>
  );
}

export default App;
