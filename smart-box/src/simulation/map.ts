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
  depotPoints: GridPoint[];
  spawnPoints: GridPoint[];
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
    depotPoints: [
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
    spawnPoints: [
      { x: 14, y: 1 },
      { x: 11, y: 4 },
      { x: 5, y: 8 },
      { x: 14, y: 8 },
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
    depotPoints: [
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ],
    spawnPoints: [
      { x: 17, y: 1 },
      { x: 12, y: 5 },
      { x: 6, y: 12 },
      { x: 17, y: 12 },
      { x: 15, y: 10 },
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

  for (const point of definition.depotPoints) {
    cells[point.y][point.x] = 'depot';
  }

  for (const point of definition.spawnPoints) {
    cells[point.y][point.x] = 'spawn';
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

      if (!definition.depotPoints.some((depot) => isSamePoint(depot, point))) {
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
    depotPoints: definition.depotPoints,
  };
}
