import type { GridPoint, SimulationMap } from './types';

const NEIGHBORS: GridPoint[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function pointKey(point: GridPoint) {
  return `${point.x},${point.y}`;
}

function isWalkable(map: SimulationMap, point: GridPoint) {
  return (
    point.x >= 0 &&
    point.x < map.width &&
    point.y >= 0 &&
    point.y < map.height &&
    map.cells[point.y][point.x] !== 'obstacle' &&
    map.cells[point.y][point.x] !== 'inactive'
  );
}

export function arePointsEqual(a: GridPoint, b: GridPoint) {
  return a.x === b.x && a.y === b.y;
}

export function findShortestPath(
  map: SimulationMap,
  from: GridPoint,
  to: GridPoint,
): GridPoint[] | null {
  if (!isWalkable(map, from) || !isWalkable(map, to)) {
    return null;
  }

  if (arePointsEqual(from, to)) {
    return [{ ...from }];
  }

  const queue: GridPoint[] = [{ ...from }];
  const visited = new Set<string>([pointKey(from)]);
  const previous = new Map<string, GridPoint>();

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const offset of NEIGHBORS) {
      const next = {
        x: current.x + offset.x,
        y: current.y + offset.y,
      };

      if (!isWalkable(map, next)) {
        continue;
      }

      const key = pointKey(next);
      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      previous.set(key, current);

      if (arePointsEqual(next, to)) {
        const path: GridPoint[] = [next];
        let cursor = current;

        while (!arePointsEqual(cursor, from)) {
          path.push(cursor);
          cursor = previous.get(pointKey(cursor))!;
        }

        path.push(from);
        path.reverse();
        return path;
      }

      queue.push(next);
    }
  }

  return null;
}

export function getPathLength(map: SimulationMap, from: GridPoint, to: GridPoint) {
  const path = findShortestPath(map, from, to);
  return path ? path.length - 1 : null;
}

export function getRouteDistance(
  map: SimulationMap,
  start: GridPoint,
  stops: GridPoint[],
): number | null {
  let cursor = start;
  let total = 0;

  for (const stop of stops) {
    const length = getPathLength(map, cursor, stop);
    if (length === null) {
      return null;
    }

    total += length;
    cursor = stop;
  }

  return total;
}
