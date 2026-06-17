import { useState, useEffect, useRef, useCallback } from 'react';
import { usePassHistory } from '../hooks/usePassHistory';
import type { PassHistoryEntry } from '../hooks/usePassHistory';

interface Props {
  open:    boolean;
  onClose: () => void;
}

const PAGE_SIZE = 50;

const EVENT_ICONS: Record<string, React.ReactNode> = {
  viewed: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  alerted: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  shared: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  calendar_export: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
};

const EVENT_COLORS: Record<string, string> = {
  viewed:          '#00d4ff',
  alerted:         '#ffb800',
  shared:          '#00ff88',
  calendar_export: '#7b61ff',
};

const EVENT_LABELS: Record<string, string> = {
  viewed:          'Viewed',
  alerted:         'Alerted',
  shared:          'Shared',
  calendar_export: 'Exported',
};

function qualityColor(quality: string | null): string {
  if (!quality) return '#4a6080';
  if (quality === 'Excellent') return '#00d4ff';
  if (quality === 'Good')      return '#00d4ff';
  if (quality === 'Fair')      return '#ffb800';
  return '#4a6080';
}

function dateBucket(passTime: string): string {
  const d     = new Date(passTime);
  const today = new Date();
  const yest  = new Date();
  yest.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yest))  return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByDate(entries: PassHistoryEntry[]): { bucket: string; rows: PassHistoryEntry[] }[] {
  const map = new Map<string, PassHistoryEntry[]>();
  for (const e of entries) {
    const b = dateBucket(e.pass_time);
    if (!map.has(b)) map.set(b, []);
    map.get(b)!.push(e);
  }
  return Array.from(map.entries()).map(([bucket, rows]) => ({ bucket, rows }));
}

function formatPassTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

function formatPassDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London',
  });
}

export function ProfilePage({ open, onClose }: Props) {
  const { history, loading, hasMore, fetchHistory } = usePassHistory();
  const [search,     setSearch]     = useState('');
  const [offset,     setOffset]     = useState(0);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((term: string, off: number) => {
    fetchHistory(term, PAGE_SIZE, off);
  }, [fetchHistory]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setOffset(0);
    load('', 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearch(val);
    setOffset(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(val, 0), 300);
  }

  function loadMore() {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    load(search, newOffset);
  }

  const groups = groupByDate(history);

  return (
    <>
      {open && <div className="settings-overlay" onClick={onClose} />}
      <div className={`profile-panel${open ? ' open' : ''}`}>
        <div className="settings-hdr">
          <span className="settings-title">Pass History</span>
          <button className="settings-close icon-btn" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="profile-search-wrap">
          <svg className="profile-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="profile-search-input"
            type="text"
            value={search}
            onChange={onSearchChange}
            placeholder="Search pass history…"
          />
          {search && (
            <button className="loc-clear-btn icon-btn" onClick={() => { setSearch(''); setOffset(0); load('', 0); }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div className="profile-body">
          {loading && history.length === 0 ? (
            <div className="profile-empty">Loading…</div>
          ) : history.length === 0 ? (
            <div className="profile-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4l3 3"/>
              </svg>
              <p>Your pass history will appear here as you use StarTrack</p>
            </div>
          ) : (
            <>
              {groups.map(({ bucket, rows }) => (
                <div key={bucket} className="profile-group">
                  <div className="profile-date-header">{bucket}</div>
                  {rows.map(entry => {
                    const color = EVENT_COLORS[entry.event_type] ?? '#4a6080';
                    return (
                      <div key={entry.id} className="profile-entry">
                        <div className="profile-entry-event" style={{ color }}>
                          {EVENT_ICONS[entry.event_type]}
                          <span className="profile-entry-event-label">{EVENT_LABELS[entry.event_type]}</span>
                        </div>
                        <div className="profile-entry-main">
                          <span className="profile-entry-name">{entry.satellite_name}</span>
                          <div className="profile-entry-meta">
                            <span className="profile-entry-time">
                              {formatPassDate(entry.pass_time)} · {formatPassTime(entry.pass_time)}
                            </span>
                            <span
                              className="profile-entry-el"
                              style={{ color: entry.max_elevation >= 60 ? '#00d4ff' : entry.max_elevation >= 30 ? '#ffb800' : '#4a6080' }}
                            >
                              {Math.round(entry.max_elevation)}°
                            </span>
                            {entry.quality && (
                              <span className="profile-entry-quality" style={{ color: qualityColor(entry.quality) }}>
                                {entry.quality}
                              </span>
                            )}
                            {entry.location_label && (
                              <span className="profile-entry-loc">{entry.location_label}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {hasMore && (
                <button className="profile-load-more" onClick={loadMore} disabled={loading}>
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
