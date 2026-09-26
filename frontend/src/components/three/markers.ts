import * as THREE from "three";
import type { FloatMeta } from "../../types/ocean";
import { makeHaloTexture, latLonToWorld } from "./helpers";

interface FloatBodies {
  id: string;
  group: THREE.Group;
  hull: THREE.Mesh;
  hullMat: THREE.MeshBasicMaterial;
  nodeMats: THREE.MeshBasicMaterial[];
  mats: THREE.Material[];
  trail: THREE.Line | null;
}

const HULL = new THREE.SphereGeometry(0.32, 12, 8);
const MAST = new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6);
const TETHER = new THREE.CylinderGeometry(0.018, 0.018, 0.6, 6);
const NODE = new THREE.SphereGeometry(0.06, 8, 8);

export class MarkerManager {
  private group: THREE.Group;
  private bodies: FloatBodies[] = [];
  private floatIds: string[] = [];
  private haloSprites: THREE.Sprite[] = [];
  private haloMats: THREE.SpriteMaterial[] = [];
  private selectedId: string | null = null;
  private floats: FloatMeta[] = [];
  private haloTexture: THREE.Texture;
  private latRange: [number, number] = [-4, 15];
  private lonRange: [number, number] = [92, 106];
  private timeIndex = 0;
  private anomalyIds = new Set<string>();
  private anomalyOn = false;

  constructor(group: THREE.Group) {
    this.group = group;
    this.haloTexture = makeHaloTexture();
  }

  setFloats(floats: FloatMeta[], latRange: [number, number], lonRange: [number, number]) {
    this.clear();
    this.floats = floats;
    this.latRange = latRange;
    this.lonRange = lonRange;
    this.timeIndex = 0;

    for (const f of floats) {
      const { x, z } = latLonToWorld(f.lat, f.lon, latRange, lonRange);
      const hullMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });

      const group = new THREE.Group();
      const hull = new THREE.Mesh(HULL, hullMat);
      group.add(hull);

      const mastMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });
      const mast = new THREE.Mesh(MAST, mastMat);
      mast.position.y = 0.28 + 0.28;
      group.add(mast);

      const tetherMat = new THREE.MeshBasicMaterial({ color: 0x8aa6c9 });
      const tether = new THREE.Mesh(TETHER, tetherMat);
      tether.position.y = -0.45;
      group.add(tether);

      const nodeMats: THREE.MeshBasicMaterial[] = [];
      for (const dy of [-0.3, -0.5, -0.7]) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x2de0c8 });
        const nodeMesh = new THREE.Mesh(NODE, mat);
        nodeMesh.position.y = dy;
        group.add(nodeMesh);
        nodeMats.push(mat);
      }

      group.position.set(x, 0.8, z);
      const trail = this.buildTrail(f);
      if (trail) this.group.add(trail);

      this.group.add(group);
      this.bodies.push({
        id: f.id,
        group,
        hull,
        hullMat,
        nodeMats,
        mats: [hullMat, mastMat, tetherMat, ...nodeMats],
        trail,
      });
      this.floatIds.push(f.id);

      // Halo under the float (tinted per-float for anomaly mode)
      const haloMat = new THREE.SpriteMaterial({
        map: this.haloTexture,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const halo = new THREE.Sprite(haloMat);
      halo.position.set(x, 0.02, z);
      halo.scale.set(2.2, 2.2, 1);
      this.group.add(halo);
      this.haloSprites.push(halo);
      this.haloMats.push(haloMat);
    }
    this.applyTint();
  }

  private buildTrail(f: FloatMeta): THREE.Line | null {
    const traj = f.trajectory;
    if (!traj || traj.length < 2) return null;
    const pts = traj.map((p) => {
      const { x, z } = latLonToWorld(p.lat, p.lon, this.latRange, this.lonRange);
      return new THREE.Vector3(x, 0.05, z);
    });
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0x6ee4e4,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    return new THREE.Line(geom, mat);
  }

  setTimeIndex(t: number) {
    this.timeIndex = t;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      const f = this.floats[i];
      const traj = f?.trajectory;
      let lat = f?.lat ?? 0;
      let lon = f?.lon ?? 0;
      if (traj) {
        const step = traj.find((p) => p.t === t) ?? traj[traj.length - 1];
        if (step) {
          lat = step.lat;
          lon = step.lon;
        }
      }
      const { x, z } = latLonToWorld(lat, lon, this.latRange, this.lonRange);
      b.group.position.set(x, 0.8, z);
      if (this.haloSprites[i]) {
        this.haloSprites[i].position.set(x, 0.02, z);
      }
    }
  }

  setAnomalies(ids: string[], on: boolean) {
    this.anomalyIds = new Set(ids);
    this.anomalyOn = on;
    this.applyTint();
  }

  private applyTint() {
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      const anomalous = this.anomalyOn && this.anomalyIds.has(b.id);
      const color = anomalous ? 0xef4444 : 0xfb923c;
      b.hullMat.color.setHex(color);
      for (const m of b.nodeMats) m.color.setHex(anomalous ? 0xff7d7d : 0x2de0c8);
      this.haloMats[i].color.setHex(anomalous ? 0xff3030 : 0xffffff);
    }
  }

  setSelectedId(id: string | null) {
    this.selectedId = id;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      const isSelected = this.floatIds[i] === id;
      b.hullMat.color.setHex(isSelected ? 0xffffff : this.anomalyOn && this.anomalyIds.has(b.id) ? 0xef4444 : 0xfb923c);
      b.group.scale.setScalar(isSelected ? 1.45 : 1);
    }
  }

  setVisible(show: boolean) {
    this.group.visible = show;
  }

  reposition(latRange: [number, number], lonRange: [number, number]) {
    this.latRange = latRange;
    this.lonRange = lonRange;
    // Rebuild surface trails for the new mapping
    for (const b of this.bodies) {
      if (b.trail) {
        this.group.remove(b.trail);
        b.trail.geometry.dispose();
        (b.trail.material as THREE.Material).dispose();
        b.trail = null;
      }
      const f = this.floats.find((x) => x.id === b.id);
      if (f) {
        const trail = this.buildTrail(f);
        b.trail = trail;
        if (trail) this.group.add(trail);
      }
    }
    this.setTimeIndex(this.timeIndex);
  }

  raycast(raycaster: THREE.Raycaster): string | null {
    const targets: THREE.Object3D[] = [];
    for (const b of this.bodies) targets.push(b.hull);
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      const hull = hits[0].object;
      const b = this.bodies.find((x) => x.hull === hull);
      return b ? b.id : null;
    }
    return null;
  }

  updatePulse(time: number) {
    for (let i = 0; i < this.bodies.length; i++) {
      const isSelected = this.bodies[i].id === this.selectedId;
      const anomalous = this.anomalyIds.has(this.bodies[i].id) && this.anomalyOn;
      const base = isSelected ? 0.9 : anomalous ? 0.95 : 0.5;
      const pulse = 0.55 + 0.45 * Math.sin(time * 2 + i * 0.7);
      const mat = this.haloMats[i];
      mat.opacity = base * pulse;
      const s = (isSelected ? 2.9 : anomalous ? 3.2 : 2.3) * (1 + 0.08 * Math.sin(time * 1.6 + i * 0.9));
      this.haloSprites[i].scale.set(s, s, 1);
    }
  }

  private clear() {
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      for (const m of b.mats) m.dispose();
      if (b.trail) {
        b.trail.geometry.dispose();
        (b.trail.material as THREE.Material).dispose();
      }
    }
    for (const m of this.haloMats) m.dispose();
    this.group.clear();
    this.bodies = [];
    this.floatIds = [];
    this.haloSprites = [];
    this.haloMats = [];
  }

  dispose() {
    this.clear();
    this.haloTexture.dispose();
  }
}