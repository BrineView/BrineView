import type { AuthResponse, AuthStatus } from "../types/auth";
import { fetchJson, fetchJsonAuth, postJson } from "./client";

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

export function getMe(token: string): Promise<{ user: AuthResponse["user"] }> {
  return fetchJsonAuth<{ user: AuthResponse["user"] }>(`${AUTH}/me`, token);
}

export function getAuthStatus(): Promise<AuthStatus> {
  return fetchJson<AuthStatus>(`${AUTH}/status`);
}