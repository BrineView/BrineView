import * as THREE from "three";
import type { FieldResponse } from "../../types/ocean";
import { buildFieldTexture, autoScaleBounds } from "../../lib/colormaps";
import { latLonToWorld } from "./helpers";

export function createSurfaceMesh(
  field: FieldResponse,
  colorscale: string,
  latRange: [number, number],
  lonRange: [number, number],
  opacity: number,
): THREE.Mesh {
  const nLat = field.lat.length;
  const nLon = field.lon.length;

  const [tMin, tMax] = autoScaleBounds(field.variable, field.min, field.max);
  const imgData = buildFieldTexture(field.values, tMin, tMax, colorscale);
  const canvas = document.createElement("canvas");
  canvas.width = nLon;
  canvas.height = nLat;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  const positions = new Float32Array(nLat * nLon * 3);
  const uvs = new Float32Array(nLat * nLon * 2);
  const indices: number[] = [];

  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      const idx = i * nLon + j;
      const lat = field.lat[i];
      const lon = field.lon[j];
      const { x, z } = latLonToWorld(lat, lon, latRange, lonRange);
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = 0;
      positions[idx * 3 + 2] = z;
      uvs[idx * 2] = j / (nLon - 1);
      uvs[idx * 2 + 1] = i / (nLat - 1);
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
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const material = new THREE.MeshPhongMaterial({
    map: texture,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    emissive: 0x0a1726,
    emissiveIntensity: 0.25,
    shininess: 12,
    specular: 0x112233,
  });

  return new THREE.Mesh(geom, material);
}

export function disposeSurface(mesh: THREE.Mesh | null) {
  if (!mesh) return;
  mesh.geometry.dispose();
  const mat = mesh.material as THREE.MeshPhongMaterial;
  if (mat.map) mat.map.dispose();
  mat.dispose();
}
