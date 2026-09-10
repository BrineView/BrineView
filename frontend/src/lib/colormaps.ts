/** Color scale palettes for the ocean visualization */

type RGB = [number, number, number];

export interface ColorStop {
  t: number;
  color: RGB;
}

export const PALETTES: Record<string, ColorStop[]> = {
  thermal: [
    { t: 0.0, color: [3, 35, 100] },
    { t: 0.25, color: [0, 104, 200] },
    { t: 0.5, color: [32, 180, 200] },
    { t: 0.75, color: [250, 220, 50] },
    { t: 1.0, color: [230, 40, 20] },
  ],
  viridis: [
    { t: 0.0, color: [68, 1, 84] },
    { t: 0.2, color: [72, 35, 116] },
    { t: 0.4, color: [64, 67, 135] },
    { t: 0.6, color: [52, 94, 141] },
    { t: 0.8, color: [33, 144, 140] },
    { t: 1.0, color: [253, 231, 37] },
  ],
  chlorophyll: [
    { t: 0.0, color: [2, 20, 60] },
    { t: 0.3, color: [0, 80, 120] },
    { t: 0.6, color: [30, 160, 80] },
    { t: 1.0, color: [180, 240, 50] },
  ],
  ocean: [
    { t: 0.0, color: [255, 255, 255] },
    { t: 0.35, color: [140, 200, 240] },
    { t: 0.7, color: [30, 100, 180] },
    { t: 1.0, color: [5, 30, 80] },
  ],
  rdbu: [
    { t: 0.0, color: [178, 24, 43] },
    { t: 0.25, color: [239, 138, 98] },
    { t: 0.5, color: [247, 247, 247] },
    { t: 0.75, color: [103, 169, 207] },
    { t: 1.0, color: [33, 102, 172] },
  ],
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function sampleColormap(name: string, t: number): RGB {
  const stops = PALETTES[name] || PALETTES.thermal;
  const clamped = Math.max(0, Math.min(1, t));

  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].t && clamped <= stops[i + 1].t) {
      const local = (clamped - stops[i].t) / (stops[i + 1].t - stops[i].t);
      return [
        Math.round(lerp(stops[i].color[0], stops[i + 1].color[0], local)),
        Math.round(lerp(stops[i].color[1], stops[i + 1].color[1], local)),
        Math.round(lerp(stops[i].color[2], stops[i + 1].color[2], local)),
      ];
    }
  }
  return stops[stops.length - 1].color;
}

export function buildGradientCss(name: string): string {
  const stops = PALETTES[name] || PALETTES.thermal;
  const parts = stops.map((s) => `rgb(${s.color.join(",")}) ${s.t * 100}%`);
  return `linear-gradient(to right, ${parts.join(", ")})`;
}

export function buildFieldTexture(
  values: (number | null)[][],
  min: number,
  max: number,
  colormapName: string,
): ImageData {
  const nLat = values.length;
  const nLon = values[0].length;
  const img = new ImageData(nLon, nLat);
  const range = max - min || 1;

  for (let i = 0; i < nLat; i++) {
    // Write rows so lat 0 (south) maps to bottom of texture
    const canvasRow = nLat - 1 - i;
    for (let j = 0; j < nLon; j++) {
      const val = values[i][j];
      const t = val !== null && val !== undefined ? (val - min) / range : 0;
      const rgb = sampleColormap(colormapName, t);
      const px = (canvasRow * nLon + j) * 4;
      img.data[px] = rgb[0];
      img.data[px + 1] = rgb[1];
      img.data[px + 2] = rgb[2];
      img.data[px + 3] = val !== null && val !== undefined ? 255 : 0;
    }
  }
  return img;
}

/** Symmetric bounds for divergent fields (currents) */
export function autoScaleBounds(
  variable: string,
  min: number,
  max: number,
): [number, number] {
  if (variable === "u_current" || variable === "v_current") {
    const absMax = Math.max(Math.abs(min), Math.abs(max));
    return [-absMax, absMax];
  }
  return [min, max];
}
