import { create } from "zustand";

interface OceanState {
  variable: string;
  depth: number;
  timeIndex: number;
  colorscale: string;
  opacity: number;
  showFloats: boolean;
  compareModel: boolean;
  showGliders: boolean;
  showAnomalies: boolean;
  showAssimilated: boolean;

  setVariable: (v: string) => void;
  setDepth: (d: number) => void;
  setTimeIndex: (t: number) => void;
  setColorscale: (c: string) => void;
  setOpacity: (o: number) => void;
  setShowFloats: (s: boolean) => void;
  setCompareModel: (c: boolean) => void;
  setShowGliders: (s: boolean) => void;
  setShowAnomalies: (s: boolean) => void;
  setShowAssimilated: (s: boolean) => void;
}

export const useOceanStore = create<OceanState>((set, get) => ({
  variable: "temperature",
  depth: 50,
  timeIndex: 2,
  colorscale: "thermal",
  opacity: 1,
  showFloats: true,
  compareModel: true,
  showGliders: true,
  showAnomalies: false,
  showAssimilated: false,

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
  setShowGliders: (s) => set({ showGliders: s }),
  setShowAnomalies: (s) => set({ showAnomalies: s }),
  setShowAssimilated: (s) => set({ showAssimilated: s }),
}));
