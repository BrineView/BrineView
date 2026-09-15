import * as THREE from "three";
import { niceTickStep, tickValues, formatTick, WORLD_X_SPAN, WORLD_Z_SPAN, latLonToWorld } from "./helpers";

function makeLabel(text: string, x: number, y: number, z: number, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "500 42px 'IBM Plex Mono', monospace";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    fog: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(x, y, z);
  sprite.scale.set(3.4, 0.85, 1);
  return sprite;
}

function createContainer(oceanGroup: THREE.Group): THREE.Group {
  const containerGroup = new THREE.Group();

  const PAD = 0.75;
  const HALF_X = WORLD_X_SPAN / 2;
  const HALF_Z = WORLD_Z_SPAN / 2;
  const FLOOR_Y = -36;
  const TOP_Y = 2;
  const H = TOP_Y - FLOOR_Y;
  const CENTER_Y = (TOP_Y + FLOOR_Y) / 2;

  const shellMat = new THREE.MeshPhongMaterial({
    color: 0x0d3a63,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
    emissive: 0x051c36,
    emissiveIntensity: 0.65,
    shininess: 12,
    specular: 0x0a2a4a,
  });

  const ew = WORLD_Z_SPAN + PAD * 2;
  const ns = WORLD_X_SPAN + PAD * 2;

  const east = new THREE.Mesh(new THREE.PlaneGeometry(ew, H), shellMat);
  east.rotation.y = -Math.PI / 2;
  east.position.set(HALF_X + PAD, CENTER_Y, 0);

  const west = new THREE.Mesh(new THREE.PlaneGeometry(ew, H), shellMat);
  west.rotation.y = Math.PI / 2;
  west.position.set(-HALF_X - PAD, CENTER_Y, 0);

  const south = new THREE.Mesh(new THREE.PlaneGeometry(ns, H), shellMat);
  south.rotation.y = Math.PI;
  south.position.set(0, CENTER_Y, HALF_Z + PAD);

  const north = new THREE.Mesh(new THREE.PlaneGeometry(ns, H), shellMat);
  north.position.set(0, CENTER_Y, -HALF_Z - PAD);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_X_SPAN + PAD * 2, WORLD_Z_SPAN + PAD * 2), shellMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, FLOOR_Y, 0);

  for (const m of [east, west, south, north, floor]) {
    containerGroup.add(m);
  }
  oceanGroup.add(containerGroup);
  return containerGroup;
}

export interface EnvironmentObjects {
  containerGroup: THREE.Group;
  skyMesh: THREE.Mesh;
  seaPlane: THREE.Mesh;
  waterline: THREE.Line;
  graticule: THREE.Group;
  rebuildGraticule: (latRange: [number, number], lonRange: [number, number]) => void;
  dispose: (scene: THREE.Scene, oceanGroup: THREE.Group) => void;
}

export function createEnvironment(scene: THREE.Scene, oceanGroup: THREE.Group): EnvironmentObjects {
  const containerGroup = createContainer(oceanGroup);

  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 4;
  skyCanvas.height = 256;
  const sctx = skyCanvas.getContext("2d")!;
  const grad = sctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#02060d");
  grad.addColorStop(0.45, "#081527");
  grad.addColorStop(0.72, "#0c2240");
  grad.addColorStop(0.9, "#123357");
  grad.addColorStop(1, "#0b2450");
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 4, 256);

  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(360, 32, 16), skyMat);
  scene.add(skyMesh);

  const OUTER = 280;
  const holeX = WORLD_X_SPAN / 2 + 0.4;
  const holeZ = WORLD_Z_SPAN / 2 + 0.4;

  const shape = new THREE.Shape();
  shape.moveTo(-OUTER, -OUTER);
  shape.lineTo(OUTER, -OUTER);
  shape.lineTo(OUTER, OUTER);
  shape.lineTo(-OUTER, OUTER);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-holeX, -holeZ);
  hole.lineTo(holeX, -holeZ);
  hole.lineTo(holeX, holeZ);
  hole.lineTo(-holeX, holeZ);
  hole.closePath();
  shape.holes.push(hole);

  const seaGeom = new THREE.ShapeGeometry(shape, 1);
  seaGeom.rotateX(-Math.PI / 2);
  const seaMat = new THREE.MeshPhongMaterial({
    color: 0x0d2c52,
    emissive: 0x06203a,
    emissiveIntensity: 0.55,
    shininess: 42,
    specular: 0x1e4a77,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
  });
  const seaPlane = new THREE.Mesh(seaGeom, seaMat);
  seaPlane.position.y = -0.05;
  oceanGroup.add(seaPlane);

  const cx = WORLD_X_SPAN / 2 + 0.08;
  const cz = WORLD_Z_SPAN / 2 + 0.08;
  const linePts = [
    new THREE.Vector3(-cx, 0.02, -cz),
    new THREE.Vector3(cx, 0.02, -cz),
    new THREE.Vector3(cx, 0.02, cz),
    new THREE.Vector3(-cx, 0.02, cz),
    new THREE.Vector3(-cx, 0.02, -cz),
  ];
  const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x2de0c8,
    transparent: true,
    opacity: 0.4,
  });
  const waterline = new THREE.Line(lineGeom, lineMat);
  oceanGroup.add(waterline);

  const graticule = new THREE.Group();
  oceanGroup.add(graticule);

  function rebuildGraticule(latRange: [number, number], lonRange: [number, number]) {
    while (graticule.children.length > 0) {
      const child = graticule.children[0];
      if (child instanceof THREE.Sprite) {
        child.material.map?.dispose();
        (child.material as THREE.Material).dispose();
      } else if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
      graticule.remove(child);
    }

    const [lat0, lat1] = latRange;
    const [lon0, lon1] = lonRange;
    const tickMat = new THREE.LineBasicMaterial({
      color: 0x5bb6d8,
      transparent: true,
      opacity: 0.45,
    });

    const lons = tickValues(lon0, lon1, niceTickStep(lon1 - lon0));
    for (const lon of lons) {
      const { x } = latLonToWorld(lat0, lon, latRange, lonRange);
      const tickPts = [
        new THREE.Vector3(x, -0.02, WORLD_Z_SPAN / 2 + 0.2),
        new THREE.Vector3(x, -0.55, WORLD_Z_SPAN / 2 + 0.2),
      ];
      graticule.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tickPts), tickMat));
      const hemi = lon < 0 ? "W" : "E";
      graticule.add(
        makeLabel(`${formatTick(lon)}°${hemi}`, x, 0, WORLD_Z_SPAN / 2 + 2.1, "#8fc7d8"),
      );
    }

    const lats = tickValues(lat0, lat1, niceTickStep(lat1 - lat0));
    for (const lat of lats) {
      const { z } = latLonToWorld(lat, lon0, latRange, lonRange);
      const tickPts = [
        new THREE.Vector3(WORLD_X_SPAN / 2 + 0.2, -0.02, z),
        new THREE.Vector3(WORLD_X_SPAN / 2 + 0.55, -0.02, z),
      ];
      graticule.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tickPts), tickMat));
      const sign = lat < 0 ? "−" : "";
      graticule.add(
        makeLabel(`${sign}${formatTick(Math.abs(lat))}°`, WORLD_X_SPAN / 2 + 2.1, 0, z, "#8fc7d8"),
      );
    }
  }

  function dispose(scene: THREE.Scene, oceanGroup: THREE.Group) {
    containerGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    oceanGroup.remove(containerGroup);

    skyMesh.geometry.dispose();
    const mat = skyMesh.material as THREE.MeshBasicMaterial;
    mat.map?.dispose();
    mat.dispose();
    scene.remove(skyMesh);

    seaPlane.geometry.dispose();
    (seaPlane.material as THREE.Material).dispose();
    oceanGroup.remove(seaPlane);

    waterline.geometry.dispose();
    (waterline.material as THREE.Material).dispose();
    oceanGroup.remove(waterline);

    graticule.traverse((obj) => {
      if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        (obj.material as THREE.Material).dispose();
      } else if (obj instanceof THREE.Line) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    oceanGroup.remove(graticule);
  }

  return { containerGroup, skyMesh, seaPlane, waterline, graticule, rebuildGraticule, dispose };
}
