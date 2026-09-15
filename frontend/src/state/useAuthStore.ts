import { create } from "zustand";
import type { AuthUser } from "../types/auth";
import * as authApi from "../api/auth";

export type PageId = "landing" | "login" | "signup" | "dashboard" | "about";

const AUTH_STORAGE_KEY = "brineview.auth";

interface PersistedAuth {
  token: string;
  user: AuthUser;
}

function loadPersistedAuth(): PersistedAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAuth;
    if (!parsed.token || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistAuth(token: string | null, user: AuthUser | null) {
  try {
    if (token && user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user }));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // storage unavailable — session just won't survive a refresh
  }
}

interface AuthState {
  currentPage: PageId;
  user: AuthUser | null;
  token: string | null;
  authLoading: boolean;

  setPage: (page: PageId) => void;
  signupWithEmail: (name: string, email: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => void;
  loginWithGithub: () => void;
  handleOAuthToken: (token: string) => Promise<void>;
  restoreSession: () => Promise<void>;
  logout: () => void;
}

function applyAuth(
  set: (partial: Partial<AuthState>) => void,
  token: string,
  user: AuthUser
) {
  persistAuth(token, user);
  set({ token, user, authLoading: false, currentPage: "dashboard" });
}

export const useAuthStore = create<AuthState>((set) => ({
  currentPage: "landing" as PageId,
  user: null,
  token: null,
  authLoading: true,

  setPage: (page) => set({ currentPage: page }),

  signupWithEmail: async (name, email, password) => {
    const { token, user } = await authApi.signupWithEmail(name, email, password);
    applyAuth(set, token, user);
  },

  loginWithEmail: async (email, password) => {
    const { token, user } = await authApi.loginWithEmail(email, password);
    applyAuth(set, token, user);
  },

  loginWithGoogle: () => {
    window.location.href = "/api/auth/google";
  },

  loginWithGithub: () => {
    window.location.href = "/api/auth/github";
  },

  handleOAuthToken: async (token) => {
    set({ authLoading: true });
    try {
      const { user } = await authApi.getMe(token);
      applyAuth(set, token, user);
    } catch (err) {
      persistAuth(null, null);
      set({ token: null, user: null, authLoading: false });
      throw err;
    }
  },

  restoreSession: async () => {
    const persisted = loadPersistedAuth();
    if (!persisted) {
      set({ authLoading: false });
      return;
    }
    try {
      const { user } = await authApi.getMe(persisted.token);
      applyAuth(set, persisted.token, user);
    } catch {
      persistAuth(null, null);
      set({ token: null, user: null, authLoading: false });
    }
  },

  logout: () => {
    persistAuth(null, null);
    set({ user: null, token: null, currentPage: "landing" });
  },
}));
