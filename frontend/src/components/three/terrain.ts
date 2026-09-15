import * as THREE from "three";
import type { BathymetryResponse } from "../../types/ocean";
import { latLonToWorld, terrainColor, TERRAIN_SCALE } from "./helpers";

export function createTerrainMesh(
  bathy: BathymetryResponse,
  latRange: [number, number],
  lonRange: [number, number],
): THREE.Mesh | null {
  if (bathy.lat.length < 2 || bathy.lon.length < 2) return null;

  const nLat = bathy.lat.length;
  const nLon = bathy.lon.length;

  const positions = new Float32Array(nLat * nLon * 3);
  const colors = new Float32Array(nLat * nLon * 3);
  const indices: number[] = [];

  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      const idx = i * nLon + j;
      const z = bathy.values[i]?.[j] ?? null;
      const { x, z: wz } = latLonToWorld(bathy.lat[i], bathy.lon[j], latRange, lonRange);
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = z === null ? -0.1 : z * TERRAIN_SCALE;
      positions[idx * 3 + 2] = wz;

      const c = z === null ? null : terrainColor(z);
      colors[idx * 3] = c ? c[0] / 255 : 0;
      colors[idx * 3 + 1] = c ? c[1] / 255 : 0;
      colors[idx * 3 + 2] = c ? c[2] / 255 : 0;
    }
  }

  for (let i = 0; i < nLat - 1; i++) {
    for (let j = 0; j < nLon - 1; j++) {
      const a = i * nLon + j;
      const b = i * nLon + j + 1;
      const c = (i + 1) * nLon + j;
      const d = (i + 1) * nLon + j + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geom, material);
}

export function disposeTerrain(mesh: THREE.Mesh | null) {
  if (!mesh) return;
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
}
