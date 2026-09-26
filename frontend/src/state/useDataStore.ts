import { create } from "zustand";
import type {
  AssimilateRequest,
  AssimilateResponse,
  BathymetryResponse,
  FieldResponse,
  FloatDetail,
  FloatMeta,
  FloatMetricRow,
  GliderDetail,
  GliderMeta,
  MetaResponse,
} from "../types/ocean";
import * as api from "../api/client";

let requestSeq = 0;

interface DataState {
  meta: MetaResponse | null;
  field: FieldResponse | null;
  fieldLoading: boolean;
  fieldError: string | null;
  bathymetry: BathymetryResponse | null;
  floats: FloatMeta[];
  floatDetail: FloatDetail | null;
  floatDetailLoading: boolean;
  selectedFloatId: string | null;
  profilePanelOpen: boolean;

  floatMetrics: FloatMetricRow[];
  metricsLoading: boolean;

  gliders: GliderMeta[];
  glidersLoading: boolean;
  gliderDetail: GliderDetail | null;
  selectedGliderId: string | null;
  gliderPanelOpen: boolean;

  assimilated: AssimilateResponse | null;
  assimilating: boolean;
  assimError: string | null;

  loadMeta: () => Promise<void>;
  loadFloats: () => Promise<void>;
  loadBathymetry: () => Promise<void>;
  loadField: (variable: string, depth: number, timeIndex: number) => Promise<void>;
  loadFloatDetail: (id: string) => Promise<void>;
  selectFloat: (id: string | null) => void;
  closeProfilePanel: () => void;

  loadFloatMetrics: () => Promise<void>;
  loadGliders: () => Promise<void>;
  loadGliderDetail: (id: string) => Promise<void>;
  selectGlider: (id: string | null) => void;
  closeGliderPanel: () => void;

  runAssimilate: (req: AssimilateRequest) => Promise<boolean>;
  clearAssimilated: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  meta: null,
  field: null,
  fieldLoading: false,
  fieldError: null,
  bathymetry: null,
  floats: [],
  floatDetail: null,
  floatDetailLoading: false,
  selectedFloatId: null,
  profilePanelOpen: false,

  floatMetrics: [],
  metricsLoading: false,

  gliders: [],
  glidersLoading: false,
  gliderDetail: null,
  selectedGliderId: null,
  gliderPanelOpen: false,

  assimilated: null,
  assimilating: false,
  assimError: null,

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

  selectFloat: (id) =>
    set({ selectedFloatId: id, profilePanelOpen: id !== null }),

  closeProfilePanel: () =>
    set({
      profilePanelOpen: false,
      selectedFloatId: null,
      floatDetail: null,
    }),

  loadFloatMetrics: async () => {
    set({ metricsLoading: true });
    try {
      const floatMetrics = await api.getFloatMetrics();
      set({ floatMetrics, metricsLoading: false });
    } catch {
      set({ metricsLoading: false });
    }
  },

  loadGliders: async () => {
    set({ glidersLoading: true });
    try {
      const gliders = await api.getGliders();
      set({ gliders, glidersLoading: false });
    } catch {
      set({ glidersLoading: false });
    }
  },

  loadGliderDetail: async (id) => {
    try {
      const gliderDetail = await api.getGliderDetail(id);
      set({ gliderDetail });
    } catch {
      set({ gliderDetail: null });
    }
  },

  selectGlider: (id) => set({ selectedGliderId: id, gliderPanelOpen: id !== null }),

  closeGliderPanel: () =>
    set({
      gliderPanelOpen: false,
      selectedGliderId: null,
      gliderDetail: null,
    }),

  runAssimilate: async (req) => {
    set({ assimilating: true, assimError: null });
    try {
      const assimilated = await api.postAssimilate(req);
      set({ assimilated, assimilating: false });
      return true;
    } catch (err) {
      set({
        assimError: err instanceof Error ? err.message : "Assimilation failed",
        assimilating: false,
      });
      return false;
    }
  },

  clearAssimilated: () => set({ assimilated: null, assimError: null }),
}));