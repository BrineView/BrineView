import type { FieldResponse, FloatDetail, FloatMeta, MetaResponse } from "../types/ocean";

const BASE = "/api";
const TIMEOUT = 15000;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${body}`);
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

export function getFloatDetail(id: string): Promise<FloatDetail> {
  return fetchJson<FloatDetail>(`${BASE}/floats/${encodeURIComponent(id)}`);
}
