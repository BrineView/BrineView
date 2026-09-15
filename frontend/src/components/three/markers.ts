import * as THREE from "three";
import type { FloatMeta } from "../../types/ocean";
import { makeHaloTexture, latLonToWorld } from "./helpers";

export class MarkerManager {
  private group: THREE.Group;
  private meshes: THREE.Mesh[] = [];
  private floatIds: string[] = [];
  private haloSprites: THREE.Sprite[] = [];
  private selectedId: string | null = null;
  private floats: FloatMeta[] = [];
  private haloTexture: THREE.Texture;

  constructor(group: THREE.Group) {
    this.group = group;
    this.haloTexture = makeHaloTexture();
  }

  setFloats(floats: FloatMeta[], latRange: [number, number], lonRange: [number, number]) {
    this.clear();
    this.floats = floats;

    const markerGeom = new THREE.SphereGeometry(0.4, 12, 12);

    for (const f of floats) {
      const { x, z } = latLonToWorld(f.lat, f.lon, latRange, lonRange);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });
      const mesh = new THREE.Mesh(markerGeom, markerMat);
      mesh.position.set(x, 0.8, z);
      mesh.userData = { floatId: f.id };
      this.group.add(mesh);
      this.meshes.push(mesh);
      this.floatIds.push(f.id);

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.haloTexture,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        }),
      );
      halo.position.set(x, 0.07, z);
      halo.scale.set(2.2, 2.2, 1);
      this.group.add(halo);
      this.haloSprites.push(halo);
    }
  }

  setSelectedId(id: string | null) {
    this.selectedId = id;
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i];
      const isSelected = this.floatIds[i] === id;
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(
        isSelected ? 0xffffff : 0xfb923c,
      );
      const scale = isSelected ? 1.5 : 1;
      mesh.scale.setScalar(scale);
    }
  }

  setVisible(show: boolean) {
    this.group.visible = show;
  }

  reposition(latRange: [number, number], lonRange: [number, number]) {
    for (const mesh of this.meshes) {
      const fid = mesh.userData.floatId as string;
      const idx = this.floatIds.indexOf(fid);
      if (idx < 0) continue;
      const f = this.floats[idx];
      if (!f) continue;
      const { x, z } = latLonToWorld(f.lat, f.lon, latRange, lonRange);
      mesh.position.set(x, 0.8, z);
    }
  }

  raycast(raycaster: THREE.Raycaster): string | null {
    const hits = raycaster.intersectObjects(this.meshes);
    if (hits.length > 0 && hits[0].object.userData.floatId) {
      return hits[0].object.userData.floatId as string;
    }
    return null;
  }

  updatePulse(time: number) {
    for (let i = 0; i < this.haloSprites.length; i++) {
      const isSelected = this.floatIds[i] === this.selectedId;
      const base = isSelected ? 0.9 : 0.5;
      const pulse = 0.55 + 0.45 * Math.sin(time * 2 + i * 0.7);
      (this.haloSprites[i].material as THREE.SpriteMaterial).opacity = base * pulse;
      const s = (isSelected ? 2.9 : 2.3) * (1 + 0.08 * Math.sin(time * 1.6 + i * 0.9));
      this.haloSprites[i].scale.set(s, s, 1);
    }
  }

  dispose() {
    this.clear();
    this.haloTexture.dispose();
  }

  private clear() {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      } else if (child instanceof THREE.Sprite) {
        child.material.map?.dispose();
        (child.material as THREE.Material).dispose();
      }
      this.group.remove(child);
    }
    this.meshes = [];
    this.floatIds = [];
    this.haloSprites = [];
  }
}
