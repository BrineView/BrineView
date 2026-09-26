import type {
  AnomaliesResponse,
  AssimilateRequest,
  AssimilateResponse,
  BathymetryResponse,
  FieldResponse,
  FloatDetail,
  FloatMeta,
  FloatMetricDetail,
  FloatMetricRow,
  GliderDetail,
  GliderMeta,
  MetaResponse,
  UserDatasetInfo,
} from "../types/ocean";

const BASE = "/api";
const TIMEOUT = 15000;

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(apiErrorMessage(res.status, body));
  }
  return res.json() as Promise<T>;
}



// Extract a human-readable message from an error response body
// (FastAPI uses `{ "detail": "..." }`).
function apiErrorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail) {
      return parsed.detail;
    }
  } catch {
    // not JSON — fall through to the generic message
  }
  return `API error ${status}`;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(apiErrorMessage(res.status, text));
  }
  return res.json() as Promise<T>;
}

export function getMeta(): Promise<MetaResponse> {
  return fetchJson<MetaResponse>(`${BASE}/meta`);
}

export function getField(params: {
  variable: string;
  depth: number;
  timeIndex: number;
}): Promise<FieldResponse> {
  const q = new URLSearchParams({
    variable: params.variable,
    depth: String(params.depth),
    time_index: String(params.timeIndex),
  });
  return fetchJson<FieldResponse>(`${BASE}/field?${q}`);
}

export function getFloats(): Promise<FloatMeta[]> {
  return fetchJson<FloatMeta[]>(`${BASE}/floats`);
}

export function getBathymetry(): Promise<BathymetryResponse> {
  return fetchJson<BathymetryResponse>(`${BASE}/bathymetry`);
}

export function getFloatDetail(id: string): Promise<FloatDetail> {
  return fetchJson<FloatDetail>(`${BASE}/floats/${encodeURIComponent(id)}`);
}

export function getFloatMetrics(): Promise<FloatMetricRow[]> {
  return fetchJson<FloatMetricRow[]>(`${BASE}/floats/metrics`);
}

export function getAnomalies(): Promise<AnomaliesResponse> {
  return fetchJson<AnomaliesResponse>(`${BASE}/floats/anomalies`);
}

export function getFloatMetricsById(id: string): Promise<FloatMetricDetail> {
  return fetchJson<FloatMetricDetail>(`${BASE}/floats/${encodeURIComponent(id)}/metrics`);
}

export function postAssimilate(req: AssimilateRequest): Promise<AssimilateResponse> {
  return postJson<AssimilateResponse>(`${BASE}/assimilate`, req);
}

export function getGliders(): Promise<GliderMeta[]> {
  return fetchJson<GliderMeta[]>(`${BASE}/gliders`);
}

export function getGliderDetail(id: string): Promise<GliderDetail> {
  return fetchJson<GliderDetail>(`${BASE}/gliders/${encodeURIComponent(id)}`);
}

export function listUserData(): Promise<UserDatasetInfo[]> {
  return fetchJson<UserDatasetInfo[]>(`${BASE}/user-data`);
}

export async function uploadUserData(file: File): Promise<UserDatasetInfo> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/user-data`, {
    method: "POST",
    body: fd,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(apiErrorMessage(res.status, body));
  }
  return res.json() as Promise<UserDatasetInfo>;
}

export function getUserDataField(params: {
  index: number;
  variable: string;
  depth?: number;
  timeIndex?: number;
}): Promise<FieldResponse> {
  const q = new URLSearchParams({
    variable: params.variable,
    depth: String(params.depth ?? 0),
    time_index: String(params.timeIndex ?? 0),
  });
  return fetchJson<FieldResponse>(`${BASE}/user-data/${params.index}/field?${q}`);
}

export async function deleteUserData(index: number): Promise<void> {
  const res = await fetch(`${BASE}/user-data/${index}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(apiErrorMessage(res.status, body));
  }
}
