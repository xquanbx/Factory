import { findShortestPath } from '../simulation';
import type {
  GridCell,
  GridPoint,
  MapPreset,
  SimulationMap,
  SimulationSnapshot,
  StopKind,
  Task,
  Vehicle,
} from '../simulation';

export const STAGE_CELL_SIZE = 68;
export const STAGE_PADDING = 32;

export interface StagePoint {
  x: number;
  y: number;
}

export interface StageGridCellView {
  x: number;
  y: number;
  cell: GridCell;
}

export interface StageTaskMarker {
  taskId: string;
  kind: StopKind;
  color: string;
  point: GridPoint;
}

export interface StageVehicleProgress {
  color: string;
  kind: 'loading' | 'unloading';
  ratio: number;
  filledRatio: number;
}

export interface StageVehicleView {
  id: string;
  color: string;
  position: StagePoint;
  cargoSlots: Array<string | null>;
  routePoints: StagePoint[];
  progress: StageVehicleProgress | null;
}

export interface StageViewModel {
  map: {
    preset: MapPreset;
    width: number;
    height: number;
    cells: StageGridCellView[];
  };
  taskMarkers: StageTaskMarker[];
  vehicles: StageVehicleView[];
}

function appendPathPoints(target: StagePoint[], path: GridPoint[], skipFirstPoint: boolean) {
  if (path.length === 0) {
    return;
  }

  const startIndex = skipFirstPoint ? 1 : 0;
  for (let index = startIndex; index < path.length; index += 1) {
    target.push({ ...path[index] });
  }
}

function getTaskColor(tasks: Task[], taskId: string | undefined) {
  if (!taskId) {
    return null;
  }

  return tasks.find((task) => task.id === taskId)?.color ?? null;
}

export function buildTaskMarkers(tasks: Task[]) {
  const markers: StageTaskMarker[] = [];

  for (const task of tasks) {
    if (task.status === 'completed') {
      continue;
    }

    markers.push({
      taskId: task.id,
      kind: 'dropoff',
      color: task.color,
      point: { ...task.dropoff },
    });

    if (task.status !== 'picked') {
      markers.push({
        taskId: task.id,
        kind: 'pickup',
        color: task.color,
        point: { ...task.pickup },
      });
    }
  }

  return markers;
}

export function buildVehicleCargoSlots(vehicle: Vehicle, tasks: Task[]) {
  const onboardColors = vehicle.onboardTaskIds
    .map((taskId) => tasks.find((task) => task.id === taskId)?.color ?? null)
    .filter((color): color is string => Boolean(color));

  return Array.from({ length: vehicle.capacity }, (_, index) => onboardColors[index] ?? null);
}

export function buildVehicleRoutePoints(map: SimulationMap, vehicle: Vehicle) {
  const route: StagePoint[] = [{ ...vehicle.displayPosition }];
  let cursor = { ...vehicle.position };
  let stopStartIndex = 0;

  if (vehicle.currentPath.length > 1 && vehicle.pathIndex < vehicle.currentPath.length - 1) {
    const remainingCurrentPath = vehicle.currentPath.slice(vehicle.pathIndex + 1);
    appendPathPoints(route, remainingCurrentPath, false);
    cursor = { ...remainingCurrentPath[remainingCurrentPath.length - 1] };
    stopStartIndex = vehicle.routeStops.length > 0 ? 1 : 0;
  }

  for (let index = stopStartIndex; index < vehicle.routeStops.length; index += 1) {
    const stop = vehicle.routeStops[index];
    const path = findShortestPath(map, cursor, stop.point);
    if (!path) {
      continue;
    }

    appendPathPoints(route, path, route.length > 0);
    cursor = { ...stop.point };
  }

  return route;
}

export function buildVehicleProgress(
  vehicle: Vehicle,
  tasks: Task[],
  serviceDurationMs: number,
): StageVehicleProgress | null {
  const taskColor = getTaskColor(tasks, vehicle.routeStops[0]?.taskId);

  if (
    !taskColor ||
    !vehicle.activeStopKind ||
    serviceDurationMs <= 0 ||
    (vehicle.state !== 'loading' && vehicle.state !== 'unloading')
  ) {
    return null;
  }

  const ratio = Math.min(
    Math.max(1 - vehicle.operationRemainingMs / serviceDurationMs, 0),
    1,
  );

  return {
    color: taskColor,
    kind: vehicle.state,
    ratio,
    filledRatio: vehicle.state === 'loading' ? ratio : 1 - ratio,
  };
}

export function buildStageViewModel(snapshot: SimulationSnapshot): StageViewModel {
  return {
    map: {
      preset: snapshot.map.preset,
      width: snapshot.map.width,
      height: snapshot.map.height,
      cells: snapshot.map.cells.flatMap((row, y) =>
        row.map((cell, x) => ({
          x,
          y,
          cell,
        })),
      ),
    },
    taskMarkers: buildTaskMarkers(snapshot.tasks),
    vehicles: snapshot.vehicles.map((vehicle) => ({
      id: vehicle.id,
      color: vehicle.color,
      position: { ...vehicle.displayPosition },
      cargoSlots: buildVehicleCargoSlots(vehicle, snapshot.tasks),
      routePoints: buildVehicleRoutePoints(snapshot.map, vehicle),
      progress: buildVehicleProgress(vehicle, snapshot.tasks, snapshot.serviceDurationMs),
    })),
  };
}

export function getStageSceneSize(viewModel: StageViewModel | null) {
  if (!viewModel) {
    return { width: 1160, height: 820 };
  }

  return {
    width: viewModel.map.width * STAGE_CELL_SIZE + STAGE_PADDING * 2,
    height: viewModel.map.height * STAGE_CELL_SIZE + STAGE_PADDING * 2,
  };
}
