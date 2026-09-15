import { create } from "zustand";
import type {
  BathymetryResponse,
  FieldResponse,
  FloatDetail,
  FloatMeta,
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

  loadMeta: () => Promise<void>;
  loadFloats: () => Promise<void>;
  loadBathymetry: () => Promise<void>;
  loadField: (variable: string, depth: number, timeIndex: number) => Promise<void>;
  loadFloatDetail: (id: string) => Promise<void>;
  selectFloat: (id: string | null) => void;
  closeProfilePanel: () => void;
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
}));
