import * as THREE from "three";

export const WORLD_X_SPAN = 35;
export const WORLD_Z_SPAN = 25;

// World-units per metre of terrain elevation: −5939 m trench → ~ −18
export const TERRAIN_SCALE = 0.003;

export function latLonToWorld(lat: number, lon: number, latRange: [number, number], lonRange: [number, number]): { x: number; z: number } {
  const x = ((lon - lonRange[0]) / (lonRange[1] - lonRange[0]) - 0.5) * WORLD_X_SPAN;
  const z = ((lat - latRange[0]) / (latRange[1] - latRange[0]) - 0.5) * WORLD_Z_SPAN;
  return { x, z };
}

export type RGB = [number, number, number];

/** Elevation (m, sea level = 0) → terrain vertex colour. */
export function terrainColor(z: number): RGB {
  if (z >= 800) return [142, 112, 60]; // high land (brown)
  if (z >= 200) return [112, 138, 62]; // lowland (olive green)
  if (z >= 0) return [84, 150, 74]; // coast (green)
  if (z >= -200) return [47, 127, 191]; // shallow shelf
  if (z >= -1000) return [27, 90, 167]; // continental slope
  if (z >= -2500) return [16, 58, 122]; // deep sea
  return [10, 31, 77]; // abyss / trench
}

/** Radial glow used under the Argo markers. */
export function makeHaloTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, "rgba(110, 244, 228, 0.9)");
  g.addColorStop(0.45, "rgba(84, 220, 206, 0.32)");
  g.addColorStop(1, "rgba(45, 224, 200, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Pick a "nice" axis step so a range yields at most ~9 tick labels. */
export function niceTickStep(width: number): number {
  const nice = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  for (const s of nice) {
    if (Math.ceil(width / s) <= 9) return s;
  }
  return 100;
}

/** Evenly spaced tick values inside [min, max] at a given step. */
export function tickValues(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(min / step) * step;
  for (let v = first; v <= max + 1e-9; v += step) {
    out.push(parseFloat(v.toFixed(2)));
    if (out.length > 40) break;
  }
  return out;
}

/** Compact tick label (drop trailing float noise / .0). */
export function formatTick(v: number): string {
  const rounded = parseFloat(v.toFixed(1));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
