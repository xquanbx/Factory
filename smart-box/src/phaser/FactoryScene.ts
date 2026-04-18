import Phaser from 'phaser';
import type { GridCell, SimulationSnapshot, Task, Vehicle } from '../simulation';

const CELL_SIZE = 52;
const PADDING = 24;

function cellFill(cell: GridCell) {
  switch (cell) {
    case 'obstacle':
      return 0x1e293b;
    case 'depot':
      return 0x0f766e;
    case 'spawn':
      return 0x1d4ed8;
    default:
      return 0x0f172a;
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

export class FactoryScene extends Phaser.Scene {
  private snapshot: SimulationSnapshot | null = null;
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

        this.graphics.fillStyle(cellFill(cell), 1);
        this.graphics.fillRoundedRect(px, py, CELL_SIZE - 2, CELL_SIZE - 2, 10);
        this.graphics.lineStyle(1, 0x334155, 0.85);
        this.graphics.strokeRoundedRect(px, py, CELL_SIZE - 2, CELL_SIZE - 2, 10);

        if (cell === 'depot') {
          this.graphics.lineStyle(2, 0x5eead4, 0.95);
          this.graphics.strokeRoundedRect(px + 5, py + 5, CELL_SIZE - 12, CELL_SIZE - 12, 8);
        }
      }
    }

    for (const task of tasks.filter((item) => item.status !== 'completed')) {
      const pickupX = taskCenterX(task, 'pickup');
      const pickupY = taskCenterY(task, 'pickup');
      const dropoffX = taskCenterX(task, 'dropoff');
      const dropoffY = taskCenterY(task, 'dropoff');
      const color = Phaser.Display.Color.HexStringToColor(task.color).color;

      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(pickupX, pickupY, 7);
      this.graphics.lineStyle(3, color, 1);
      this.graphics.strokeCircle(dropoffX, dropoffY, 9);

      const link = this.add.line(
        0,
        0,
        pickupX,
        pickupY,
        dropoffX,
        dropoffY,
        color,
        0.2,
      );
      link.setLineWidth(2, 2);
      this.overlayLayer.add(link);
    }

    for (const vehicle of vehicles) {
      const x = vehicleX(vehicle);
      const y = vehicleY(vehicle);
      const color = Phaser.Display.Color.HexStringToColor(vehicle.color).color;

      const body = this.add.circle(x, y, 12, color, 1);
      body.setStrokeStyle(3, 0xe2e8f0, 0.9);

      const label = this.add.text(x, y - 3, vehicle.id.replace('V', ''), {
        color: '#0f172a',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
      });
      label.setOrigin(0.5, 0.5);

      const load = this.add.text(x, y + 15, `${vehicle.load}/${vehicle.capacity}`, {
        color: '#e2e8f0',
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
      });
      load.setOrigin(0.5, 0.5);

      this.vehicleLayer.add([body, label, load]);
    }

    const title = this.add.text(PADDING, 6, 'Factory Dispatch Map', {
      color: '#cbd5e1',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
    });

    this.overlayLayer.add(title);
  }
}

export function getSceneSize(snapshot: SimulationSnapshot | null) {
  if (!snapshot) {
    return { width: 880, height: 600 };
  }

  return {
    width: snapshot.map.width * CELL_SIZE + PADDING * 2,
    height: snapshot.map.height * CELL_SIZE + PADDING * 2,
  };
}
