export interface SatellitePosition {
  satname:         string;
  elevation:       number;
  azimuth:         number;
  range:           number;
  dopplerShiftKHz: number | null;
}

export interface Satellite {
  satname:         string;
  elevation:       number;
  azimuth:         number;
  range:           number;
  dopplerShiftHz:  number | null;
  dopplerShiftKHz: number | null;
}

export interface ScoreBreakdown {
  elevation:  number;
  cloud:      number;
  visibility: number;
  wind:       number;
  range:      number;
}

export interface ApiResponse {
  location:       { name: string; lat: number; lon: number };
  count:          number;
  satellites:     Satellite[];
  signalScore?:   number;
  scoreBreakdown?: ScoreBreakdown;
}
