import { useState, useEffect, useRef } from 'react';
import type { LocationSettings } from '../hooks/useLocation';
import { DEFAULT_LOCATION } from '../hooks/useLocation';
import { HORIZON_PRESET_INFO, COMPASS_DIRECTIONS } from '../utils/horizonProfile';
import type { HorizonSettings, HorizonPresetKey } from '../utils/horizonProfile';

interface Props {
  open:            boolean;
  onClose:         () => void;
  location:        LocationSettings;
  onSave:          (loc: LocationSettings) => void;
  horizonSettings: HorizonSettings;
  onSaveHorizon:   (settings: HorizonSettings) => void;
}

const HORIZON_PRESET_ORDER: HorizonPresetKey[] = ['flat', 'suburban', 'urban', 'valley', 'custom'];

interface NominatimResult {
  display_name: string;
  lat:          string;
  lon:          string;
  address?: {
    country?: string;
    state?:   string;
    county?:  string;
    city?:    string;
    town?:    string;
  };
}

const POPULAR = [
  { name: 'London',     lat: 51.5074, lon: -0.1278 },
  { name: 'Manchester', lat: 53.4808, lon: -2.2426 },
  { name: 'Birmingham', lat: 52.4862, lon: -1.8904 },
  { name: 'Edinburgh',  lat: 55.9533, lon: -3.1883 },
  { name: 'Cardiff',    lat: 51.4816, lon: -3.1791 },
  { name: 'Belfast',    lat: 54.5973, lon: -5.9301 },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function shortDisplayName(displayName: string): string {
  return displayName.split(',').map(p => p.trim()).slice(0, 2).join(', ');
}

function regionText(r: NominatimResult): string {
  const a = r.address;
  if (!a) return '';
  return [a.state ?? a.county, a.country].filter(Boolean).join(', ');
}

export function SettingsPanel({ open, onClose, location, onSave, horizonSettings, onSaveHorizon }: Props) {
  const [form,         setForm]         = useState<LocationSettings>(location);
  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState<NominatimResult[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [searchError,  setSearchError]  = useState('');
  const [confirmed,    setConfirmed]    = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [geoError,     setGeoError]     = useState('');
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setForm(location);
      setQuery('');
      setResults([]);
      setSearchError('');
      setConfirmed('');
      setGeoError('');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(field: keyof LocationSettings, value: string | number) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function showConfirm(msg: string) {
    setConfirmed(msg);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmed(''), 3000);
  }

  async function doSearch(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;
      const res  = await fetch(url, {
        headers: { 'User-Agent': 'StarTrackAI/1.0 (startrackv1-ui.vercel.app)' },
      });
      const data: NominatimResult[] = await res.json();
      setResults(data);
      if (data.length === 0) setSearchError('No results found. Try a different search');
    } catch {
      setSearchError('Search failed. Check your connection');
    } finally {
      setSearching(false);
    }
  }

  function selectResult(r: NominatimResult) {
    const name = shortDisplayName(r.display_name);
    setForm(f => ({
      ...f,
      name,
      lat: parseFloat(parseFloat(r.lat).toFixed(4)),
      lon: parseFloat(parseFloat(r.lon).toFixed(4)),
      alt: 0,
    }));
    setResults([]);
    setQuery('');
    showConfirm(`✓ Location set to ${name}`);
  }

  function selectPopular(loc: typeof POPULAR[0]) {
    setForm(f => ({ ...f, name: loc.name, lat: loc.lat, lon: loc.lon, alt: 0 }));
    setResults([]);
    setQuery('');
    showConfirm(`✓ Location set to ${loc.name}`);
  }

  function handleGeolocate() {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported'); return; }
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({
          ...f,
          lat: parseFloat(pos.coords.latitude.toFixed(4)),
          lon: parseFloat(pos.coords.longitude.toFixed(4)),
          alt: Math.round(pos.coords.altitude ?? f.alt),
        }));
        showConfirm('✓ GPS location acquired');
      },
      () => setGeoError('Location access denied'),
    );
  }

  function selectHorizonPreset(preset: HorizonPresetKey) {
    onSaveHorizon({ ...horizonSettings, preset });
  }

  function setCustomHorizon(index: number, value: number) {
    const custom = [...horizonSettings.custom];
    custom[index] = value;
    onSaveHorizon({ ...horizonSettings, preset: 'custom', custom });
  }

  function handleSave() {
    onSave({
      name: form.name.trim() || DEFAULT_LOCATION.name,
      lat:  Number(form.lat),
      lon:  Number(form.lon),
      alt:  Number(form.alt),
    });
    onClose();
  }

  const showPopular = !query && results.length === 0;

  return (
    <>
      {open && <div className="settings-overlay" onClick={onClose} />}
      <div className={`settings-panel${open ? ' open' : ''}`}>
        <div className="settings-hdr">
          <span className="settings-title">Location Settings</span>
          <button className="settings-close icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="settings-body">

          {/* ── Search ── */}
          <div className="settings-field">
            <label className="settings-label">Search location</label>
            <div className="loc-search-wrap">
              <svg className="loc-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="settings-input loc-search-input"
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setResults([]); setSearchError(''); }}
                onKeyDown={e => e.key === 'Enter' && doSearch(query)}
                placeholder="City, town or postcode..."
              />
              {query && (
                <button className="loc-clear-btn icon-btn" onClick={() => { setQuery(''); setResults([]); setSearchError(''); }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
              <button
                className="loc-search-btn"
                onClick={() => doSearch(query)}
                disabled={searching || !query.trim()}
              >
                {searching
                  ? <span className="loc-spinner"/>
                  : 'Search'}
              </button>
            </div>

            {/* Results dropdown */}
            {results.length > 0 && (
              <div className="loc-results">
                {results.map((r, i) => (
                  <button key={i} className="loc-result" onClick={() => selectResult(r)}>
                    <span className="loc-result-name">{shortDisplayName(r.display_name)}</span>
                    <span className="loc-result-meta">
                      {regionText(r)}
                      {regionText(r) && ' · '}
                      {haversineKm(form.lat, form.lon, parseFloat(r.lat), parseFloat(r.lon)).toLocaleString()} km away
                    </span>
                  </button>
                ))}
              </div>
            )}

            {searchError && <div className="settings-error">{searchError}</div>}
          </div>

          {/* ── Confirmation ── */}
          {confirmed && <div className="loc-confirmed">{confirmed}</div>}

          {/* ── Popular locations ── */}
          {showPopular && (
            <div className="settings-field">
              <label className="settings-label">Popular locations</label>
              <div className="loc-chips">
                {POPULAR.map(loc => (
                  <button key={loc.name} className="loc-chip" onClick={() => selectPopular(loc)}>
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── GPS ── */}
          <button className="settings-geo-btn" onClick={handleGeolocate}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Use GPS location
          </button>
          {geoError && <div className="settings-error">{geoError}</div>}

          {/* ── Advanced ── */}
          <button className="loc-advanced-toggle" onClick={() => setShowAdvanced(v => !v)}>
            Advanced: enter coordinates manually
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showAdvanced && (
            <>
              <div className="settings-field">
                <label className="settings-label">Location name</label>
                <input
                  className="settings-input"
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. London, UK"
                />
              </div>
              <div className="settings-row">
                <div className="settings-field">
                  <label className="settings-label">Latitude</label>
                  <input
                    className="settings-input"
                    type="number"
                    min={-90} max={90} step="0.0001"
                    value={form.lat}
                    onChange={e => set('lat', e.target.value)}
                  />
                </div>
                <div className="settings-field">
                  <label className="settings-label">Longitude</label>
                  <input
                    className="settings-input"
                    type="number"
                    min={-180} max={180} step="0.0001"
                    value={form.lon}
                    onChange={e => set('lon', e.target.value)}
                  />
                </div>
              </div>
              <div className="settings-field">
                <label className="settings-label">Altitude (metres)</label>
                <input
                  className="settings-input"
                  type="number"
                  min={0} step="1"
                  value={form.alt}
                  onChange={e => set('alt', e.target.value)}
                />
              </div>
            </>
          )}

          {/* ── Horizon Obstruction ── */}
          <div className="settings-field">
            <label className="settings-label">
              Horizon Obstruction
              <span
                className="orbital-tip"
                title="Trees, hills, and buildings can block satellites near the horizon. Setting this correctly gives more accurate pass timing for when a satellite actually becomes visible from your exact spot."
              >?</span>
            </label>
            <div className="horizon-radio-group">
              {HORIZON_PRESET_ORDER.map(key => {
                const info = HORIZON_PRESET_INFO[key];
                return (
                  <label key={key} className={`horizon-option${horizonSettings.preset === key ? ' horizon-option--active' : ''}`}>
                    <input
                      type="radio"
                      name="horizon-preset"
                      checked={horizonSettings.preset === key}
                      onChange={() => selectHorizonPreset(key)}
                    />
                    <span className="horizon-option-text">
                      <span className="horizon-option-label">{info.label}</span>
                      <span className="horizon-option-desc">{info.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {horizonSettings.preset === 'custom' && (
              <div className="horizon-custom-sliders">
                {COMPASS_DIRECTIONS.map((dir, i) => (
                  <div key={dir} className="horizon-slider-row">
                    <span className="horizon-slider-dir">{dir}</span>
                    <input
                      type="range"
                      min={0} max={30} step={1}
                      value={horizonSettings.custom[i]}
                      onChange={e => setCustomHorizon(i, Number(e.target.value))}
                    />
                    <span className="horizon-slider-val">{horizonSettings.custom[i]}°</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="settings-btn-save" onClick={handleSave}>Save & Update</button>
        </div>
      </div>
    </>
  );
}
