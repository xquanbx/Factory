import { useEffect, useMemo, useRef } from 'react';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  GlowLayer,
  HemisphericLight,
  LinesMesh,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { StageViewModel } from '../stage/view-model';

const TILE_SIZE = 1.7;
const ROAD_TILE_SCALE = 0.92;
const ROUTE_ELEVATION = 0.18;

interface BabylonStageProps {
  viewModel: StageViewModel;
  showVehicleRoutes: boolean;
}

interface SceneRoots {
  mapRoot: TransformNode;
  taskRoot: TransformNode;
  routeRoot: TransformNode;
  vehicleRoot: TransformNode;
}

interface MaterialCache {
  road: StandardMaterial;
  obstacle: StandardMaterial;
  inactive: StandardMaterial;
  emptySlot: StandardMaterial;
  taskFill: Map<string, StandardMaterial>;
  taskRing: Map<string, StandardMaterial>;
  vehicle: Map<string, StandardMaterial>;
}

interface RouteMeshState {
  mesh: LinesMesh;
  pointCount: number;
}

interface VehicleMeshState {
  root: TransformNode;
  body: Mesh;
  innerPanel: Mesh;
  slots: Mesh[];
  progressPlane: Mesh | null;
  progressTexture: DynamicTexture | null;
  progressMaterial: StandardMaterial | null;
}

function toWorldPosition(
  map: StageViewModel['map'],
  point: { x: number; y: number },
  y = 0,
) {
  const offsetX = (map.width - 1) / 2;
  const offsetY = (map.height - 1) / 2;

  return new Vector3((point.x - offsetX) * TILE_SIZE, y, (offsetY - point.y) * TILE_SIZE);
}

function createBaseMaterial(
  scene: Scene,
  name: string,
  color: string,
  options?: {
    emissive?: number;
    alpha?: number;
  },
) {
  const material = new StandardMaterial(name, scene);
  const baseColor = Color3.FromHexString(color);
  material.diffuseColor = baseColor;
  material.emissiveColor = baseColor.scale(options?.emissive ?? 0.18);
  material.specularColor = new Color3(0.08, 0.08, 0.08);
  material.alpha = options?.alpha ?? 1;
  return material;
}

function createMaterialCache(scene: Scene): MaterialCache {
  const emptySlot = new StandardMaterial('vehicle-slot-empty', scene);
  emptySlot.diffuseColor = new Color3(0.1, 0.16, 0.24);
  emptySlot.emissiveColor = new Color3(0.05, 0.08, 0.12);
  emptySlot.alpha = 0.7;

  return {
    road: createBaseMaterial(scene, 'road-cell', '#0f172a', { emissive: 0.1 }),
    obstacle: createBaseMaterial(scene, 'obstacle-cell', '#1e293b', { emissive: 0.16 }),
    inactive: createBaseMaterial(scene, 'inactive-cell', '#475569', {
      emissive: 0.08,
      alpha: 0.46,
    }),
    emptySlot,
    taskFill: new Map(),
    taskRing: new Map(),
    vehicle: new Map(),
  };
}

function getVehicleMaterial(scene: Scene, cache: MaterialCache, color: string) {
  const existing = cache.vehicle.get(color);
  if (existing) {
    return existing;
  }

  const material = createBaseMaterial(scene, `vehicle-${color}`, color, { emissive: 0.26 });
  cache.vehicle.set(color, material);
  return material;
}

function getTaskFillMaterial(scene: Scene, cache: MaterialCache, color: string) {
  const existing = cache.taskFill.get(color);
  if (existing) {
    return existing;
  }

  const material = createBaseMaterial(scene, `task-fill-${color}`, color, { emissive: 0.72 });
  cache.taskFill.set(color, material);
  return material;
}

function getTaskRingMaterial(scene: Scene, cache: MaterialCache, color: string) {
  const existing = cache.taskRing.get(color);
  if (existing) {
    return existing;
  }

  const material = createBaseMaterial(scene, `task-ring-${color}`, color, { emissive: 0.92 });
  material.alpha = 0.95;
  cache.taskRing.set(color, material);
  return material;
}

function disposeNodeChildren(root: TransformNode) {
  const children = root.getChildren();
  for (const child of children) {
    child.dispose(false, true);
  }
}

function drawProgressTexture(texture: DynamicTexture, trackColor: string, fillColor: string, ratio: number) {
  const context = texture.getContext();
  const width = texture.getSize().width;
  const height = texture.getSize().height;
  const padding = 8;
  const fillWidth = Math.max(0, Math.min(width - padding * 2, (width - padding * 2) * ratio));

  context.clearRect(0, 0, width, height);
  context.fillStyle = 'rgba(2, 6, 23, 0.82)';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = trackColor;
  context.lineWidth = 4;
  context.strokeRect(padding, padding, width - padding * 2, height - padding * 2);
  context.fillStyle = fillColor;
  context.fillRect(padding + 2, padding + 2, Math.max(fillWidth - 4, 0), height - padding * 2 - 4);
  texture.update();
}

function fitCamera(camera: ArcRotateCamera, map: StageViewModel['map']) {
  const maxSpan = Math.max(map.width, map.height) * TILE_SIZE;
  camera.setTarget(Vector3.Zero());
  camera.alpha = -Math.PI / 2;
  camera.beta = 0.92;
  camera.radius = Math.max(maxSpan * 1.15, 16);
  camera.lowerRadiusLimit = Math.max(maxSpan * 0.72, 12);
  camera.upperRadiusLimit = maxSpan * 1.95;
}

function buildStaticMap(
  scene: Scene,
  roots: SceneRoots,
  materials: MaterialCache,
  viewModel: StageViewModel,
) {
  disposeNodeChildren(roots.mapRoot);

  const base = MeshBuilder.CreateBox(
    'map-base',
    {
      width: viewModel.map.width * TILE_SIZE + 0.6,
      depth: viewModel.map.height * TILE_SIZE + 0.6,
      height: 0.12,
    },
    scene,
  );
  base.position = new Vector3(0, -0.06, 0);
  base.material = createBaseMaterial(scene, 'map-base-material', '#07101d', { emissive: 0.1 });
  base.parent = roots.mapRoot;

  for (const cell of viewModel.map.cells) {
    const isObstacle = cell.cell === 'obstacle';
    const height = isObstacle ? 1.18 : cell.cell === 'inactive' ? 0.08 : 0.14;
    const tile = MeshBuilder.CreateBox(
      `cell-${cell.x}-${cell.y}`,
      {
        width: TILE_SIZE * ROAD_TILE_SCALE,
        depth: TILE_SIZE * ROAD_TILE_SCALE,
        height,
      },
      scene,
    );
    tile.position = toWorldPosition(viewModel.map, cell, height / 2);
    tile.material =
      cell.cell === 'obstacle'
        ? materials.obstacle
        : cell.cell === 'inactive'
          ? materials.inactive
          : materials.road;
    tile.parent = roots.mapRoot;
  }
}

function buildTaskMarkers(
  scene: Scene,
  roots: SceneRoots,
  materials: MaterialCache,
  viewModel: StageViewModel,
  markerMeshes: Map<string, Mesh>,
) {
  const activeMarkerKeys = new Set<string>();

  for (const marker of viewModel.taskMarkers) {
    const markerKey = `${marker.kind}-${marker.taskId}`;
    activeMarkerKeys.add(markerKey);
    const position = toWorldPosition(viewModel.map, marker.point, marker.kind === 'pickup' ? 0.24 : 0.28);
    let mesh = markerMeshes.get(markerKey);

    if (!mesh) {
      mesh =
        marker.kind === 'pickup'
          ? MeshBuilder.CreateCylinder(
              `pickup-${marker.taskId}`,
              {
                diameter: TILE_SIZE * 0.24,
                height: 0.18,
                tessellation: 24,
              },
              scene,
            )
          : MeshBuilder.CreateTorus(
              `dropoff-${marker.taskId}`,
              {
                diameter: TILE_SIZE * 0.34,
                thickness: TILE_SIZE * 0.05,
                tessellation: 28,
              },
              scene,
            );
      mesh.parent = roots.taskRoot;
      markerMeshes.set(markerKey, mesh);
    }

    mesh.position = position;
    mesh.material =
      marker.kind === 'pickup'
        ? getTaskFillMaterial(scene, materials, marker.color)
        : getTaskRingMaterial(scene, materials, marker.color);
  }

  for (const [markerKey, mesh] of markerMeshes) {
    if (activeMarkerKeys.has(markerKey)) {
      continue;
    }

    mesh.dispose(false, true);
    markerMeshes.delete(markerKey);
  }
}

function buildRoutes(
  scene: Scene,
  roots: SceneRoots,
  viewModel: StageViewModel,
  showVehicleRoutes: boolean,
  routeMeshes: Map<string, RouteMeshState>,
) {
  const disposeRouteMesh = (vehicleId: string) => {
    const routeMesh = routeMeshes.get(vehicleId);
    if (!routeMesh) {
      return;
    }

    routeMesh.mesh.dispose(false, true);
    routeMeshes.delete(vehicleId);
  };

  if (!showVehicleRoutes) {
    for (const vehicleId of routeMeshes.keys()) {
      disposeRouteMesh(vehicleId);
    }
    return;
  }

  const activeVehicleIds = new Set<string>();

  for (const vehicle of viewModel.vehicles) {
    if (vehicle.routePoints.length < 2) {
      disposeRouteMesh(vehicle.id);
      continue;
    }

    activeVehicleIds.add(vehicle.id);
    const points = vehicle.routePoints.map((point) =>
      toWorldPosition(viewModel.map, point, ROUTE_ELEVATION),
    );
    const existing = routeMeshes.get(vehicle.id);
    const shouldRecreate = existing && existing.pointCount !== points.length;

    if (shouldRecreate) {
      disposeRouteMesh(vehicle.id);
    }

    const line = MeshBuilder.CreateDashedLines(
      `route-${vehicle.id}`,
      {
        points,
        dashSize: 0.26,
        gapSize: 0.14,
        dashNb: Math.max(12, points.length * 6),
        updatable: true,
        instance: shouldRecreate ? undefined : existing?.mesh,
      },
      scene,
    );
    line.color = Color3.FromHexString(vehicle.color);
    line.alpha = 0.82;
    if (!existing || shouldRecreate) {
      line.parent = roots.routeRoot;
      routeMeshes.set(vehicle.id, { mesh: line, pointCount: points.length });
      continue;
    }

    existing.pointCount = points.length;
  }

  for (const vehicleId of routeMeshes.keys()) {
    if (activeVehicleIds.has(vehicleId)) {
      continue;
    }

    disposeRouteMesh(vehicleId);
  }
}

function createVehicleMesh(
  scene: Scene,
  roots: SceneRoots,
  materials: MaterialCache,
  vehicle: StageViewModel['vehicles'][number],
) {
  const slotOffsets = [
    { x: -0.23, z: 0.23 },
    { x: 0.23, z: 0.23 },
    { x: -0.23, z: -0.23 },
    { x: 0.23, z: -0.23 },
  ];
  const root = new TransformNode(`vehicle-${vehicle.id}`, scene);
  root.parent = roots.vehicleRoot;

  const body = MeshBuilder.CreateBox(
    `vehicle-body-${vehicle.id}`,
    {
      width: TILE_SIZE * 0.6,
      depth: TILE_SIZE * 0.66,
      height: 0.3,
    },
    scene,
  );
  body.position.y = 0.23;
  body.parent = root;

  const innerPanel = MeshBuilder.CreateBox(
    `vehicle-panel-${vehicle.id}`,
    {
      width: TILE_SIZE * 0.44,
      depth: TILE_SIZE * 0.5,
      height: 0.06,
    },
    scene,
  );
  innerPanel.position.y = 0.42;
  innerPanel.parent = root;

  const slots = slotOffsets.map((offset, index) => {
    const slot = MeshBuilder.CreateSphere(
      `vehicle-slot-${vehicle.id}-${index}`,
      {
        diameter: TILE_SIZE * 0.12,
        segments: 12,
      },
      scene,
    );
    slot.position = new Vector3(offset.x, 0.48, offset.z);
    slot.parent = root;
    return slot;
  });

  const bodyMaterial = getVehicleMaterial(scene, materials, vehicle.color);
  body.material = bodyMaterial;
  innerPanel.material = bodyMaterial;

  return {
    root,
    body,
    innerPanel,
    slots,
    progressPlane: null,
    progressTexture: null,
    progressMaterial: null,
  };
}

function disposeVehicleProgress(vehicleMesh: VehicleMeshState) {
  vehicleMesh.progressPlane?.dispose(false, true);
  vehicleMesh.progressTexture?.dispose();
  vehicleMesh.progressMaterial?.dispose();
  vehicleMesh.progressPlane = null;
  vehicleMesh.progressTexture = null;
  vehicleMesh.progressMaterial = null;
}

function buildVehicles(
  scene: Scene,
  roots: SceneRoots,
  materials: MaterialCache,
  viewModel: StageViewModel,
  vehicleMeshes: Map<string, VehicleMeshState>,
) {
  const activeVehicleIds = new Set<string>();

  for (const vehicle of viewModel.vehicles) {
    activeVehicleIds.add(vehicle.id);

    let vehicleMesh = vehicleMeshes.get(vehicle.id);
    if (!vehicleMesh) {
      vehicleMesh = createVehicleMesh(scene, roots, materials, vehicle);
      vehicleMeshes.set(vehicle.id, vehicleMesh);
    }

    vehicleMesh.root.position.copyFrom(toWorldPosition(viewModel.map, vehicle.position, 0));

    const bodyMaterial = getVehicleMaterial(scene, materials, vehicle.color);
    vehicleMesh.body.material = bodyMaterial;
    vehicleMesh.innerPanel.material = bodyMaterial;

    vehicleMesh.slots.forEach((slot, index) => {
      const cargoColor = vehicle.cargoSlots[index];
      slot.material = cargoColor
        ? getTaskFillMaterial(scene, materials, cargoColor)
        : materials.emptySlot;
    });

    if (!vehicle.progress) {
      disposeVehicleProgress(vehicleMesh);
      continue;
    }

    if (!vehicleMesh.progressTexture || !vehicleMesh.progressMaterial || !vehicleMesh.progressPlane) {
      const progressTexture = new DynamicTexture(`vehicle-progress-${vehicle.id}`, {
        width: 256,
        height: 64,
      });
      progressTexture.hasAlpha = true;

      const progressMaterial = new StandardMaterial(`vehicle-progress-material-${vehicle.id}`, scene);
      progressMaterial.diffuseTexture = progressTexture;
      progressMaterial.opacityTexture = progressTexture;
      progressMaterial.emissiveColor = Color3.White();
      progressMaterial.disableLighting = true;
      progressMaterial.backFaceCulling = false;

      const progressPlane = MeshBuilder.CreatePlane(
        `vehicle-progress-plane-${vehicle.id}`,
        {
          width: TILE_SIZE * 0.72,
          height: 0.34,
        },
        scene,
      );
      progressPlane.position.y = 0.98;
      progressPlane.billboardMode = Mesh.BILLBOARDMODE_ALL;
      progressPlane.material = progressMaterial;
      progressPlane.parent = vehicleMesh.root;

      vehicleMesh.progressTexture = progressTexture;
      vehicleMesh.progressMaterial = progressMaterial;
      vehicleMesh.progressPlane = progressPlane;
    }

    drawProgressTexture(
      vehicleMesh.progressTexture,
      'rgba(226, 232, 240, 0.85)',
      vehicle.progress.color,
      vehicle.progress.filledRatio,
    );
  }

  for (const [vehicleId, vehicleMesh] of vehicleMeshes) {
    if (activeVehicleIds.has(vehicleId)) {
      continue;
    }

    disposeVehicleProgress(vehicleMesh);
    vehicleMesh.root.dispose(false, true);
    vehicleMeshes.delete(vehicleId);
  }
}

export function BabylonStage({ viewModel, showVehicleRoutes }: BabylonStageProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const rootsRef = useRef<SceneRoots | null>(null);
  const materialsRef = useRef<MaterialCache | null>(null);
  const taskMarkerMeshesRef = useRef<Map<string, Mesh>>(new Map());
  const routeMeshesRef = useRef<Map<string, RouteMeshState>>(new Map());
  const vehicleMeshesRef = useRef<Map<string, VehicleMeshState>>(new Map());

  const mapSignature = useMemo(
    () => `${viewModel.map.preset}:${viewModel.map.width}x${viewModel.map.height}`,
    [viewModel.map.height, viewModel.map.preset, viewModel.map.width],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;

    if (!canvas || !wrapper) {
      return;
    }

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.02, 0.04, 0.09, 1);

    const camera = new ArcRotateCamera('factory-camera', -Math.PI / 2, 0.92, 22, Vector3.Zero(), scene);
    camera.lowerAlphaLimit = -Math.PI / 2 - 0.35;
    camera.upperAlphaLimit = -Math.PI / 2 + 0.35;
    camera.lowerBetaLimit = 0.74;
    camera.upperBetaLimit = 1.08;
    camera.allowUpsideDown = false;
    camera.wheelDeltaPercentage = 0.01;
    camera.panningSensibility = 70;
    camera.attachControl(canvas, true);

    new HemisphericLight('factory-hemi', new Vector3(0.2, 1, 0.1), scene).intensity = 0.9;
    new DirectionalLight('factory-sun', new Vector3(-0.45, -1, -0.2), scene).intensity = 0.36;

    const glow = new GlowLayer('factory-glow', scene);
    glow.intensity = 0.52;

    const mapRoot = new TransformNode('map-root', scene);
    const taskRoot = new TransformNode('task-root', scene);
    const routeRoot = new TransformNode('route-root', scene);
    const vehicleRoot = new TransformNode('vehicle-root', scene);

    engine.runRenderLoop(() => {
      scene.render();
    });

    const resize = () => engine.resize();
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            resize();
          })
        : null;

    observer?.observe(wrapper);
    if (!observer) {
      window.addEventListener('resize', resize);
    }

    engineRef.current = engine;
    sceneRef.current = scene;
    cameraRef.current = camera;
    rootsRef.current = { mapRoot, taskRoot, routeRoot, vehicleRoot };
    materialsRef.current = createMaterialCache(scene);
    buildStaticMap(scene, rootsRef.current, materialsRef.current, viewModel);
    fitCamera(camera, viewModel.map);
    buildTaskMarkers(
      scene,
      rootsRef.current,
      materialsRef.current,
      viewModel,
      taskMarkerMeshesRef.current,
    );
    buildRoutes(scene, rootsRef.current, viewModel, showVehicleRoutes, routeMeshesRef.current);
    buildVehicles(
      scene,
      rootsRef.current,
      materialsRef.current,
      viewModel,
      vehicleMeshesRef.current,
    );

    return () => {
      observer?.disconnect();
      if (!observer) {
        window.removeEventListener('resize', resize);
      }
      glow.dispose();
      scene.dispose();
      engine.dispose();
      engineRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      rootsRef.current = null;
      materialsRef.current = null;
      taskMarkerMeshesRef.current.clear();
      routeMeshesRef.current.clear();
      vehicleMeshesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const roots = rootsRef.current;
    const materials = materialsRef.current;

    if (!scene || !camera || !roots || !materials) {
      return;
    }

    buildStaticMap(scene, roots, materials, viewModel);
    fitCamera(camera, viewModel.map);
  }, [mapSignature]);

  useEffect(() => {
    const scene = sceneRef.current;
    const roots = rootsRef.current;
    const materials = materialsRef.current;

    if (!scene || !roots || !materials) {
      return;
    }

    buildTaskMarkers(scene, roots, materials, viewModel, taskMarkerMeshesRef.current);
    buildRoutes(scene, roots, viewModel, showVehicleRoutes, routeMeshesRef.current);
    buildVehicles(scene, roots, materials, viewModel, vehicleMeshesRef.current);
  }, [showVehicleRoutes, viewModel]);

  return (
    <div ref={wrapperRef} className="stage-canvas babylon-canvas">
      <canvas ref={canvasRef} />
    </div>
  );
}
