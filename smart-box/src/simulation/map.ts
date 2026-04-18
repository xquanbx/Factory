import type { GridCell, GridPoint, MapPreset, SimulationMap } from './types';

interface ObstacleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MapDefinition {
  width: number;
  height: number;
  obstacleRects: ObstacleRect[];
  inactiveRects: ObstacleRect[];
  vehicleStartPoints: GridPoint[];
}

const MAP_DEFINITIONS: Record<MapPreset, MapDefinition> = {
  standard: {
    width: 16,
    height: 10,
    obstacleRects: [
      { x: 4, y: 1, width: 2, height: 3 },
      { x: 9, y: 0, width: 2, height: 3 },
      { x: 7, y: 4, width: 2, height: 3 },
      { x: 2, y: 6, width: 2, height: 2 },
      { x: 12, y: 5, width: 2, height: 3 },
    ],
    inactiveRects: [],
    vehicleStartPoints: [
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  },
  irregular: {
    width: 22,
    height: 14,
    obstacleRects: [
      { x: 4, y: 1, width: 3, height: 3 },
      { x: 10, y: 1, width: 2, height: 4 },
      { x: 7, y: 6, width: 3, height: 2 },
      { x: 16, y: 5, width: 2, height: 3 },
    ],
    inactiveRects: [
      { x: 18, y: 0, width: 4, height: 4 },
      { x: 19, y: 10, width: 3, height: 4 },
      { x: 0, y: 12, width: 3, height: 2 },
      { x: 12, y: 8, width: 3, height: 2 },
      { x: 5, y: 10, width: 3, height: 2 },
    ],
    vehicleStartPoints: [
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
  },
};

export const DEFAULT_MAP_PRESET: MapPreset = 'standard';
export const DEFAULT_MAP_WIDTH = MAP_DEFINITIONS.standard.width;
export const DEFAULT_MAP_HEIGHT = MAP_DEFINITIONS.standard.height;

function isSamePoint(a: GridPoint, b: GridPoint) {
  return a.x === b.x && a.y === b.y;
}

export function createFactoryMap(preset: MapPreset = DEFAULT_MAP_PRESET): SimulationMap {
  const definition = MAP_DEFINITIONS[preset];
  const cells: GridCell[][] = Array.from({ length: definition.height }, () =>
    Array.from({ length: definition.width }, () => 'road' as GridCell),
  );

  for (const rect of definition.inactiveRects) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        cells[y][x] = 'inactive';
      }
    }
  }

  for (const rect of definition.obstacleRects) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        cells[y][x] = 'obstacle';
      }
    }
  }

  const roadPoints: GridPoint[] = [];
  const taskPoints: GridPoint[] = [];

  for (let y = 0; y < definition.height; y += 1) {
    for (let x = 0; x < definition.width; x += 1) {
      if (cells[y][x] === 'obstacle' || cells[y][x] === 'inactive') {
        continue;
      }

      const point = { x, y };
      roadPoints.push(point);

      if (!definition.vehicleStartPoints.some((startPoint) => isSamePoint(startPoint, point))) {
        taskPoints.push(point);
      }
    }
  }

  return {
    preset,
    width: definition.width,
    height: definition.height,
    cells,
    roadPoints,
    taskPoints,
    vehicleStartPoints: definition.vehicleStartPoints,
  };
}
