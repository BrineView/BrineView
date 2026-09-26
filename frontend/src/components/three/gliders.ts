import * as THREE from "three";
import type { GliderMeta } from "../../types/ocean";
import { makeHaloTexture, latLonToWorld } from "./helpers";

interface GliderBody {
  id: string;
  head: THREE.Mesh;
  headMat: THREE.MeshBasicMaterial;
  trail: THREE.Line;
  halo: THREE.Sprite;
  haloMat: THREE.SpriteMaterial;
  track: { t: number; lat: number; lon: number }[];
  mats: THREE.Material[];
}

const HEAD = new THREE.ConeGeometry(0.24, 0.55, 8);

export class GliderManager {
  private group: THREE.Group;
  private bodies: GliderBody[] = [];
  private gliderIds: string[] = [];
  private selectedId: string | null = null;
  private latRange: [number, number] = [-4, 15];
  private lonRange: [number, number] = [92, 106];
  private timeIndex = 0;
  private haloTexture: THREE.Texture;

  constructor(group: THREE.Group) {
    this.group = group;
    this.haloTexture = makeHaloTexture();
  }

  setGliders(gliders: GliderMeta[], latRange: [number, number], lonRange: [number, number]) {
    this.clear();
    this.latRange = latRange;
    this.lonRange = lonRange;
    this.timeIndex = 0;

    for (const g of gliders) {
      const track = g.track ?? [];
      const headMat = new THREE.MeshBasicMaterial({ color: this.selectedId === g.id ? 0xffffff : 0x2de0c8 });
      const head = new THREE.Mesh(HEAD, headMat);
      const trailGeom = new THREE.BufferGeometry().setFromPoints(
        track.map((p) => {
          const { x, z } = latLonToWorld(p.lat, p.lon, this.latRange, this.lonRange);
          return new THREE.Vector3(x, 0.05, z);
        }),
      );
      const headMat2 = new THREE.LineBasicMaterial({
        color: 0x5effde,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const trail = new THREE.Line(trailGeom, headMat2);

      const haloMat = new THREE.SpriteMaterial({
        map: this.haloTexture,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const halo = new THREE.Sprite(haloMat);
      halo.scale.set(1.6, 1.6, 1);

      this.group.add(head);
      this.group.add(trail);
      this.group.add(halo);

      const body: GliderBody = {
        id: g.id,
        head,
        headMat,
        trail,
        halo,
        haloMat,
        track,
        mats: [headMat, headMat2, haloMat],
      };
      this.bodies.push(body);
      this.gliderIds.push(g.id);
    }
    this.setTimeIndex(0);
  }

  setTimeIndex(t: number) {
    this.timeIndex = t;
    for (const b of this.bodies) {
      const step = b.track.find((p) => p.t === t) ?? b.track[b.track.length - 1] ?? { lat: b.track[0]?.lat ?? 0, lon: b.track[0]?.lon ?? 0 };
      const { x, z } = latLonToWorld(step.lat, step.lon, this.latRange, this.lonRange);
      b.head.position.set(x, 0.85, z);
      b.head.rotation.z = 0;
      b.head.rotation.x = 0;
      b.halo.position.set(x, 0.05, z);
    }
  }

  setSelectedId(id: string | null) {
    this.selectedId = id;
    for (const b of this.bodies) {
      const isSelected = b.id === id;
      b.headMat.color.setHex(isSelected ? 0xffffff : 0x2de0c8);
      b.head.scale.setScalar(isSelected ? 1.5 : 1);
      b.haloMat.opacity = isSelected ? 0.8 : 0.4;
    }
  }

  setVisible(show: boolean) {
    this.group.visible = show;
  }

  raycast(raycaster: THREE.Raycaster): string | null {
    const targets: THREE.Object3D[] = this.bodies.map((b) => b.head);
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      const head = hits[0].object;
      const b = this.bodies.find((x) => x.head === head);
      return b ? b.id : null;
    }
    return null;
  }

  updatePulse(time: number) {
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      const base = b.id === this.selectedId ? 0.8 : 0.4;
      b.haloMat.opacity = base * (0.55 + 0.45 * Math.sin(time * 2.4 + i * 1.3));
      const s = 1.7 * (1 + 0.1 * Math.sin(time * 2 + i * 0.6));
      b.halo.scale.set(s, s, 1);
    }
  }

  private clear() {
    for (const b of this.bodies) {
      for (const m of b.mats) m.dispose();
      b.trail.geometry.dispose();
    }
    this.group.clear();
    this.bodies = [];
    this.gliderIds = [];
  }

  dispose() {
    this.clear();
    this.haloTexture.dispose();
  }
}