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

export interface BathymetryResponse {
  units: string;
  lat: number[];
  lon: number[];
  values: (number | null)[][];
  min: number;
  max: number;
}

export interface TrajectoryPoint {
  t: number;
  lat: number;
  lon: number;
}

export interface FloatMeta {
  id: string;
  lat: number;
  lon: number;
  trajectory?: TrajectoryPoint[];
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

export interface MetricSummary {
  rmse: number;
  bias: number;
  n: number;
}

export interface FloatMetricRow {
  id: string;
  lat: number;
  lon: number;
  rmse_t: number | null;
  bias_t: number | null;
  n_t: number;
  rmse_s: number | null;
  bias_s: number | null;
  n_s: number;
  anomaly_score: number;
  anomaly: boolean;
}

export interface LevelDelta {
  depth: number;
  obs_t: number | null;
  mod_t: number | null;
  d_t: number | null;
  obs_s: number | null;
  mod_s: number | null;
  d_s: number | null;
}

export interface FloatMetricDetail extends FloatMetricRow {
  levels: LevelDelta[];
}

export interface AnomaliesResponse {
  method: string;
  threshold: number;
  count: number;
  anomalies: {
    id: string;
    lat: number;
    lon: number;
    anomaly_score: number;
    rmse_t: number | null;
    bias_t: number | null;
    n_t: number;
  }[];
}

export interface GliderMeta {
  id: string;
  name: string;
  max_depth?: number;
  lat: number;
  lon: number;
  track: TrajectoryPoint[];
}

export interface GliderStation {
  t: number;
  lat: number;
  lon: number;
  profile: ProfilePoint[];
  model_profile: ProfilePoint[];
}

export interface GliderDetail extends GliderMeta {
  stations: GliderStation[];
}

export interface AssimilateRequest {
  variable: string;
  depth: number;
  time_index: number;
  radius_cells?: number;
}

export interface AssimilateResponse {
  variable: string;
  depth: number;
  time: string;
  method: string;
  radius_cells: number;
  obs_level: number;
  n_analysis: number;
  n_validation: number;
  before: MetricSummary;
  after: MetricSummary;
  validation_before: MetricSummary;
  validation_after: MetricSummary;
  reduction_rmse_pct: number | null;
  reduction_bias_pct: number | null;
  lat: number[];
  lon: number[];
  values: (number | null)[][];
  min: number;
  max: number;
}

export function toFieldResponse(resp: AssimilateResponse) {
  return {
    variable: resp.variable,
    depth: resp.depth,
    time: resp.time,
    lat: resp.lat,
    lon: resp.lon,
    values: resp.values,
    min: resp.min,
    max: resp.max,
  };
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

export interface UserVariableInfo {
  name: string;
  long_name: string;
  standard_name: string;
  units: string;
  ndim: number;
  shape: number[];
  dims: string[];
  has_lat_lon: boolean;
}

export interface UserDatasetInfo {
  index: number;
  name: string;
  source: "netcdf" | "csv";
  variables: UserVariableInfo[];
  meta: MetaResponse;
}
