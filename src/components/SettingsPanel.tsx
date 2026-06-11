import { useState, useEffect } from 'react';
import type { LocationSettings } from '../hooks/useLocation';
import { DEFAULT_LOCATION } from '../hooks/useLocation';

interface Props {
  open:     boolean;
  onClose:  () => void;
  location: LocationSettings;
  onSave:   (loc: LocationSettings) => void;
}

export function SettingsPanel({ open, onClose, location, onSave }: Props) {
  const [form, setForm] = useState<LocationSettings>(location);
  const [geoError, setGeoError] = useState('');

  useEffect(() => {
    if (open) { setForm(location); setGeoError(''); }
  }, [open]);

  function set(field: keyof LocationSettings, value: string | number) {
    setForm(f => ({ ...f, [field]: value }));
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
      },
      () => setGeoError('Location access denied'),
    );
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

          <button className="settings-geo-btn" onClick={handleGeolocate}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>
            </svg>
            Use my current location
          </button>
          {geoError && <div className="settings-error">{geoError}</div>}
        </div>

        <div className="settings-footer">
          <button className="settings-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="settings-btn-save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </>
  );
}
