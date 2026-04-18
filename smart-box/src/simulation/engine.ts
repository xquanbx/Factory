import { dispatchPendingTasks, hasAdditionalAssignedTasks } from './dispatcher';
import { createFactoryMap } from './map';
import { findShortestPath } from './pathfinding';
import type {
  GridPoint,
  RouteStop,
  SimulationConfig,
  SimulationController,
  SimulationMetrics,
  SimulationSnapshot,
  SimulationState,
  Task,
  Vehicle,
  VehicleState,
} from './types';

const TASK_COLORS = [
  '#f97316',
  '#22c55e',
  '#38bdf8',
  '#f43f5e',
  '#a855f7',
  '#eab308',
  '#14b8a6',
  '#fb7185',
  '#8b5cf6',
  '#84cc16',
  '#06b6d4',
  '#f59e0b',
];

const VEHICLE_COLORS = ['#93c5fd', '#fca5a5', '#86efac', '#fde68a', '#c4b5fd'];

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  width: 16,
  height: 10,
  vehicleCount: 5,
  vehicleCapacity: 3,
  minTaskIntervalMs: 1500,
  maxTaskIntervalMs: 3500,
  stepMs: 40,
  baseCellTravelMs: 420,
  initialSpeed: 1,
  rng: Math.random,
};

function clonePoint(point: GridPoint) {
  return { ...point };
}

function nextTaskDelay(config: SimulationConfig) {
  const span = config.maxTaskIntervalMs - config.minTaskIntervalMs;
  return config.minTaskIntervalMs + config.rng() * span;
}

function buildVehicle(id: number, position: GridPoint, config: SimulationConfig): Vehicle {
  return {
    id: `V${id + 1}`,
    color: VEHICLE_COLORS[id % VEHICLE_COLORS.length],
    capacity: config.vehicleCapacity,
    load: 0,
    position: clonePoint(position),
    displayPosition: clonePoint(position),
    routeStops: [],
    onboardTaskIds: [],
    state: 'idle',
    currentPath: [],
    pathIndex: 0,
    segmentProgress: 0,
    busyTime: 0,
  };
}

function createInitialState(config: SimulationConfig): SimulationState {
  const map = createFactoryMap();
  const vehicles = Array.from({ length: config.vehicleCount }, (_, index) =>
    buildVehicle(index, map.depotPoints[index % map.depotPoints.length], config),
  );

  return {
    config,
    map,
    tasks: [],
    vehicles,
    simulationTime: 0,
    speed: config.initialSpeed,
    isRunning: false,
    nextTaskId: 1,
    nextTaskAt: nextTaskDelay(config),
    totalWaitMs: 0,
    totalDeliveryMs: 0,
    batchedCompletions: 0,
  };
}

function pickTaskPoint(state: SimulationState, excluded?: GridPoint) {
  const candidates = state.map.taskPoints.filter(
    (point) => !excluded || point.x !== excluded.x || point.y !== excluded.y,
  );
  const index = Math.floor(state.config.rng() * candidates.length);
  return clonePoint(candidates[index]);
}

function createTask(state: SimulationState): Task {
  const pickup = pickTaskPoint(state);
  const dropoff = pickTaskPoint(state, pickup);

  return {
    id: `T${state.nextTaskId}`,
    color: TASK_COLORS[(state.nextTaskId - 1) % TASK_COLORS.length],
    pickup,
    dropoff,
    createdAt: state.simulationTime,
    assignedVehicleId: null,
    pickedAt: null,
    completedAt: null,
    status: 'pending',
    batchedAtPickup: false,
  };
}

function getTaskById(state: SimulationState, taskId: string) {
  return state.tasks.find((task) => task.id === taskId);
}

function updateVehicleState(vehicle: Vehicle): VehicleState {
  if (vehicle.routeStops.length === 0) {
    return 'idle';
  }

  return vehicle.routeStops[0].kind === 'pickup' ? 'to-pickup' : 'delivering';
}

function updateMetrics(state: SimulationState): SimulationMetrics {
  const completedTasks = state.tasks.filter((task) => task.status === 'completed');
  const pendingTasks = state.tasks.filter((task) => task.status === 'pending').length;
  const totalRuntime = Math.max(state.simulationTime, 1);
  const totalBusyTime = state.vehicles.reduce((sum, vehicle) => sum + vehicle.busyTime, 0);

  return {
    completedTasks: completedTasks.length,
    pendingTasks,
    averageWaitMs: completedTasks.length === 0 ? 0 : state.totalWaitMs / completedTasks.length,
    averageDeliveryMs:
      completedTasks.length === 0 ? 0 : state.totalDeliveryMs / completedTasks.length,
    utilizationRate: totalBusyTime / (state.vehicles.length * totalRuntime),
    batchingRate:
      completedTasks.length === 0 ? 0 : state.batchedCompletions / completedTasks.length,
  };
}

function toSnapshot(state: SimulationState): SimulationSnapshot {
  return {
    map: state.map,
    tasks: state.tasks.map((task) => ({
      ...task,
      pickup: clonePoint(task.pickup),
      dropoff: clonePoint(task.dropoff),
    })),
    vehicles: state.vehicles.map((vehicle) => ({
      ...vehicle,
      position: clonePoint(vehicle.position),
      displayPosition: { ...vehicle.displayPosition },
      routeStops: vehicle.routeStops.map((stop) => ({
        ...stop,
        point: clonePoint(stop.point),
      })),
      onboardTaskIds: [...vehicle.onboardTaskIds],
      currentPath: vehicle.currentPath.map((point) => clonePoint(point)),
    })),
    metrics: updateMetrics(state),
    simulationTime: state.simulationTime,
    speed: state.speed,
    isRunning: state.isRunning,
  };
}

function ensureVehiclePath(state: SimulationState, vehicle: Vehicle) {
  if (vehicle.routeStops.length === 0) {
    vehicle.currentPath = [];
    vehicle.pathIndex = 0;
    vehicle.segmentProgress = 0;
    vehicle.displayPosition = clonePoint(vehicle.position);
    vehicle.state = 'idle';
    return;
  }

  if (vehicle.currentPath.length > 0) {
    return;
  }

  const target = vehicle.routeStops[0].point;
  const path = findShortestPath(state.map, vehicle.position, target);

  if (!path) {
    vehicle.currentPath = [];
    return;
  }

  vehicle.currentPath = path;
  vehicle.pathIndex = 0;
  vehicle.segmentProgress = 0;
  vehicle.displayPosition = clonePoint(vehicle.position);
  vehicle.state = updateVehicleState(vehicle);
}

function completePickup(state: SimulationState, vehicle: Vehicle, stop: RouteStop) {
  const hadOtherTasks = hasAdditionalAssignedTasks(vehicle, stop.taskId);

  state.tasks = state.tasks.map((task) =>
    task.id === stop.taskId
      ? {
          ...task,
          status: 'picked',
          pickedAt: state.simulationTime,
          batchedAtPickup: hadOtherTasks,
        }
      : task,
  );

  if (!vehicle.onboardTaskIds.includes(stop.taskId)) {
    vehicle.onboardTaskIds = [...vehicle.onboardTaskIds, stop.taskId];
    vehicle.load += 1;
  }
}

function completeDropoff(state: SimulationState, vehicle: Vehicle, stop: RouteStop) {
  const task = getTaskById(state, stop.taskId);
  if (!task || task.pickedAt === null) {
    return;
  }

  state.tasks = state.tasks.map((currentTask) =>
    currentTask.id === stop.taskId
      ? {
          ...currentTask,
          status: 'completed',
          completedAt: state.simulationTime,
        }
      : currentTask,
  );

  vehicle.onboardTaskIds = vehicle.onboardTaskIds.filter((taskId) => taskId !== stop.taskId);
  vehicle.load = Math.max(0, vehicle.load - 1);
  state.totalWaitMs += task.pickedAt - task.createdAt;
  state.totalDeliveryMs += state.simulationTime - task.createdAt;
  if (task.batchedAtPickup) {
    state.batchedCompletions += 1;
  }
}

function handleArrivedStop(state: SimulationState, vehicle: Vehicle) {
  if (vehicle.routeStops.length === 0) {
    return false;
  }

  const currentStop = vehicle.routeStops[0];
  if (
    vehicle.position.x !== currentStop.point.x ||
    vehicle.position.y !== currentStop.point.y
  ) {
    return false;
  }

  if (currentStop.kind === 'pickup') {
    completePickup(state, vehicle, currentStop);
  } else {
    completeDropoff(state, vehicle, currentStop);
  }

  vehicle.routeStops = vehicle.routeStops.slice(1);
  vehicle.currentPath = [];
  vehicle.pathIndex = 0;
  vehicle.segmentProgress = 0;
  vehicle.displayPosition = clonePoint(vehicle.position);
  vehicle.state = updateVehicleState(vehicle);
  return true;
}

function advanceVehicle(state: SimulationState, vehicle: Vehicle, deltaMs: number) {
  let remaining = deltaMs;

  const isBusy = vehicle.routeStops.length > 0 || vehicle.load > 0;
  if (isBusy) {
    vehicle.busyTime += deltaMs;
  }

  while (remaining > 0) {
    ensureVehiclePath(state, vehicle);

    if (handleArrivedStop(state, vehicle)) {
      continue;
    }

    if (vehicle.currentPath.length <= 1 || vehicle.pathIndex >= vehicle.currentPath.length - 1) {
      vehicle.displayPosition = clonePoint(vehicle.position);
      break;
    }

    const from = vehicle.currentPath[vehicle.pathIndex];
    const to = vehicle.currentPath[vehicle.pathIndex + 1];
    const remainingSegmentMs =
      state.config.baseCellTravelMs * (1 - vehicle.segmentProgress);
    const consumed = Math.min(remaining, remainingSegmentMs);

    vehicle.segmentProgress += consumed / state.config.baseCellTravelMs;
    remaining -= consumed;

    vehicle.displayPosition = {
      x: from.x + (to.x - from.x) * vehicle.segmentProgress,
      y: from.y + (to.y - from.y) * vehicle.segmentProgress,
    };

    if (vehicle.segmentProgress >= 1) {
      vehicle.position = clonePoint(to);
      vehicle.displayPosition = clonePoint(to);
      vehicle.pathIndex += 1;
      vehicle.segmentProgress = 0;

      if (vehicle.pathIndex >= vehicle.currentPath.length - 1) {
        handleArrivedStop(state, vehicle);
      }
    }
  }

  vehicle.state = updateVehicleState(vehicle);
}

export function stepSimulation(state: SimulationState, frameMs: number) {
  if (!state.isRunning) {
    return state;
  }

  const deltaMs = frameMs * state.speed;
  state.simulationTime += deltaMs;

  let generatedTask = false;
  while (state.simulationTime >= state.nextTaskAt) {
    state.tasks = [...state.tasks, createTask(state)];
    state.nextTaskId += 1;
    state.nextTaskAt += nextTaskDelay(state.config);
    generatedTask = true;
  }

  for (const vehicle of state.vehicles) {
    advanceVehicle(state, vehicle, deltaMs);
  }

  if (generatedTask || state.tasks.some((task) => task.status === 'pending')) {
    dispatchPendingTasks(state);
  }

  state.vehicles = state.vehicles.map((vehicle) => ({
    ...vehicle,
    state: updateVehicleState(vehicle),
  }));

  return state;
}

export function createSimulation(
  overrides: Partial<SimulationConfig> = {},
): SimulationController {
  const config = {
    ...DEFAULT_SIMULATION_CONFIG,
    ...overrides,
  };

  let state = createInitialState(config);
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<(snapshot: SimulationSnapshot) => void>();

  const notify = () => {
    const snapshot = toSnapshot(state);
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const stopTimer = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    intervalId = setInterval(() => {
      stepSimulation(state, config.stepMs);
      notify();
    }, config.stepMs);
  };

  return {
    start() {
      if (state.isRunning) {
        return;
      }

      state.isRunning = true;
      startTimer();
      notify();
    },
    pause() {
      state.isRunning = false;
      stopTimer();
      notify();
    },
    reset() {
      const shouldResume = state.isRunning;
      stopTimer();
      state = createInitialState(config);
      state.speed = config.initialSpeed;
      state.isRunning = shouldResume;
      if (shouldResume) {
        startTimer();
      }
      notify();
    },
    setSpeed(multiplier: number) {
      state.speed = multiplier;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(toSnapshot(state));

      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return toSnapshot(state);
    },
  };
}

export function createSimulationState(overrides: Partial<SimulationConfig> = {}) {
  return createInitialState({
    ...DEFAULT_SIMULATION_CONFIG,
    ...overrides,
  });
}
