const DEPTH_BANDS: Record<number, { name: string; blurb: string }> = {
  0: { name: "Surface", blurb: "Sunlit upper layer, directly heated by the atmosphere" },
  10: { name: "Near-surface", blurb: "Just below the surface, still well-mixed" },
  25: { name: "Mixed layer", blurb: "Wind-mixed zone with relatively uniform properties" },
  50: { name: "Thermocline", blurb: "Steepest temperature change with depth" },
  100: { name: "Thermocline base", blurb: "Bottom of the main temperature transition" },
  200: { name: "Upper mesopelagic", blurb: "Twilight zone — little light, slow mixing" },
  500: { name: "Deep water", blurb: "Cold, stable deep ocean layer" },
  1000: { name: "Abyssal", blurb: "Near-freezing deep ocean, high pressure" },
};

export function getDepthBand(depth: number): { name: string; blurb: string } {
  return DEPTH_BANDS[depth] ?? { name: `${depth} m`, blurb: "" };
}
