import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { FieldResponse, FloatMeta } from "../../types/ocean";
import { buildFieldTexture, autoScaleBounds } from "../../lib/colormaps";

const WORLD_X_SPAN = 35; // lon 60..95
const WORLD_Z_SPAN = 25; // lat 0..25

function latLonToWorld(lat: number, lon: number, latRange: [number, number], lonRange: [number, number]): { x: number; z: number } {
  const x = ((lon - lonRange[0]) / (lonRange[1] - lonRange[0]) - 0.5) * WORLD_X_SPAN;
  const z = ((lat - latRange[0]) / (latRange[1] - latRange[0]) - 0.5) * WORLD_Z_SPAN;
  return { x, z };
}

export class OceanScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private surfaceMesh: THREE.Mesh | null = null;
  private markerGroup: THREE.Group;

  // Depth-layer stack (translucent planes below the surface)
  private oceanGroup: THREE.Group;
  private depthLayers: { mesh: THREE.Mesh; nominalDepth: number; baseOpacity: number }[] = [];
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
  private latRange: [number, number] = [0, 25];
  private lonRange: [number, number] = [60, 95];

  // Callbacks
  onFloatClick: ((id: string) => void) | null = null;
  onHover: ((info: { lat: number; lon: number; value: number | null } | null) => void) | null = null;

  // Internal marker data
  private markerMeshes: THREE.Mesh[] = [];
  private markerFloatIds: string[] = [];

  // Drag detection for raycasting
  private pointerDownPos = { x: 0, y: 0 };

  constructor(canvasContainer: HTMLElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    this.renderer.setClearColor(0x0b1220);
    canvasContainer.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050d1a, 0.0065);

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
  }

  setOpacity(opacity: number) {
    this.currentOpacity = opacity;
    if (this.surfaceMesh) {
      (this.surfaceMesh.material as THREE.MeshPhongMaterial).opacity = opacity;
    }
  }

  setFloats(floats: FloatMeta[]) {
    // Clear existing markers
    while (this.markerGroup.children.length > 0) {
      const child = this.markerGroup.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
      this.markerGroup.remove(child);
    }
    this.markerMeshes = [];
    this.markerFloatIds = [];

    const markerGeom = new THREE.SphereGeometry(0.4, 12, 12);

    for (const f of floats) {
      const { x, z } = latLonToWorld(f.lat, f.lon, this.latRange, this.lonRange);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });
      const mesh = new THREE.Mesh(markerGeom, markerMat);
      mesh.position.set(x, 0.8, z);
      mesh.userData = { floatId: f.id };
      this.markerGroup.add(mesh);
      this.markerMeshes.push(mesh);
      this.markerFloatIds.push(f.id);
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

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
