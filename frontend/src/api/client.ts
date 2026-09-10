import type { FieldResponse, FloatDetail, FloatMeta, MetaResponse } from "../types/ocean";

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

async function sendJson<T>(
  url: string,
  init?: { method?: string; token?: string; body?: unknown }
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.token) {
    headers.Authorization = `Bearer ${init.token}`;
  }
  const res = await fetch(url, {
    method: init?.method ?? "POST",
    headers,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
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

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return sendJson<T>(url, { method: "POST", body });
}

export function fetchJsonAuth<T>(url: string, token: string): Promise<T> {
  return sendJson<T>(url, { method: "GET", token });
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
