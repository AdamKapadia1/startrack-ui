export interface Satellite {
  satname: string;
  elevation: number;
  azimuth: number;
  range: number;
}

export interface ApiResponse {
  location: { name: string; lat: number; lon: number };
  count: number;
  satellites: Satellite[];
}
