export type GridCell = 'road' | 'obstacle' | 'inactive' | 'depot' | 'spawn';

export type TaskStatus = 'pending' | 'assigned' | 'picked' | 'completed';

export type VehicleState = 'idle' | 'to-pickup' | 'loading' | 'delivering' | 'unloading';

export type StopKind = 'pickup' | 'dropoff';

export type TaskLoadLevel = 'low' | 'medium' | 'high';

export type MapPreset = 'standard' | 'irregular';

export interface GridPoint {
  x: number;
  y: number;
}

export interface RouteStop {
  taskId: string;
  kind: StopKind;
  point: GridPoint;
}

export interface Task {
  id: string;
  color: string;
  pickup: GridPoint;
  dropoff: GridPoint;
  createdAt: number;
  assignedVehicleId: string | null;
  pickedAt: number | null;
  completedAt: number | null;
  status: TaskStatus;
  batchedAtPickup: boolean;
}

export interface Vehicle {
  id: string;
  color: string;
  capacity: number;
  load: number;
  position: GridPoint;
  displayPosition: {
    x: number;
    y: number;
  };
  routeStops: RouteStop[];
  onboardTaskIds: string[];
  state: VehicleState;
  activeStopKind: StopKind | null;
  operationRemainingMs: number;
  currentPath: GridPoint[];
  pathIndex: number;
  segmentProgress: number;
  busyTime: number;
}

export interface SimulationMetrics {
  completedTasks: number;
  pendingTasks: number;
  averageWaitMs: number;
  averageDeliveryMs: number;
  utilizationRate: number;
  batchingRate: number;
}

export interface SimulationMap {
  preset: MapPreset;
  width: number;
  height: number;
  cells: GridCell[][];
  roadPoints: GridPoint[];
  taskPoints: GridPoint[];
  depotPoints: GridPoint[];
}

export interface SimulationSnapshot {
  map: SimulationMap;
  tasks: Task[];
  vehicles: Vehicle[];
  metrics: SimulationMetrics;
  simulationTime: number;
  serviceDurationMs: number;
  taskLoadLevel: TaskLoadLevel;
  mapPreset: MapPreset;
  targetTasksPerMinute: number;
  speed: number;
  isRunning: boolean;
}

export interface SimulationConfig {
  width: number;
  height: number;
  vehicleCount: number;
  vehicleCapacity: number;
  minTaskIntervalMs: number;
  maxTaskIntervalMs: number;
  stepMs: number;
  baseCellTravelMs: number;
  serviceDurationMs: number;
  initialTaskLoadLevel: TaskLoadLevel;
  initialMapPreset: MapPreset;
  initialSpeed: number;
  rng: () => number;
}

export interface SimulationState {
  config: SimulationConfig;
  map: SimulationMap;
  tasks: Task[];
  vehicles: Vehicle[];
  simulationTime: number;
  taskLoadLevel: TaskLoadLevel;
  mapPreset: MapPreset;
  speed: number;
  isRunning: boolean;
  nextTaskId: number;
  nextTaskAt: number;
  totalWaitMs: number;
  totalDeliveryMs: number;
  batchedCompletions: number;
}

export interface SimulationController {
  start: () => void;
  pause: () => void;
  reset: () => void;
  setMapPreset: (preset: MapPreset) => void;
  setTaskLoadLevel: (level: TaskLoadLevel) => void;
  setSpeed: (multiplier: number) => void;
  subscribe: (listener: (snapshot: SimulationSnapshot) => void) => () => void;
  getSnapshot: () => SimulationSnapshot;
}
