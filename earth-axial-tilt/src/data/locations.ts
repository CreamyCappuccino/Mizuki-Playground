export interface LocationPreset {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export const LOCATIONS: LocationPreset[] = [
  { id: 'taipei', name: 'Taipei', latitude: 25.033, longitude: 121.5654 },
  { id: 'tokyo', name: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
  { id: 'singapore', name: 'Singapore', latitude: 1.3521, longitude: 103.8198 },
  { id: 'london', name: 'London', latitude: 51.5074, longitude: -0.1278 },
  { id: 'new-york', name: 'New York', latitude: 40.7128, longitude: -74.006 },
  { id: 'reykjavik', name: 'Reykjavík', latitude: 64.1466, longitude: -21.9426 },
  { id: 'tromso', name: 'Tromsø', latitude: 69.6492, longitude: 18.9553 },
  { id: 'north-pole', name: 'North Pole', latitude: 90, longitude: 0 },
  { id: 'geography-land', name: 'North Asia · 45°N 105°E cell', latitude: 45, longitude: 105 },
  { id: 'geography-ocean', name: 'North Pacific · 45°N 135°W cell', latitude: 45, longitude: -135 },
];

export const DEFAULT_LOCATION = LOCATIONS[0];
