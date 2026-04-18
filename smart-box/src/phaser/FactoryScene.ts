import Phaser from 'phaser';
import {
  STAGE_CELL_SIZE as CELL_SIZE,
  STAGE_PADDING as PADDING,
  type StagePoint,
  type StageViewModel,
} from '../stage/view-model';

const ROAD_COLOR = 0x0f172a;
const CARGO_DOT_RADIUS = 5.8;

function cellFill(cell: StageViewModel['map']['cells'][number]['cell']) {
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

function pointToPixel(point: StagePoint) {
  return {
    x: PADDING + point.x * CELL_SIZE + CELL_SIZE / 2,
    y: PADDING + point.y * CELL_SIZE + CELL_SIZE / 2,
  };
}

function vehicleBodyColor(vehicle: StageViewModel['vehicles'][number]) {
  return Phaser.Display.Color.HexStringToColor(vehicle.color).color;
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
  routePoints: StagePoint[],
  color: number,
) {
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
  private viewModel: StageViewModel | null = null;
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
    this.renderViewModel();
  }

  setViewModel(viewModel: StageViewModel) {
    this.viewModel = viewModel;
    this.renderViewModel();
  }

  setDisplayOptions(options: { showVehicleRoutes: boolean }) {
    this.showVehicleRoutes = options.showVehicleRoutes;
    this.renderViewModel();
  }

  private renderViewModel() {
    if (!this.graphics || !this.viewModel) {
      return;
    }

    this.graphics.clear();
    this.vehicleLayer.removeAll(true);
    this.overlayLayer.removeAll(true);

    this.graphics.fillStyle(0x020617, 1);
    this.graphics.fillRoundedRect(
      0,
      0,
      this.viewModel.map.width * CELL_SIZE + PADDING * 2,
      this.viewModel.map.height * CELL_SIZE + PADDING * 2,
      24,
    );

    for (const cell of this.viewModel.map.cells) {
      const px = PADDING + cell.x * CELL_SIZE;
      const py = PADDING + cell.y * CELL_SIZE;
      const cellSize = CELL_SIZE - 2;

      this.graphics.fillStyle(cellFill(cell.cell), 1);
      this.graphics.fillRoundedRect(px, py, cellSize, cellSize, 10);

      if (cell.cell === 'inactive') {
        drawInactiveCellHatch(this.graphics, px + 1, py + 1, cellSize - 2);
        this.graphics.lineStyle(1, 0x94a3b8, 0.75);
        this.graphics.strokeRoundedRect(px, py, cellSize, cellSize, 10);
        continue;
      }

      this.graphics.lineStyle(1, 0x334155, 0.85);
      this.graphics.strokeRoundedRect(px, py, cellSize, cellSize, 10);
    }

    for (const marker of this.viewModel.taskMarkers) {
      const point = pointToPixel(marker.point);
      const color = Phaser.Display.Color.HexStringToColor(marker.color).color;

      if (marker.kind === 'pickup') {
        this.graphics.fillStyle(color, 1);
        this.graphics.fillCircle(point.x, point.y, CARGO_DOT_RADIUS);
        continue;
      }

      this.graphics.lineStyle(3, color, 1);
      this.graphics.strokeCircle(point.x, point.y, CARGO_DOT_RADIUS + 2.4);
    }

    if (this.showVehicleRoutes) {
      for (const vehicle of this.viewModel.vehicles) {
        if (vehicle.routePoints.length < 2) {
          continue;
        }

        const routeGraphics = this.add.graphics();
        drawVehicleRoute(routeGraphics, vehicle.routePoints, vehicleBodyColor(vehicle));
        this.overlayLayer.add(routeGraphics);
      }
    }

    for (const vehicle of this.viewModel.vehicles) {
      const point = pointToPixel(vehicle.position);
      const x = point.x;
      const y = point.y;
      const color = vehicleBodyColor(vehicle);
      const bodySize = CELL_SIZE - 18;
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
        const cargoColor = vehicle.cargoSlots[index] ?? null;
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

      if (vehicle.progress) {
        const barWidth = innerSize - 8;
        const barHeight = 8;
        const barX = x - barWidth / 2;
        const barY = y + innerSize / 2 - barHeight - 4;
        const taskColor = Phaser.Display.Color.HexStringToColor(vehicle.progress.color).color;
        const filledWidth = Math.max(0, barWidth * vehicle.progress.filledRatio);

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
