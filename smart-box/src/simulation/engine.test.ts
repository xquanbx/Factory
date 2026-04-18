import { describe, expect, it, vi } from 'vitest';
import { dispatchPendingTasks } from './dispatcher';
import { createSimulation, createSimulationState, stepSimulation } from './engine';
import { findShortestPath } from './pathfinding';

describe('pathfinding', () => {
  it('finds a shortest path around obstacles', () => {
    const state = createSimulationState();
    const path = findShortestPath(state.map, { x: 0, y: 0 }, { x: 6, y: 2 });

    expect(path).not.toBeNull();
    expect(path?.[0]).toEqual({ x: 0, y: 0 });
    expect(path?.[path.length - 1]).toEqual({ x: 6, y: 2 });
    expect(path?.some((point) => state.map.cells[point.y][point.x] === 'obstacle')).toBe(false);
  });
});

describe('dispatching', () => {
  it('assigns a new task to the nearest idle vehicle', () => {
    const state = createSimulationState();
    state.vehicles[0].position = { x: 3, y: 3 };
    state.vehicles[1].position = { x: 12, y: 8 };
    state.tasks = [
      {
        id: 'T1',
        color: '#fff',
        pickup: { x: 3, y: 3 },
        dropoff: { x: 6, y: 3 },
        createdAt: 0,
        assignedVehicleId: null,
        pickedAt: null,
        completedAt: null,
        status: 'pending',
        batchedAtPickup: false,
      },
    ];

    dispatchPendingTasks(state);

    expect(state.tasks[0].assignedVehicleId).toBe('V1');
    expect(state.vehicles[0].routeStops).toHaveLength(2);
  });

  it('does not assign tasks to full vehicles', () => {
    const state = createSimulationState();
    state.vehicles[0].load = state.vehicles[0].capacity;
    state.vehicles[0].routeStops = [];
    state.tasks = [
      {
        id: 'T1',
        color: '#fff',
        pickup: { x: 1, y: 4 },
        dropoff: { x: 4, y: 4 },
        createdAt: 0,
        assignedVehicleId: null,
        pickedAt: null,
        completedAt: null,
        status: 'pending',
        batchedAtPickup: false,
      },
    ];

    dispatchPendingTasks(state);

    expect(state.tasks[0].assignedVehicleId).not.toBe('V1');
  });

  it('allows same-direction batching only within the detour threshold', () => {
    const state = createSimulationState();
    const vehicle = state.vehicles[0];
    vehicle.position = { x: 1, y: 4 };
    vehicle.routeStops = [
      { taskId: 'A', kind: 'pickup', point: { x: 2, y: 4 } },
      { taskId: 'A', kind: 'dropoff', point: { x: 6, y: 4 } },
    ];
    state.tasks = [
      {
        id: 'A',
        color: '#aaa',
        pickup: { x: 2, y: 4 },
        dropoff: { x: 6, y: 4 },
        createdAt: 0,
        assignedVehicleId: 'V1',
        pickedAt: null,
        completedAt: null,
        status: 'assigned',
        batchedAtPickup: false,
      },
      {
        id: 'B',
        color: '#bbb',
        pickup: { x: 3, y: 4 },
        dropoff: { x: 5, y: 4 },
        createdAt: 100,
        assignedVehicleId: null,
        pickedAt: null,
        completedAt: null,
        status: 'pending',
        batchedAtPickup: false,
      },
    ];

    dispatchPendingTasks(state);

    expect(state.tasks[1].assignedVehicleId).toBe('V1');
    const pickupIndex = state.vehicles[0].routeStops.findIndex(
      (stop) => stop.taskId === 'B' && stop.kind === 'pickup',
    );
    const dropoffIndex = state.vehicles[0].routeStops.findIndex(
      (stop) => stop.taskId === 'B' && stop.kind === 'dropoff',
    );

    expect(pickupIndex).toBeLessThan(dropoffIndex);
  });

  it('keeps unreachable tasks pending', () => {
    const state = createSimulationState();
    state.tasks = [
      {
        id: 'T1',
        color: '#fff',
        pickup: { x: 4, y: 1 },
        dropoff: { x: 6, y: 4 },
        createdAt: 0,
        assignedVehicleId: null,
        pickedAt: null,
        completedAt: null,
        status: 'pending',
        batchedAtPickup: false,
      },
    ];

    dispatchPendingTasks(state);

    expect(state.tasks[0].status).toBe('pending');
    expect(state.tasks[0].assignedVehicleId).toBeNull();
  });
});

describe('simulation controller', () => {
  it('does not advance after pause', () => {
    vi.useFakeTimers();
    const controller = createSimulation({
      minTaskIntervalMs: 999999,
      maxTaskIntervalMs: 999999,
    });

    controller.start();
    vi.advanceTimersByTime(80);
    controller.pause();
    const snapshot = controller.getSnapshot();
    vi.advanceTimersByTime(400);

    expect(controller.getSnapshot().simulationTime).toBe(snapshot.simulationTime);
    vi.useRealTimers();
  });

  it('reset restores initial state and clears stats', () => {
    const state = createSimulationState({
      minTaskIntervalMs: 10,
      maxTaskIntervalMs: 10,
    });

    state.isRunning = true;
    stepSimulation(state, 200);
    expect(state.tasks.length).toBeGreaterThan(0);

    const controller = createSimulation({
      minTaskIntervalMs: 10,
      maxTaskIntervalMs: 10,
    });

    controller.start();
    controller.reset();
    const snapshot = controller.getSnapshot();

    expect(snapshot.tasks).toHaveLength(0);
    expect(snapshot.metrics.completedTasks).toBe(0);
    expect(snapshot.metrics.pendingTasks).toBe(0);
    expect(snapshot.simulationTime).toBe(0);
    controller.pause();
  });
});
