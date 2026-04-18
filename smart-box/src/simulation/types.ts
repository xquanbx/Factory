export type GridCell = 'road' | 'obstacle' | 'depot' | 'spawn';

export type TaskStatus = 'pending' | 'assigned' | 'picked' | 'completed';

export type VehicleState = 'idle' | 'to-pickup' | 'delivering';

export type StopKind = 'pickup' | 'dropoff';

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
  initialSpeed: number;
  rng: () => number;
}

export interface SimulationState {
  config: SimulationConfig;
  map: SimulationMap;
  tasks: Task[];
  vehicles: Vehicle[];
  simulationTime: number;
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
  setSpeed: (multiplier: number) => void;
  subscribe: (listener: (snapshot: SimulationSnapshot) => void) => () => void;
  getSnapshot: () => SimulationSnapshot;
}
