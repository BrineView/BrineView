import { create } from "zustand";
import type {
  FieldResponse,
  FloatDetail,
  FloatMeta,
  MetaResponse,
} from "../types/ocean";
import * as api from "../api/client";

let requestSeq = 0;

interface OceanState {
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

  // Actions
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

export const useOceanStore = create<OceanState>((set, get) => ({
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
