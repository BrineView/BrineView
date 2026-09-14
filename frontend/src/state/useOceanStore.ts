import { create } from "zustand";
import type {
  BathymetryResponse,
  FieldResponse,
  FloatDetail,
  FloatMeta,
  MetaResponse,
  UserDatasetInfo,
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
  bathymetry: BathymetryResponse | null;
  floats: FloatMeta[];
  floatDetail: FloatDetail | null;
  floatDetailLoading: boolean;

  // User-uploaded data state
  userDatasets: UserDatasetInfo[];
  userDataOpen: boolean;
  userDataLoading: boolean;
  userDataError: string | null;

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
  loadBathymetry: () => Promise<void>;
  loadField: (variable: string, depth: number, timeIndex: number) => Promise<void>;
  loadFloatDetail: (id: string) => Promise<void>;
  closeProfilePanel: () => void;
  openUserData: () => Promise<void>;
  closeUserData: () => void;
  uploadUserData: (file: File) => Promise<void>;
  deleteUserData: (index: number) => Promise<void>;
  loadUserField: (index: number, variable: string) => Promise<void>;
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
  bathymetry: null,
  floats: [],
  floatDetail: null,
  floatDetailLoading: false,

  userDatasets: [],
  userDataOpen: false,
  userDataLoading: false,
  userDataError: null,

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

  loadBathymetry: async () => {
    try {
      const bathymetry = await api.getBathymetry();
      set({ bathymetry });
    } catch {
      // bathymetry stays null → flat surface terrain fallback
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

  openUserData: async () => {
    set({ userDataOpen: true, userDataError: null });
    try {
      const userDatasets = await api.listUserData();
      set({ userDatasets });
    } catch {
      // list stays empty — the upload buttons still work
    }
  },

  closeUserData: () =>
    set({ userDataOpen: false, userDataError: null }),

  uploadUserData: async (file) => {
    set({ userDataLoading: true, userDataError: null });
    try {
      const uploaded = await api.uploadUserData(file);
      set((s) => ({
        userDatasets: [...s.userDatasets.filter((d) => d.index !== uploaded.index), uploaded],
        userDataLoading: false,
      }));
    } catch (err) {
      set({
        userDataError: err instanceof Error ? err.message : "Upload failed",
        userDataLoading: false,
      });
      throw err;
    }
  },

  deleteUserData: async (index) => {
    try {
      await api.deleteUserData(index);
      set((s) => ({ userDatasets: s.userDatasets.filter((d) => d.index !== index) }));
    } catch {
      // keep the entry; user can retry or close the modal
    }
  },

  loadUserField: async (index, variable) => {
    set({ fieldLoading: true, fieldError: null });
    try {
      const field = await api.getUserDataField({ index, variable });
      const name = variable.toLowerCase();
      let colorscale = get().colorscale;
      if (name.includes("salinity")) colorscale = "viridis";
      else if (name.includes("chlorophyll")) colorscale = "chlorophyll";
      else if (name.includes("current") || name.includes("velocity")) colorscale = "rdbu";
      else if (name.includes("temperature") || name.includes("temp")) colorscale = "thermal";
      set({ field, variable, colorscale, fieldLoading: false, fieldError: null });
    } catch (err) {
      set({
        fieldError: err instanceof Error ? err.message : "Failed to load data",
        fieldLoading: false,
      });
    }
  },
}));