import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BathymetryResponse, FieldResponse, FloatMeta } from "../../types/ocean";
import { buildFieldTexture, autoScaleBounds } from "../../lib/colormaps";

const WORLD_X_SPAN = 35; // lon 92..106
const WORLD_Z_SPAN = 25; // lat -4..15

// World-units per metre of terrain elevation: −5939 m trench → ~ −18
const TERRAIN_SCALE = 0.003;

function latLonToWorld(lat: number, lon: number, latRange: [number, number], lonRange: [number, number]): { x: number; z: number } {
  const x = ((lon - lonRange[0]) / (lonRange[1] - lonRange[0]) - 0.5) * WORLD_X_SPAN;
  const z = ((lat - latRange[0]) / (latRange[1] - latRange[0]) - 0.5) * WORLD_Z_SPAN;
  return { x, z };
}

type RGB = [number, number, number];

/** Elevation (m, sea level = 0) → terrain vertex colour. */
function terrainColor(z: number): RGB {
  if (z >= 800) return [142, 112, 60]; // high land (brown)
  if (z >= 200) return [112, 138, 62]; // lowland (olive green)
  if (z >= 0) return [84, 150, 74]; // coast (green)
  if (z >= -200) return [47, 127, 191]; // shallow shelf
  if (z >= -1000) return [27, 90, 167]; // continental slope
  if (z >= -2500) return [16, 58, 122]; // deep sea
  return [10, 31, 77]; // abyss / trench
}

/** Radial glow used under the Argo markers. */
function makeHaloTexture(): THREE.Texture {
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
function niceTickStep(width: number): number {
  const nice = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  for (const s of nice) {
    if (Math.ceil(width / s) <= 9) return s;
  }
  return 100;
}

/** Evenly spaced tick values inside [min, max] at a given step. */
function tickValues(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(min / step) * step;
  for (let v = first; v <= max + 1e-9; v += step) {
    out.push(parseFloat(v.toFixed(2)));
    if (out.length > 40) break;
  }
  return out;
}

/** Compact tick label (drop trailing float noise / .0). */
function formatTick(v: number): string {
  const rounded = parseFloat(v.toFixed(1));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export class OceanScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private surfaceMesh: THREE.Mesh | null = null;
  private terrainMesh: THREE.Mesh | null = null;
  private markerGroup: THREE.Group;

  // Depth-layer stack (translucent planes below the surface)
  private oceanGroup: THREE.Group;
  private depthLayers: { mesh: THREE.Mesh; nominalDepth: number; baseOpacity: number }[] = [];
  private containerGroup: THREE.Group | null = null;
  private skyMesh: THREE.Mesh | null = null;
  private seaPlane: THREE.Mesh | null = null;
  private waterline: THREE.Line | null = null;
  private graticule: THREE.Group | null = null;
  private currentDepth = 0;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private animFrameId = 0;
  private disposed = false;

  // State
  private currentField: FieldResponse | null = null;
  private currentColorscale = "thermal";
  private currentOpacity = 1;
  private showFloats = true;
  private selectedFloatId: string | null = null;
  private latRange: [number, number] = [-4, 15];
  private lonRange: [number, number] = [92, 106];

  // Callbacks
  onFloatClick: ((id: string) => void) | null = null;
  onHover: ((info: { lat: number; lon: number; value: number | null } | null) => void) | null = null;

  // Internal marker data
  private markerMeshes: THREE.Mesh[] = [];
  private markerFloatIds: string[] = [];
  private haloMeshes: THREE.Sprite[] = [];
  private _markerFloats: FloatMeta[] = [];

  // Drag detection for raycasting
  private pointerDownPos = { x: 0, y: 0 };

  constructor(canvasContainer: HTMLElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    this.renderer.setClearColor(0x0b2450);
    canvasContainer.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b2450, 0.0045);

    // Lighting — soft ambient + a cool directional key light
    const ambientLight = new THREE.AmbientLight(0x9fc7e8, 0.95);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xcfe8ff, 0.6);
    dirLight.position.set(14, 40, 18);
    this.scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0x0a76b8, 0.3);
    backLight.position.set(-18, 10, -24);
    this.scene.add(backLight);

    // Camera
    const aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 500);
    this.camera.position.set(0, 35, 42);
    this.camera.lookAt(0, 0, 0);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 120;
    this.controls.target.set(0, 0, 0);

    // Ocean group — everything water-related moves together (gentle heave)
    this.oceanGroup = new THREE.Group();
    this.scene.add(this.oceanGroup);

    // Marker group
    this.markerGroup = new THREE.Group();
    this.oceanGroup.add(this.markerGroup);

    // Translucent depth layers below the surface
    this.createDepthLayers();

    // Enclosing volume so the ocean block reads as a solid water column
    this.createContainer();

    // Horizon environment — sky + sea stretching out from the data block
    this.createEnvironment();

    // Add grid helper (subtle) at the bottom of the water column
    const gridHelper = new THREE.GridHelper(WORLD_X_SPAN, 20, 0x1e293b, 0x111827);
    gridHelper.position.y = -35;
    this.oceanGroup.add(gridHelper);

    // Events
    this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);

    // Start animation loop
    this.animate();
  }

  /**
   * Build a stack of translucent horizontal planes below the surface.
   * Each plane represents an ocean depth band; deeper bands are darker,
   * more transparent, and spaced on a log-ish curve to mimic real depth.
   */
  private createDepthLayers() {
    type LayerDef = { y: number; nominalDepth: number; opacity: number; color: number };
    const layers: LayerDef[] = [
      { y: -3, nominalDepth: 10, opacity: 0.28, color: 0x1788d0 },
      { y: -8, nominalDepth: 50, opacity: 0.23, color: 0x1168b0 },
      { y: -14, nominalDepth: 150, opacity: 0.19, color: 0x0c4e94 },
      { y: -21, nominalDepth: 400, opacity: 0.15, color: 0x083877 },
      { y: -28, nominalDepth: 750, opacity: 0.11, color: 0x052457 },
      { y: -34, nominalDepth: 1000, opacity: 0.08, color: 0x03143a },
    ];

    const geom = new THREE.PlaneGeometry(WORLD_X_SPAN, WORLD_Z_SPAN);

    for (const l of layers) {
      const mat = new THREE.MeshPhongMaterial({
        color: l.color,
        transparent: true,
        opacity: l.opacity,
        side: THREE.DoubleSide,
        shininess: 20,
        specular: 0x112233,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = l.y;
      this.oceanGroup.add(mesh);
      this.depthLayers.push({ mesh, nominalDepth: l.nominalDepth, baseOpacity: l.opacity });
    }
  }

  /**
   * Build a translucent "aquarium" shell around the data block. It wraps the
   * four sides and floors the volume, so instead of a lone slab floating in
   * the void the ocean looks like a contained water column.
   */
  private createContainer() {
    this.containerGroup = new THREE.Group();

    const PAD = 0.75;
    const HALF_X = WORLD_X_SPAN / 2;
    const HALF_Z = WORLD_Z_SPAN / 2;
    const FLOOR_Y = -36;
    const TOP_Y = 2;
    const H = TOP_Y - FLOOR_Y; // 38
    const CENTER_Y = (TOP_Y + FLOOR_Y) / 2; // -17

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

    const ew = WORLD_Z_SPAN + PAD * 2; // east/west walls' width (along Z)
    const ns = WORLD_X_SPAN + PAD * 2; // north/south walls' width (along X)

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
      this.containerGroup.add(m);
    }
    this.oceanGroup.add(this.containerGroup);
  }

  /**
   * Ground the data block in an actual ocean-scape instead of a void:
   * a gradient sky dome, an endless-looking sea that meets the horizon,
   * a faint bioluminescent waterline around the data area, and a
   * lat/lon graticule so the scene reads as a scientific instrument.
   */
  private createEnvironment() {
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
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(360, 32, 16), skyMat);
    this.scene.add(this.skyMesh);

    // Horizon sea — a big plane with a hole matching the data footprint, so the
    // trench stays visible while the water visibly continues to the horizon.
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
    this.seaPlane = new THREE.Mesh(seaGeom, seaMat);
    this.seaPlane.position.y = -0.05;
    this.oceanGroup.add(this.seaPlane);

    // Bioluminescent waterline frame around the data block
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
    this.waterline = new THREE.Line(lineGeom, lineMat);
    this.oceanGroup.add(this.waterline);

    // Graticule — lon labels along the south edge, lat labels along the east
    // edge. Content is rebuilt from the live dataset range (rebuildGraticule).
    this.graticule = new THREE.Group();
    this.oceanGroup.add(this.graticule);
    this.rebuildGraticule();
  }

  /**
   * Rebuild the graticule axis labels from the *live* dataset range, so the
   * coordinates shown always match the data on screen.
   */
  private rebuildGraticule() {
    if (!this.graticule) return;

    while (this.graticule.children.length > 0) {
      const child = this.graticule.children[0];
      if (child instanceof THREE.Sprite) {
        child.material.map?.dispose();
        (child.material as THREE.Material).dispose();
      } else if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
      this.graticule.remove(child);
    }

    const [lat0, lat1] = this.latRange;
    const [lon0, lon1] = this.lonRange;
    const tickMat = new THREE.LineBasicMaterial({
      color: 0x5bb6d8,
      transparent: true,
      opacity: 0.45,
    });

    const lons = tickValues(lon0, lon1, niceTickStep(lon1 - lon0));
    for (const lon of lons) {
      const { x } = latLonToWorld(lat0, lon, this.latRange, this.lonRange);
      const tickPts = [
        new THREE.Vector3(x, -0.02, WORLD_Z_SPAN / 2 + 0.2),
        new THREE.Vector3(x, -0.55, WORLD_Z_SPAN / 2 + 0.2),
      ];
      this.graticule.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tickPts), tickMat));
      const hemi = lon < 0 ? "W" : "E";
      this.graticule.add(
        this.makeLabel(`${formatTick(lon)}°${hemi}`, x, 0, WORLD_Z_SPAN / 2 + 2.1, "#8fc7d8"),
      );
    }

    const lats = tickValues(lat0, lat1, niceTickStep(lat1 - lat0));
    for (const lat of lats) {
      const { z } = latLonToWorld(lat, lon0, this.latRange, this.lonRange);
      const tickPts = [
        new THREE.Vector3(WORLD_X_SPAN / 2 + 0.2, -0.02, z),
        new THREE.Vector3(WORLD_X_SPAN / 2 + 0.55, -0.02, z),
      ];
      this.graticule.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tickPts), tickMat));
      const sign = lat < 0 ? "−" : "";
      this.graticule.add(
        this.makeLabel(`${sign}${formatTick(Math.abs(lat))}°`, WORLD_X_SPAN / 2 + 2.1, 0, z, "#8fc7d8"),
      );
    }
  }

  /** Sprite text label for the graticule (always faces the camera). */
  private makeLabel(text: string, x: number, y: number, z: number, color: string) {
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

  /**
   * Sync layer visibility with the currently selected depth.
   * Layers closest to the selected depth brighten; distant ones fade,
   * giving a "you are here" depth cue through the water column.
   */
  setActiveDepth(depthMeters: number) {
    this.currentDepth = depthMeters;
    const logSel = Math.log(depthMeters + 1);

    for (const layer of this.depthLayers) {
      const logLayer = Math.log(layer.nominalDepth + 1);
      const d = Math.abs(logSel - logLayer);
      // Gaussian falloff in log-depth space
      const proximity = Math.exp(-(d * d) / (2 * 0.9 * 0.9));
      const newOpacity = layer.baseOpacity * (0.18 + 0.82 * proximity);
      (layer.mesh.material as THREE.MeshPhongMaterial).opacity = newOpacity;
    }
  }

  setField(field: FieldResponse, colorscale: string) {
    this.currentField = field;
    this.currentColorscale = colorscale;

    if (field.lat.length > 1) {
      this.latRange = [field.lat[0], field.lat[field.lat.length - 1]];
      this.lonRange = [field.lon[0], field.lon[field.lon.length - 1]];
    }

    // Remove old mesh
    if (this.surfaceMesh) {
      this.oceanGroup.remove(this.surfaceMesh);
      this.surfaceMesh.geometry.dispose();
      (this.surfaceMesh.material as THREE.Material).dispose();
      this.surfaceMesh = null;
    }

    const nLat = field.lat.length;
    const nLon = field.lon.length;

    // Build texture
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

    // Build geometry with explicit UVs
    const positions = new Float32Array(nLat * nLon * 3);
    const uvs = new Float32Array(nLat * nLon * 2);
    const indices: number[] = [];

    for (let i = 0; i < nLat; i++) {
      for (let j = 0; j < nLon; j++) {
        const idx = i * nLon + j;
        const lat = field.lat[i];
        const lon = field.lon[j];
        const { x, z } = latLonToWorld(lat, lon, this.latRange, this.lonRange);
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
      opacity: this.currentOpacity,
      side: THREE.DoubleSide,
      emissive: 0x0a1726,
      emissiveIntensity: 0.25,
      shininess: 12,
      specular: 0x112233,
    });

    this.surfaceMesh = new THREE.Mesh(geom, material);
    this.oceanGroup.add(this.surfaceMesh);
    this.setActiveDepth(this.currentDepth);
    this.rebuildGraticule();
  }

  setOpacity(opacity: number) {
    this.currentOpacity = opacity;
    if (this.surfaceMesh) {
      (this.surfaceMesh.material as THREE.MeshPhongMaterial).opacity = opacity;
    }
  }

  /**
   * Render the real sea floor (GMRT) as terrain beneath the variable surface.
   * Vertices are displaced by elevation·TERRAIN_SCALE, land (z ≥ 0) rises
   * above the water line as islands, and each vertex is colored by depth band.
   */
  setBathymetry(bathy: BathymetryResponse) {
    if (bathy.lat.length < 2 || bathy.lon.length < 2) return;

    this.latRange = [bathy.lat[0], bathy.lat[bathy.lat.length - 1]];
    this.lonRange = [bathy.lon[0], bathy.lon[bathy.lon.length - 1]];

    // Dispose old terrain
    if (this.terrainMesh) {
      this.oceanGroup.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
      this.terrainMesh = null;
    }

    const nLat = bathy.lat.length;
    const nLon = bathy.lon.length;

    const positions = new Float32Array(nLat * nLon * 3);
    const colors = new Float32Array(nLat * nLon * 3);
    const indices: number[] = [];

    for (let i = 0; i < nLat; i++) {
      for (let j = 0; j < nLon; j++) {
        const idx = i * nLon + j;
        const z = bathy.values[i]?.[j] ?? null;
        const { x, z: wz } = latLonToWorld(bathy.lat[i], bathy.lon[j], this.latRange, this.lonRange);
        positions[idx * 3] = x;
        // Land rises above the water line; seabed drops below it.
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

    this.terrainMesh = new THREE.Mesh(geom, material);
    this.oceanGroup.add(this.terrainMesh);
    // Re-apply marker positions in case ranges changed
    if (this.markerMeshes.length > 0) {
      this.repositionMarkers();
    }
    this.rebuildGraticule();
  }

  private repositionMarkers() {
    for (const mesh of this.markerMeshes) {
      const fid = mesh.userData.floatId as string;
      const idx = this.markerFloatIds.indexOf(fid);
      if (idx < 0) continue;
      // floats are stored as FloatMeta[]; keep a lightweight lookup
      const f = this._markerFloats[idx];
      if (!f) continue;
      const { x, z } = latLonToWorld(f.lat, f.lon, this.latRange, this.lonRange);
      mesh.position.set(x, 0.8, z);
    }
  }

  setFloats(floats: FloatMeta[]) {
    this._markerFloats = floats;
    // Clear existing markers and halo sprites
    while (this.markerGroup.children.length > 0) {
      const child = this.markerGroup.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      } else if (child instanceof THREE.Sprite) {
        child.material.map?.dispose();
        (child.material as THREE.Material).dispose();
      }
      this.markerGroup.remove(child);
    }
    this.markerMeshes = [];
    this.markerFloatIds = [];
    this.haloMeshes = [];

    const markerGeom = new THREE.SphereGeometry(0.4, 12, 12);
    const haloTex = makeHaloTexture();

    for (const f of floats) {
      const { x, z } = latLonToWorld(f.lat, f.lon, this.latRange, this.lonRange);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });
      const mesh = new THREE.Mesh(markerGeom, markerMat);
      mesh.position.set(x, 0.8, z);
      mesh.userData = { floatId: f.id };
      this.markerGroup.add(mesh);
      this.markerMeshes.push(mesh);
      this.markerFloatIds.push(f.id);

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: haloTex,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        }),
      );
      halo.position.set(x, 0.07, z);
      halo.scale.set(2.2, 2.2, 1);
      this.markerGroup.add(halo);
      this.haloMeshes.push(halo);
    }
  }

  setSelectedFloatId(id: string | null) {
    this.selectedFloatId = id;
    for (let i = 0; i < this.markerMeshes.length; i++) {
      const mesh = this.markerMeshes[i];
      const isSelected = this.markerFloatIds[i] === id;
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(
        isSelected ? 0xffffff : 0xfb923c,
      );
      const scale = isSelected ? 1.5 : 1;
      mesh.scale.setScalar(scale);
    }
  }

  setShowFloats(show: boolean) {
    this.showFloats = show;
    this.markerGroup.visible = show;
  }

  private handlePointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Hover on surface mesh
    if (this.surfaceMesh && this.currentField) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObject(this.surfaceMesh);
      if (hits.length > 0 && hits[0].uv) {
        const uv = hits[0].uv;
        const i = Math.round(uv.y * (this.currentField.lat.length - 1));
        const j = Math.round(uv.x * (this.currentField.lon.length - 1));
        if (i >= 0 && i < this.currentField.lat.length && j >= 0 && j < this.currentField.lon.length) {
          const lat = this.currentField.lat[i];
          const lon = this.currentField.lon[j];
          const value = this.currentField.values[i]?.[j] ?? null;
          this.onHover?.({ lat, lon, value });
          return;
        }
      }
    }
    this.onHover?.(null);
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDownPos.x = e.clientX;
    this.pointerDownPos.y = e.clientY;
  };

  private handlePointerUp = (e: PointerEvent) => {
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) return; // was a drag

    if (!this.showFloats) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(p, this.camera);

    // Check float markers
    const hits = this.raycaster.intersectObjects(this.markerMeshes);
    if (hits.length > 0 && hits[0].object.userData.floatId) {
      this.onFloatClick?.(hits[0].object.userData.floatId);
    }
  };

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate = () => {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame(this.animate);
    this.controls.update();

    // Gentle swell heave — simulates living ocean motion (does not fight OrbitControls)
    const t = performance.now() * 0.00035;
    this.oceanGroup.position.y = Math.sin(t) * 0.3;
    this.oceanGroup.rotation.z = Math.sin(t * 0.6) * 0.003;

    // Pulsing bioluminescent halos under the Argo float markers
    const hp = performance.now() * 0.0012;
    for (let i = 0; i < this.haloMeshes.length; i++) {
      const isSelected = this.markerFloatIds[i] === this.selectedFloatId;
      const base = isSelected ? 0.9 : 0.5;
      const pulse = 0.55 + 0.45 * Math.sin(hp * 2 + i * 0.7);
      (this.haloMeshes[i].material as THREE.SpriteMaterial).opacity = base * pulse;
      const s = (isSelected ? 2.9 : 2.3) * (1 + 0.08 * Math.sin(hp * 1.6 + i * 0.9));
      this.haloMeshes[i].scale.set(s, s, 1);
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animFrameId);
    this.renderer.domElement.removeEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.controls.dispose();

    // Dispose depth-layer geometry & materials
    for (const layer of this.depthLayers) {
      layer.mesh.geometry.dispose();
      (layer.mesh.material as THREE.Material).dispose();
    }
    this.depthLayers = [];

    if (this.containerGroup) {
      this.containerGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      this.oceanGroup.remove(this.containerGroup);
      this.containerGroup = null;
    }

    if (this.skyMesh) {
      this.skyMesh.geometry.dispose();
      const mat = this.skyMesh.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
      this.scene.remove(this.skyMesh);
      this.skyMesh = null;
    }
    if (this.seaPlane) {
      this.seaPlane.geometry.dispose();
      (this.seaPlane.material as THREE.Material).dispose();
      this.oceanGroup.remove(this.seaPlane);
      this.seaPlane = null;
    }
    if (this.waterline) {
      this.waterline.geometry.dispose();
      (this.waterline.material as THREE.Material).dispose();
      this.oceanGroup.remove(this.waterline);
      this.waterline = null;
    }
    if (this.graticule) {
      this.graticule.traverse((obj) => {
        if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          (obj.material as THREE.Material).dispose();
        } else if (obj instanceof THREE.Line) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      this.oceanGroup.remove(this.graticule);
      this.graticule = null;
    }

    if (this.terrainMesh) {
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
      this.terrainMesh = null;
    }

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
