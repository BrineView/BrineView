import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BathymetryResponse, FieldResponse, FloatMeta, GliderMeta } from "../../types/ocean";
import { WORLD_X_SPAN, WORLD_Z_SPAN } from "./helpers";
import { createTerrainMesh, disposeTerrain } from "./terrain";
import { createEnvironment, type EnvironmentObjects } from "./environment";
import { MarkerManager } from "./markers";
import { GliderManager } from "./gliders";
import { createSurfaceMesh, disposeSurface } from "./surface";

export class OceanScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private surfaceMesh: THREE.Mesh | null = null;
  private terrainMesh: THREE.Mesh | null = null;
  private markerGroup: THREE.Group;
  private markerManager: MarkerManager;
  private gliderGroup: THREE.Group;
  private gliderManager: GliderManager;
  private assimilatedMesh: THREE.Mesh | null = null;

  // Depth-layer stack (translucent planes below the surface)
  private oceanGroup: THREE.Group;
  private depthLayers: { mesh: THREE.Mesh; nominalDepth: number; baseOpacity: number }[] = [];
  private env: EnvironmentObjects;
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
  private showGliders = true;
  private showAssimilated = false;
  private assimilatedField: FieldResponse | null = null;
  private glidersCache: GliderMeta[] = [];
  private selectedFloatId: string | null = null;
  private latRange: [number, number] = [-4, 15];
  private lonRange: [number, number] = [92, 106];

  // Callbacks
  onFloatClick: ((id: string) => void) | null = null;
  onGliderClick: ((id: string) => void) | null = null;
  onHover: ((info: { lat: number; lon: number; value: number | null } | null) => void) | null = null;

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

    // Marker group + manager
    this.markerGroup = new THREE.Group();
    this.oceanGroup.add(this.markerGroup);
    this.markerManager = new MarkerManager(this.markerGroup);

    // Glider group + manager (drawn above the float layer)
    this.gliderGroup = new THREE.Group();
    this.oceanGroup.add(this.gliderGroup);
    this.gliderManager = new GliderManager(this.gliderGroup);

    // Translucent depth layers below the surface
    this.createDepthLayers();

    // Horizon environment — sky + sea + container + graticule
    this.env = createEnvironment(this.scene, this.oceanGroup);

    // Grid helper at the bottom of the water column
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

  setActiveDepth(depthMeters: number) {
    this.currentDepth = depthMeters;
    const logSel = Math.log(depthMeters + 1);

    for (const layer of this.depthLayers) {
      const logLayer = Math.log(layer.nominalDepth + 1);
      const d = Math.abs(logSel - logLayer);
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

    disposeSurface(this.surfaceMesh);
    this.surfaceMesh = null;

    this.surfaceMesh = createSurfaceMesh(field, colorscale, this.latRange, this.lonRange, this.currentOpacity);
    this.oceanGroup.add(this.surfaceMesh);
    this.setActiveDepth(this.currentDepth);
    this.env.rebuildGraticule(this.latRange, this.lonRange);
    this.syncSurfaceVisibility();
  }

  setOpacity(opacity: number) {
    this.currentOpacity = opacity;
    if (this.surfaceMesh) {
      (this.surfaceMesh.material as THREE.MeshPhongMaterial).opacity = opacity;
    }
  }

  setBathymetry(bathy: BathymetryResponse) {
    if (bathy.lat.length < 2 || bathy.lon.length < 2) return;

    this.latRange = [bathy.lat[0], bathy.lat[bathy.lat.length - 1]];
    this.lonRange = [bathy.lon[0], bathy.lon[bathy.lon.length - 1]];

    disposeTerrain(this.terrainMesh);
    this.terrainMesh = null;

    this.terrainMesh = createTerrainMesh(bathy, this.latRange, this.lonRange);
    if (this.terrainMesh) {
      this.oceanGroup.add(this.terrainMesh);
    }
    // Re-apply marker positions in case ranges changed
    this.markerManager.reposition(this.latRange, this.lonRange);
    if (this.glidersCache.length > 0) {
      this.gliderManager.setGliders(this.glidersCache, this.latRange, this.lonRange);
    }
    this.env.rebuildGraticule(this.latRange, this.lonRange);
  }

  setFloats(floats: FloatMeta[]) {
    this.markerManager.setFloats(floats, this.latRange, this.lonRange);
  }

  setGliders(gliders: GliderMeta[]) {
    this.glidersCache = gliders;
    this.gliderManager.setGliders(gliders, this.latRange, this.lonRange);
  }

  setSelectedFloatId(id: string | null) {
    this.selectedFloatId = id;
    this.markerManager.setSelectedId(id);
  }

  setSelectedGliderId(id: string | null) {
    this.gliderManager.setSelectedId(id);
  }

  setTimeIndex(t: number) {
    this.markerManager.setTimeIndex(t);
    this.gliderManager.setTimeIndex(t);
  }

  setAnomalyIds(ids: string[], active: boolean) {
    this.markerManager.setAnomalies(ids, active);
  }

  setShowFloats(show: boolean) {
    this.showFloats = show;
    this.markerManager.setVisible(show);
  }

  setShowGliders(show: boolean) {
    this.showGliders = show;
    this.gliderManager.setVisible(show);
  }

  setAssimilated(field: FieldResponse | null, colorscale: string) {
    this.assimilatedField = field;
    disposeSurface(this.assimilatedMesh);
    this.assimilatedMesh = null;
    if (field && field.lat.length > 1 && field.lon.length > 1) {
      this.assimilatedMesh = createSurfaceMesh(field, colorscale, this.latRange, this.lonRange, this.currentOpacity);
      this.oceanGroup.add(this.assimilatedMesh);
    }
    this.syncSurfaceVisibility();
  }

  setShowAssimilated(show: boolean) {
    this.showAssimilated = show;
    this.syncSurfaceVisibility();
  }

  private syncSurfaceVisibility() {
    const overlayActive = this.showAssimilated && this.assimilatedMesh !== null;
    if (this.surfaceMesh) this.surfaceMesh.visible = !overlayActive;
    if (this.assimilatedMesh) this.assimilatedMesh.visible = overlayActive;
  }

  private handlePointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (this.surfaceMesh && this.currentField) {
      const overlayActive = this.showAssimilated && this.assimilatedMesh !== null;
      const surface = overlayActive ? (this.assimilatedMesh as THREE.Mesh) : this.surfaceMesh;
      const field = overlayActive ? (this.assimilatedField as FieldResponse) : this.currentField;
      if (surface && field.lat.length > 1) {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObject(surface);
        if (hits.length > 0 && hits[0].uv) {
          const uv = hits[0].uv;
          const i = Math.round(uv.y * (field.lat.length - 1));
          const j = Math.round(uv.x * (field.lon.length - 1));
          if (i >= 0 && i < field.lat.length && j >= 0 && j < field.lon.length) {
            const lat = field.lat[i];
            const lon = field.lon[j];
            const value = field.values[i]?.[j] ?? null;
            this.onHover?.({ lat, lon, value });
            return;
          }
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
    if (Math.sqrt(dx * dx + dy * dy) > 5) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(p, this.camera);

    if (this.showGliders) {
      const gliderId = this.gliderManager.raycast(this.raycaster);
      if (gliderId) {
        this.onGliderClick?.(gliderId);
        return;
      }
    }
    if (this.showFloats) {
      const floatId = this.markerManager.raycast(this.raycaster);
      if (floatId) {
        this.onFloatClick?.(floatId);
      }
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

    const t = performance.now() * 0.00035;
    this.oceanGroup.position.y = Math.sin(t) * 0.3;
    this.oceanGroup.rotation.z = Math.sin(t * 0.6) * 0.003;

    this.markerManager.updatePulse(performance.now() * 0.0012);
    this.gliderManager.updatePulse(performance.now() * 0.0012);

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

    this.env.dispose(this.scene, this.oceanGroup);

    disposeTerrain(this.terrainMesh);
    this.terrainMesh = null;

    this.markerManager.dispose();
    this.gliderManager.dispose();
    disposeSurface(this.assimilatedMesh);
    this.assimilatedMesh = null;

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
