import { create } from "zustand";
import type {
  FieldResponse,
  FloatDetail,
  FloatMeta,
  MetaResponse,
} from "../types/ocean";
import type { AuthUser } from "../types/auth";
import * as api from "../api/client";
import * as authApi from "../api/auth";

let requestSeq = 0;

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

interface OceanState {
  // Routing & auth state
  currentPage: PageId;
  user: AuthUser | null;
  token: string | null;
  authLoading: boolean;

  // UI state
  variable: string;
  depth: number;
  timeIndex: number;
  colorscale: string;
  opacity: number;
  showFloats: boolean;
  compareModel: boolean;
  selectedFloatId: string | null;
  profilePanelOpen: boolean;

  // Data state
  meta: MetaResponse | null;
  field: FieldResponse | null;
  fieldLoading: boolean;
  fieldError: string | null;
  floats: FloatMeta[];
  floatDetail: FloatDetail | null;
  floatDetailLoading: boolean;

  // Actions — routing & auth
  setPage: (page: PageId) => void;
  signupWithEmail: (name: string, email: string, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => void;
  loginWithGithub: () => void;
  handleOAuthToken: (token: string) => Promise<void>;
  restoreSession: () => Promise<void>;
  logout: () => void;

  // Actions — ocean state
  setVariable: (v: string) => void;
  setDepth: (d: number) => void;
  setTimeIndex: (t: number) => void;
  setColorscale: (c: string) => void;
  setOpacity: (o: number) => void;
  setShowFloats: (s: boolean) => void;
  setCompareModel: (c: boolean) => void;
  selectFloat: (id: string | null) => void;
  loadMeta: () => Promise<void>;
  loadFloats: () => Promise<void>;
  loadField: (variable: string, depth: number, timeIndex: number) => Promise<void>;
  loadFloatDetail: (id: string) => Promise<void>;
  closeProfilePanel: () => void;
}

function applyAuth(
  set: (partial: Partial<OceanState>) => void,
  token: string,
  user: AuthUser
) {
  persistAuth(token, user);
  set({ token, user, authLoading: false, currentPage: "dashboard" });
}

export const useOceanStore = create<OceanState>((set, get) => ({
  // Routing & auth initial state
  currentPage: "landing" as PageId,
  user: null,
  token: null,
  authLoading: true,

  // Ocean initial state
  variable: "temperature",
  depth: 50,
  timeIndex: 2,
  colorscale: "thermal",
  opacity: 1,
  showFloats: true,
  compareModel: true,
  selectedFloatId: null,
  profilePanelOpen: false,

  meta: null,
  field: null,
  fieldLoading: false,
  fieldError: null,
  floats: [],
  floatDetail: null,
  floatDetailLoading: false,

  // Routing & auth actions
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

  // Ocean actions
  setVariable: (v) => {
    const colorDefaults: Record<string, string> = {
      temperature: "thermal",
      salinity: "viridis",
      u_current: "rdbu",
      v_current: "rdbu",
      chlorophyll: "chlorophyll",
    };
    set({ variable: v, colorscale: colorDefaults[v] || get().colorscale });
  },
  setDepth: (d) => set({ depth: d }),
  setTimeIndex: (t) => set({ timeIndex: t }),
  setColorscale: (c) => set({ colorscale: c }),
  setOpacity: (o) => set({ opacity: o }),
  setShowFloats: (s) => set({ showFloats: s }),
  setCompareModel: (c) => set({ compareModel: c }),
  selectFloat: (id) =>
    set({ selectedFloatId: id, profilePanelOpen: id !== null }),

  loadMeta: async () => {
    try {
      const meta = await api.getMeta();
      set({ meta });
    } catch {
      // meta stays null — controls disabled
    }
  },

  loadFloats: async () => {
    try {
      const floats = await api.getFloats();
      set({ floats });
    } catch {
      // floats stays empty
    }
  },

  loadField: async (variable, depth, timeIndex) => {
    const seq = ++requestSeq;
    set({ fieldLoading: true, fieldError: null });
    try {
      const field = await api.getField({ variable, depth, timeIndex });
      if (seq === requestSeq) {
        set({ field, fieldLoading: false });
      }
    } catch (err) {
      if (seq === requestSeq) {
        set({
          fieldError: err instanceof Error ? err.message : "Failed to load field",
          fieldLoading: false,
        });
      }
    }
  },

  loadFloatDetail: async (id) => {
    set({ floatDetailLoading: true });
    try {
      const detail = await api.getFloatDetail(id);
      set({ floatDetail: detail, floatDetailLoading: false });
    } catch {
      set({ floatDetail: null, floatDetailLoading: false });
    }
  },

  closeProfilePanel: () =>
    set({
      profilePanelOpen: false,
      selectedFloatId: null,
      floatDetail: null,
    }),
}));