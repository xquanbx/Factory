import Phaser from 'phaser';
import { findShortestPath } from '../simulation';
import type { GridCell, GridPoint, SimulationMap, SimulationSnapshot, Task, Vehicle } from '../simulation';

const CELL_SIZE = 68;
const PADDING = 32;
const ROAD_COLOR = 0x0f172a;
const CARGO_DOT_RADIUS = 5.8;

function cellFill(cell: GridCell) {
  switch (cell) {
    case 'obstacle':
      return 0x1e293b;
    case 'inactive':
      return 0x475569;
    default:
      return ROAD_COLOR;
  }
}

function drawInactiveCellHatch(
  graphics: Phaser.GameObjects.Graphics,
  px: number,
  py: number,
  size: number,
) {
  const step = 8;
  graphics.lineStyle(1.2, 0xcbd5e1, 0.32);

  for (let offset = -size; offset < size * 2; offset += step) {
    const startX = Math.max(px, px + offset);
    const startY = Math.max(py, py - offset);
    const endX = Math.min(px + size, px + offset + size);
    const endY = Math.min(py + size, py - offset + size);

    if (startX < endX && startY < endY) {
      graphics.lineBetween(startX, startY, endX, endY);
    }
  }
}

function taskCenterX(task: Task, kind: 'pickup' | 'dropoff') {
  const point = kind === 'pickup' ? task.pickup : task.dropoff;
  return PADDING + point.x * CELL_SIZE + CELL_SIZE / 2;
}

function taskCenterY(task: Task, kind: 'pickup' | 'dropoff') {
  const point = kind === 'pickup' ? task.pickup : task.dropoff;
  return PADDING + point.y * CELL_SIZE + CELL_SIZE / 2;
}

function vehicleX(vehicle: Vehicle) {
  return PADDING + vehicle.displayPosition.x * CELL_SIZE + CELL_SIZE / 2;
}

function vehicleY(vehicle: Vehicle) {
  return PADDING + vehicle.displayPosition.y * CELL_SIZE + CELL_SIZE / 2;
}

function pointToPixel(point: { x: number; y: number }) {
  return {
    x: PADDING + point.x * CELL_SIZE + CELL_SIZE / 2,
    y: PADDING + point.y * CELL_SIZE + CELL_SIZE / 2,
  };
}

function onboardTaskColors(vehicle: Vehicle, tasks: Task[]) {
  return vehicle.onboardTaskIds
    .map((taskId) => tasks.find((task) => task.id === taskId)?.color)
    .filter((color): color is string => Boolean(color));
}

function vehicleBodyColor(vehicle: Vehicle) {
  return Phaser.Display.Color.HexStringToColor(vehicle.color).color;
}

function getTaskColor(tasks: Task[], taskId: string | undefined) {
  if (!taskId) {
    return null;
  }

  return tasks.find((task) => task.id === taskId)?.color ?? null;
}

function appendPathPoints(target: GridPoint[], path: GridPoint[]) {
  if (path.length === 0) {
    return;
  }

  const startIndex = target.length === 0 ? 0 : 1;
  for (let index = startIndex; index < path.length; index += 1) {
    target.push(path[index]);
  }
}

function buildVehicleRoutePoints(map: SimulationMap, vehicle: Vehicle) {
  const route: { x: number; y: number }[] = [{ ...vehicle.displayPosition }];
  let cursor = { ...vehicle.position };
  let stopStartIndex = 0;

  if (vehicle.currentPath.length > 1 && vehicle.pathIndex < vehicle.currentPath.length - 1) {
    const remainingCurrentPath = vehicle.currentPath.slice(vehicle.pathIndex + 1);
    appendPathPoints(route as GridPoint[], remainingCurrentPath);
    cursor = { ...remainingCurrentPath[remainingCurrentPath.length - 1] };
    stopStartIndex = vehicle.routeStops.length > 0 ? 1 : 0;
  }

  for (let index = stopStartIndex; index < vehicle.routeStops.length; index += 1) {
    const stop = vehicle.routeStops[index];
    const path = findShortestPath(map, cursor, stop.point);
    if (!path) {
      continue;
    }

    appendPathPoints(route as GridPoint[], path);
    cursor = { ...stop.point };
  }

  return route;
}

function drawDashedSegment(
  graphics: Phaser.GameObjects.Graphics,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: number,
) {
  const dashLength = 10;
  const gapLength = 7;
  const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);

  if (distance === 0) {
    return;
  }

  const directionX = (end.x - start.x) / distance;
  const directionY = (end.y - start.y) / distance;
  let cursor = 0;

  graphics.lineStyle(2, color, 0.62);

  while (cursor < distance) {
    const dashStart = cursor;
    const dashEnd = Math.min(cursor + dashLength, distance);

    graphics.lineBetween(
      start.x + directionX * dashStart,
      start.y + directionY * dashStart,
      start.x + directionX * dashEnd,
      start.y + directionY * dashEnd,
    );

    cursor += dashLength + gapLength;
  }
}

function drawVehicleRoute(
  graphics: Phaser.GameObjects.Graphics,
  map: SimulationMap,
  vehicle: Vehicle,
  color: number,
) {
  const routePoints = buildVehicleRoutePoints(map, vehicle);

  if (routePoints.length < 2) {
    return;
  }

  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const start = pointToPixel(routePoints[index]);
    const end = pointToPixel(routePoints[index + 1]);

    if (start.x !== end.x && start.y !== end.y) {
      const corner = { x: end.x, y: start.y };
      drawDashedSegment(graphics, start, corner, color);
      drawDashedSegment(graphics, corner, end, color);
      continue;
    }

    drawDashedSegment(graphics, start, end, color);
  }
}

export class FactoryScene extends Phaser.Scene {
  private snapshot: SimulationSnapshot | null = null;
  private showVehicleRoutes = true;
  private graphics!: Phaser.GameObjects.Graphics;
  private vehicleLayer!: Phaser.GameObjects.Container;
  private overlayLayer!: Phaser.GameObjects.Container;

  constructor() {
    super('factory-scene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#050b16');
    this.graphics = this.add.graphics();
    this.vehicleLayer = this.add.container();
    this.overlayLayer = this.add.container();
    this.renderSnapshot();
  }

  setSnapshot(snapshot: SimulationSnapshot) {
    this.snapshot = snapshot;
    this.renderSnapshot();
  }

  setDisplayOptions(options: { showVehicleRoutes: boolean }) {
    this.showVehicleRoutes = options.showVehicleRoutes;
    this.renderSnapshot();
  }

  private renderSnapshot() {
    if (!this.graphics || !this.snapshot) {
      return;
    }

    this.graphics.clear();
    this.vehicleLayer.removeAll(true);
    this.overlayLayer.removeAll(true);

    const { map, tasks, vehicles } = this.snapshot;

    this.graphics.fillStyle(0x020617, 1);
    this.graphics.fillRoundedRect(
      0,
      0,
      map.width * CELL_SIZE + PADDING * 2,
      map.height * CELL_SIZE + PADDING * 2,
      24,
    );

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const px = PADDING + x * CELL_SIZE;
        const py = PADDING + y * CELL_SIZE;
        const cell = map.cells[y][x];
        const cellSize = CELL_SIZE - 2;

        this.graphics.fillStyle(cellFill(cell), 1);
        this.graphics.fillRoundedRect(px, py, cellSize, cellSize, 10);

        if (cell === 'inactive') {
          drawInactiveCellHatch(this.graphics, px + 1, py + 1, cellSize - 2);
          this.graphics.lineStyle(1, 0x94a3b8, 0.75);
          this.graphics.strokeRoundedRect(px, py, cellSize, cellSize, 10);
          continue;
        }

        this.graphics.lineStyle(1, 0x334155, 0.85);
        this.graphics.strokeRoundedRect(px, py, cellSize, cellSize, 10);
      }
    }

    for (const task of tasks.filter((item) => item.status !== 'completed')) {
      const pickupX = taskCenterX(task, 'pickup');
      const pickupY = taskCenterY(task, 'pickup');
      const dropoffX = taskCenterX(task, 'dropoff');
      const dropoffY = taskCenterY(task, 'dropoff');
      const color = Phaser.Display.Color.HexStringToColor(task.color).color;
      const pickupVisible = task.status !== 'picked';

      this.graphics.lineStyle(3, color, 1);
      this.graphics.strokeCircle(dropoffX, dropoffY, CARGO_DOT_RADIUS + 2.4);

      if (pickupVisible) {
        this.graphics.fillStyle(color, 1);
        this.graphics.fillCircle(pickupX, pickupY, CARGO_DOT_RADIUS);
      }
    }

    if (this.showVehicleRoutes) {
      for (const vehicle of vehicles) {
        if (vehicle.routeStops.length === 0) {
          continue;
        }

        const routeGraphics = this.add.graphics();
        drawVehicleRoute(routeGraphics, map, vehicle, vehicleBodyColor(vehicle));
        this.overlayLayer.add(routeGraphics);
      }
    }

    for (const vehicle of vehicles) {
      const x = vehicleX(vehicle);
      const y = vehicleY(vehicle);
      const color = vehicleBodyColor(vehicle);
      const cargoColors = onboardTaskColors(vehicle, tasks);
      const bodySize = CELL_SIZE - 18;
      const currentTaskColor = getTaskColor(tasks, vehicle.routeStops[0]?.taskId);
      const operationRatio =
        vehicle.activeStopKind && this.snapshot.serviceDurationMs > 0
          ? Phaser.Math.Clamp(
              1 - vehicle.operationRemainingMs / this.snapshot.serviceDurationMs,
              0,
              1,
            )
          : null;
      const body = this.add.graphics();
      body.fillStyle(color, 0.2);
      body.fillRoundedRect(
        x - bodySize / 2,
        y - bodySize / 2,
        bodySize,
        bodySize,
        10,
      );
      body.lineStyle(3, color, 1);
      body.strokeRoundedRect(
        x - bodySize / 2,
        y - bodySize / 2,
        bodySize,
        bodySize,
        10,
      );

      const innerSize = bodySize - 10;
      const innerPanel = this.add.graphics();
      innerPanel.fillStyle(color, 0.1);
      innerPanel.fillRoundedRect(
        x - innerSize / 2,
        y - innerSize / 2,
        innerSize,
        innerSize,
        8,
      );

      const slotOffsets = [
        { x: -10, y: -10 },
        { x: 10, y: -10 },
        { x: -10, y: 10 },
        { x: 10, y: 10 },
      ];

      const slots = slotOffsets.map((offset, index) => {
        const cargoColor = cargoColors[index];
        const slot = this.add.circle(
          x + offset.x,
          y + offset.y,
          CARGO_DOT_RADIUS,
          cargoColor ? Phaser.Display.Color.HexStringToColor(cargoColor).color : color,
          cargoColor ? 1 : 0.14,
        );
        slot.setStrokeStyle(1.5, cargoColor ? 0xe2e8f0 : color, cargoColor ? 0.95 : 0.9);
        return slot;
      });

      const vehicleElements: Phaser.GameObjects.GameObject[] = [body, innerPanel, ...slots];

      if (
        currentTaskColor &&
        operationRatio !== null &&
        (vehicle.state === 'loading' || vehicle.state === 'unloading')
      ) {
        const barWidth = innerSize - 8;
        const barHeight = 8;
        const barX = x - barWidth / 2;
        const barY = y + innerSize / 2 - barHeight - 4;
        const taskColor = Phaser.Display.Color.HexStringToColor(currentTaskColor).color;
        const filledRatio = vehicle.state === 'loading' ? operationRatio : 1 - operationRatio;
        const filledWidth = Math.max(0, barWidth * filledRatio);

        const progressTrack = this.add.graphics();
        progressTrack.fillStyle(0x020617, 0.82);
        progressTrack.fillRoundedRect(barX, barY, barWidth, barHeight, 4);
        progressTrack.lineStyle(1, taskColor, 0.7);
        progressTrack.strokeRoundedRect(barX, barY, barWidth, barHeight, 4);

        const progressFill = this.add.graphics();
        if (filledWidth > 0) {
          progressFill.fillStyle(taskColor, 0.95);
          progressFill.fillRoundedRect(barX, barY, filledWidth, barHeight, 4);
        }

        vehicleElements.push(progressTrack, progressFill);
      }

      this.vehicleLayer.add(vehicleElements);
    }

  }
}

export function getSceneSize(snapshot: SimulationSnapshot | null) {
  if (!snapshot) {
    return { width: 1160, height: 820 };
  }

  return {
    width: snapshot.map.width * CELL_SIZE + PADDING * 2,
    height: snapshot.map.height * CELL_SIZE + PADDING * 2,
  };
}
