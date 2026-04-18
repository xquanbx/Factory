import { arePointsEqual, getRouteDistance } from './pathfinding';
import type { GridPoint, RouteStop, SimulationState, Task, Vehicle } from './types';

interface AssignmentCandidate {
  vehicleId: string;
  cost: number;
  routeStops: RouteStop[];
}

function cloneStops(stops: RouteStop[]) {
  return stops.map((stop) => ({
    taskId: stop.taskId,
    kind: stop.kind,
    point: { ...stop.point },
  }));
}

function validateLoad(vehicle: Vehicle, stops: RouteStop[]) {
  let load = vehicle.load;

  for (const stop of stops) {
    load += stop.kind === 'pickup' ? 1 : -1;

    if (load < 0 || load > vehicle.capacity) {
      return false;
    }
  }

  return true;
}

function insertStops(stops: RouteStop[], pickupIndex: number, dropoffIndex: number, task: Task) {
  const nextStops = cloneStops(stops);

  nextStops.splice(pickupIndex, 0, {
    taskId: task.id,
    kind: 'pickup',
    point: { ...task.pickup },
  });

  nextStops.splice(dropoffIndex, 0, {
    taskId: task.id,
    kind: 'dropoff',
    point: { ...task.dropoff },
  });

  return nextStops;
}

function findIdleCandidate(state: SimulationState, vehicle: Vehicle, task: Task): AssignmentCandidate | null {
  if (vehicle.load >= vehicle.capacity) {
    return null;
  }

  const routeStops: RouteStop[] = [
    { taskId: task.id, kind: 'pickup', point: { ...task.pickup } },
    { taskId: task.id, kind: 'dropoff', point: { ...task.dropoff } },
  ];

  const cost = getRouteDistance(
    state.map,
    vehicle.position,
    routeStops.map((stop) => stop.point),
  );

  if (cost === null) {
    return null;
  }

  return {
    vehicleId: vehicle.id,
    cost,
    routeStops,
  };
}

function findInsertionCandidate(
  state: SimulationState,
  vehicle: Vehicle,
  task: Task,
): AssignmentCandidate | null {
  if (vehicle.routeStops.length === 0 || vehicle.load >= vehicle.capacity) {
    return findIdleCandidate(state, vehicle, task);
  }

  const baseDistance = getRouteDistance(
    state.map,
    vehicle.position,
    vehicle.routeStops.map((stop) => stop.point),
  );

  if (baseDistance === null) {
    return null;
  }

  let best: AssignmentCandidate | null = null;
  const insertionStartIndex = vehicle.activeStopKind ? 1 : 0;

  for (
    let pickupIndex = insertionStartIndex;
    pickupIndex <= vehicle.routeStops.length;
    pickupIndex += 1
  ) {
    for (
      let dropoffIndex = pickupIndex + 1;
      dropoffIndex <= vehicle.routeStops.length + 1;
      dropoffIndex += 1
    ) {
      const routeStops = insertStops(vehicle.routeStops, pickupIndex, dropoffIndex, task);

      if (!validateLoad(vehicle, routeStops)) {
        continue;
      }

      const totalDistance = getRouteDistance(
        state.map,
        vehicle.position,
        routeStops.map((stop) => stop.point),
      );

      if (totalDistance === null) {
        continue;
      }

      const extraDistance = totalDistance - baseDistance;
      const threshold = Math.max(4, Math.ceil(baseDistance * 0.25));

      if (extraDistance > threshold) {
        continue;
      }

      if (!best || extraDistance < best.cost) {
        best = {
          vehicleId: vehicle.id,
          cost: extraDistance,
          routeStops,
        };
      }
    }
  }

  return best;
}

function chooseBestVehicle(state: SimulationState, task: Task) {
  let best: AssignmentCandidate | null = null;

  for (const vehicle of state.vehicles) {
    const candidate =
      vehicle.routeStops.length === 0
        ? findIdleCandidate(state, vehicle, task)
        : findInsertionCandidate(state, vehicle, task);

    if (!candidate) {
      continue;
    }

    if (!best || candidate.cost < best.cost) {
      best = candidate;
    }
  }

  return best;
}

function applyAssignment(state: SimulationState, task: Task, candidate: AssignmentCandidate) {
  state.tasks = state.tasks.map((currentTask) =>
    currentTask.id === task.id
      ? {
          ...currentTask,
          assignedVehicleId: candidate.vehicleId,
          status: 'assigned',
        }
      : currentTask,
  );

  state.vehicles = state.vehicles.map((vehicle) =>
    vehicle.id === candidate.vehicleId
      ? {
          ...vehicle,
          routeStops: cloneStops(candidate.routeStops),
          currentPath: [],
          pathIndex: 0,
          segmentProgress: 0,
          state: vehicle.activeStopKind
            ? vehicle.activeStopKind === 'pickup'
              ? 'loading'
              : 'unloading'
            : candidate.routeStops[0]?.kind === 'pickup'
              ? 'to-pickup'
              : 'delivering',
        }
      : vehicle,
  );
}

export function dispatchPendingTasks(state: SimulationState): SimulationState {
  const pendingTasks = state.tasks
    .filter((task) => task.status === 'pending')
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const task of pendingTasks) {
    const candidate = chooseBestVehicle(state, task);
    if (!candidate) {
      continue;
    }

    applyAssignment(state, task, candidate);
  }

  state.tasks = state.tasks.map((task) => ({
    ...task,
    assignedVehicleId:
      task.status === 'pending'
        ? null
        : state.vehicles.find((vehicle) =>
            vehicle.routeStops.some((stop) => stop.taskId === task.id) ||
            vehicle.onboardTaskIds.includes(task.id),
          )?.id ?? task.assignedVehicleId,
  }));

  return state;
}

export function isTaskInVehicleRoute(vehicle: Vehicle, taskId: string) {
  return (
    vehicle.onboardTaskIds.includes(taskId) ||
    vehicle.routeStops.some((stop) => stop.taskId === taskId)
  );
}

export function getVehicleRemainingDistance(state: SimulationState, vehicle: Vehicle) {
  return getRouteDistance(
    state.map,
    vehicle.position,
    vehicle.routeStops.map((stop) => stop.point),
  );
}

export function hasAdditionalAssignedTasks(vehicle: Vehicle, currentTaskId: string) {
  return (
    vehicle.load > 0 ||
    vehicle.routeStops.some(
      (stop) => stop.taskId !== currentTaskId && !arePointsEqual(stop.point, vehicle.position),
    )
  );
}

export function pointInStops(stops: RouteStop[], point: GridPoint) {
  return stops.some((stop) => arePointsEqual(stop.point, point));
}
