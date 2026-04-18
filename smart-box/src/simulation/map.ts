import type { GridCell, GridPoint, SimulationMap } from './types';

const WIDTH = 16;
const HEIGHT = 10;

const obstacleRects = [
  { x: 4, y: 1, width: 2, height: 3 },
  { x: 9, y: 0, width: 2, height: 3 },
  { x: 7, y: 4, width: 2, height: 3 },
  { x: 2, y: 6, width: 2, height: 2 },
  { x: 12, y: 5, width: 2, height: 3 },
];

const depotPoints: GridPoint[] = [
  { x: 0, y: 1 },
  { x: 0, y: 2 },
  { x: 0, y: 3 },
  { x: 1, y: 1 },
  { x: 1, y: 2 },
];

const spawnPoints: GridPoint[] = [
  { x: 14, y: 1 },
  { x: 11, y: 4 },
  { x: 5, y: 8 },
  { x: 14, y: 8 },
];

export const DEFAULT_MAP_WIDTH = WIDTH;
export const DEFAULT_MAP_HEIGHT = HEIGHT;

function isSamePoint(a: GridPoint, b: GridPoint) {
  return a.x === b.x && a.y === b.y;
}

export function createFactoryMap(): SimulationMap {
  const cells: GridCell[][] = Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => 'road' as GridCell),
  );

  for (const rect of obstacleRects) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        cells[y][x] = 'obstacle';
      }
    }
  }

  for (const point of depotPoints) {
    cells[point.y][point.x] = 'depot';
  }

  for (const point of spawnPoints) {
    cells[point.y][point.x] = 'spawn';
  }

  const roadPoints: GridPoint[] = [];
  const taskPoints: GridPoint[] = [];

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (cells[y][x] === 'obstacle') {
        continue;
      }

      const point = { x, y };
      roadPoints.push(point);

      if (!depotPoints.some((depot) => isSamePoint(depot, point))) {
        taskPoints.push(point);
      }
    }
  }

  return {
    width: WIDTH,
    height: HEIGHT,
    cells,
    roadPoints,
    taskPoints,
    depotPoints,
  };
}
