export interface MetaResponse {
  depths: number[];
  times: string[];
  lat_range: [number, number];
  lon_range: [number, number];
}

export interface FieldResponse {
  variable: string;
  depth: number;
  time: string;
  lat: number[];
  lon: number[];
  values: (number | null)[][];
  min: number;
  max: number;
}

export interface FloatMeta {
  id: string;
  lat: number;
  lon: number;
}

export interface ProfilePoint {
  depth: number;
  temperature: number;
  salinity: number;
}

export interface FloatDetail extends FloatMeta {
  profile: ProfilePoint[];
  model_profile: ProfilePoint[];
}

export interface VariableInfo {
  name: string;
  label: string;
  unit: string;
  defaultColorscale: string;
}

export const VARIABLES: VariableInfo[] = [
  { name: "temperature", label: "Temperature", unit: "°C", defaultColorscale: "thermal" },
  { name: "salinity", label: "Salinity", unit: "PSU", defaultColorscale: "viridis" },
  { name: "u_current", label: "U Current", unit: "m/s", defaultColorscale: "rdbu" },
  { name: "v_current", label: "V Current", unit: "m/s", defaultColorscale: "rdbu" },
  { name: "chlorophyll", label: "Chlorophyll", unit: "mg/m³", defaultColorscale: "chlorophyll" },
];

export const VARIABLE_MAP = Object.fromEntries(VARIABLES.map((v) => [v.name, v])) as Record<string, VariableInfo>;
