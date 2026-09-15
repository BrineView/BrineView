import type { AuthResponse, AuthStatus } from "../types/auth";
import { fetchJson, postJson } from "./client";

const AUTH = "/api/auth";

export function signupWithEmail(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  return postJson<AuthResponse>(`${AUTH}/signup`, { name, email, password });
}

export function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  return postJson<AuthResponse>(`${AUTH}/login`, { email, password });
}

export async function getMe(token: string): Promise<{ user: AuthResponse["user"] }> {
  const res = await fetch(`${AUTH}/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }
  return res.json();
}

export function getAuthStatus(): Promise<AuthStatus> {
  return fetchJson<AuthStatus>(`${AUTH}/status`);
}