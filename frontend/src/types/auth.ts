export type AuthProvider = "email" | "google" | "github";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  provider: AuthProvider;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface AuthStatus {
  google: boolean;
  github: boolean;
}