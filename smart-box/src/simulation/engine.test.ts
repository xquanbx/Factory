import { describe, expect, it, vi } from 'vitest';
import { dispatchPendingTasks } from './dispatcher';
import { createSimulation, createSimulationState, stepSimulation } from './engine';
import { findShortestPath } from './pathfinding';

describe('pathfinding', () => {
  it('builds the irregular map preset with more cells than the standard map', () => {
    const state = createSimulationState({
      initialMapPreset: 'irregular',
    });

    expect(state.map.preset).toBe('irregular');
    expect(state.map.width).toBeGreaterThan(16);
    expect(state.map.height).toBeGreaterThan(10);
  });

  it('builds the irregular map preset with inactive cells excluded from task areas', () => {
    const state = createSimulationState({
      initialMapPreset: 'irregular',
    });

    expect(state.map.preset).toBe('irregular');
    expect(
      state.map.cells.flat().filter((cell) => cell === 'inactive').length,
    ).toBeGreaterThan(0);
    expect(
      state.map.taskPoints.some((point) => state.map.cells[point.y][point.x] === 'inactive'),
    ).toBe(false);
    expect(
      state.map.roadPoints.some((point) => state.map.cells[point.y][point.x] === 'inactive'),
    ).toBe(false);
    expect(
      state.map.vehicleStartPoints.some((point) => state.map.cells[point.y][point.x] === 'inactive'),
    ).toBe(false);
  });

  it('finds a shortest path around obstacles', () => {
    const state = createSimulationState();
    const path = findShortestPath(state.map, { x: 0, y: 0 }, { x: 6, y: 2 });

    expect(path).not.toBeNull();
    expect(path?.[0]).toEqual({ x: 0, y: 0 });
    expect(path?.[path.length - 1]).toEqual({ x: 6, y: 2 });
    expect(path?.some((point) => state.map.cells[point.y][point.x] === 'obstacle')).toBe(false);
  });

  it('does not route through inactive cells on the irregular map', () => {
    const state = createSimulationState({
      initialMapPreset: 'irregular',
    });
    const path = findShortestPath(state.map, { x: 0, y: 1 }, { x: 17, y: 12 });

    expect(path).not.toBeNull();
    expect(path?.some((point) => state.map.cells[point.y][point.x] === 'inactive')).toBe(false);
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
        assignedAt: null,
        pickedAt: null,
        completedAt: null,
        status: 'pending',
        batchedAtPickup: false,
      },
    ];

    dispatchPendingTasks(state);

    expect(state.tasks[0].assignedVehicleId).toBe('V1');
    expect(state.tasks[0].assignedAt).toBe(0);
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
        assignedAt: null,
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
        assignedAt: 0,
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
        assignedAt: null,
        pickedAt: null,
        completedAt: null,
        status: 'pending',
        batchedAtPickup: false,
      },
    ];

    dispatchPendingTasks(state);

    expect(state.tasks[1].assignedVehicleId).toBe('V1');
    expect(state.tasks[1].assignedAt).toBe(100);
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
        assignedAt: null,
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
  it('generates tasks faster at higher task load levels', () => {
    const lowState = createSimulationState({
      minTaskIntervalMs: 1000,
      maxTaskIntervalMs: 1000,
      initialTaskLoadLevel: 'low',
    });
    lowState.isRunning = true;

    stepSimulation(lowState, 1000);
    expect(lowState.tasks).toHaveLength(0);

    const highState = createSimulationState({
      minTaskIntervalMs: 1000,
      maxTaskIntervalMs: 1000,
      initialTaskLoadLevel: 'high',
    });
    highState.isRunning = true;

    stepSimulation(highState, 2000);
    expect(highState.tasks.length).toBeGreaterThan(0);
  });

  it('updates task load level through the controller', () => {
    const controller = createSimulation({
      minTaskIntervalMs: 1000,
      maxTaskIntervalMs: 1000,
    });

    expect(controller.getSnapshot().taskLoadLevel).toBe('medium');
    const initialTarget = controller.getSnapshot().targetTasksPerMinute;
    expect(initialTarget).toBeGreaterThan(0);
    controller.setTaskLoadLevel('high');
    expect(controller.getSnapshot().taskLoadLevel).toBe('high');
    expect(controller.getSnapshot().targetTasksPerMinute).toBeGreaterThan(initialTarget);
  });

  it('switches map preset through the controller', () => {
    const controller = createSimulation();

    expect(controller.getSnapshot().mapPreset).toBe('standard');
    controller.setMapPreset('irregular');

    const snapshot = controller.getSnapshot();
    expect(snapshot.mapPreset).toBe('irregular');
    expect(snapshot.map.width).toBeGreaterThan(16);
    expect(snapshot.map.height).toBeGreaterThan(10);
    expect(snapshot.map.cells.flat().some((cell) => cell === 'inactive')).toBe(true);
  });

  it('waits during loading before pickup completes', () => {
    const state = createSimulationState({
      minTaskIntervalMs: 999999,
      maxTaskIntervalMs: 999999,
      serviceDurationMs: 200,
    });

    state.tasks = [
      {
        id: 'T1',
        color: '#fff',
        pickup: { x: 2, y: 2 },
        dropoff: { x: 4, y: 2 },
        createdAt: 0,
        assignedVehicleId: 'V1',
        assignedAt: 0,
        pickedAt: null,
        completedAt: null,
        status: 'assigned',
        batchedAtPickup: false,
      },
    ];
    state.vehicles[0].position = { x: 2, y: 2 };
    state.vehicles[0].displayPosition = { x: 2, y: 2 };
    state.vehicles[0].routeStops = [
      { taskId: 'T1', kind: 'pickup', point: { x: 2, y: 2 } },
      { taskId: 'T1', kind: 'dropoff', point: { x: 4, y: 2 } },
    ];
    state.isRunning = true;

    stepSimulation(state, 80);

    expect(state.tasks[0].status).toBe('assigned');
    expect(state.vehicles[0].state).toBe('loading');
    expect(state.vehicles[0].load).toBe(0);
    expect(state.vehicles[0].operationRemainingMs).toBe(120);

    stepSimulation(state, 120);

    expect(state.tasks[0].status).toBe('picked');
    expect(state.tasks[0].pickedAt).toBe(200);
    expect(state.vehicles[0].load).toBe(1);
    expect(state.vehicles[0].state).toBe('delivering');
    expect(state.vehicles[0].routeStops).toHaveLength(1);
  });

  it('waits during unloading before dropoff completes', () => {
    const state = createSimulationState({
      minTaskIntervalMs: 999999,
      maxTaskIntervalMs: 999999,
      serviceDurationMs: 240,
    });

    state.simulationTime = 100;
    state.tasks = [
      {
        id: 'T1',
        color: '#fff',
        pickup: { x: 2, y: 2 },
        dropoff: { x: 4, y: 2 },
        createdAt: 0,
        assignedVehicleId: 'V1',
        assignedAt: 0,
        pickedAt: 50,
        completedAt: null,
        status: 'picked',
        batchedAtPickup: false,
      },
    ];
    state.vehicles[0].position = { x: 4, y: 2 };
    state.vehicles[0].displayPosition = { x: 4, y: 2 };
    state.vehicles[0].load = 1;
    state.vehicles[0].onboardTaskIds = ['T1'];
    state.vehicles[0].routeStops = [{ taskId: 'T1', kind: 'dropoff', point: { x: 4, y: 2 } }];
    state.isRunning = true;

    stepSimulation(state, 120);

    expect(state.tasks[0].status).toBe('picked');
    expect(state.vehicles[0].state).toBe('unloading');
    expect(state.vehicles[0].load).toBe(1);
    expect(state.vehicles[0].operationRemainingMs).toBe(120);

    stepSimulation(state, 120);

    expect(state.tasks[0].status).toBe('completed');
    expect(state.tasks[0].completedAt).toBe(340);
    expect(state.vehicles[0].load).toBe(0);
    expect(state.vehicles[0].state).toBe('idle');
    expect(state.vehicles[0].routeStops).toHaveLength(0);
  });

  it('keeps the current loading stop locked when inserting new tasks', () => {
    const state = createSimulationState();
    state.tasks = [
      {
        id: 'A',
        color: '#aaa',
        pickup: { x: 2, y: 4 },
        dropoff: { x: 6, y: 4 },
        createdAt: 0,
        assignedVehicleId: 'V1',
        assignedAt: 0,
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
        assignedAt: null,
        pickedAt: null,
        completedAt: null,
        status: 'pending',
        batchedAtPickup: false,
      },
    ];

    state.vehicles[0].position = { x: 2, y: 4 };
    state.vehicles[0].displayPosition = { x: 2, y: 4 };
    state.vehicles[0].routeStops = [
      { taskId: 'A', kind: 'pickup', point: { x: 2, y: 4 } },
      { taskId: 'A', kind: 'dropoff', point: { x: 6, y: 4 } },
    ];
    state.vehicles[0].activeStopKind = 'pickup';
    state.vehicles[0].operationRemainingMs = 200;
    state.vehicles[0].state = 'loading';

    dispatchPendingTasks(state);

    expect(state.tasks[1].assignedVehicleId).toBe('V1');
    expect(state.tasks[1].assignedAt).toBe(100);
    expect(state.vehicles[0].routeStops[0]).toEqual({
      taskId: 'A',
      kind: 'pickup',
      point: { x: 2, y: 4 },
    });
  });

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
      initialTaskLoadLevel: 'high',
    });

    state.isRunning = true;
    stepSimulation(state, 2000);
    expect(state.tasks.length).toBeGreaterThan(0);

    const controller = createSimulation({
      initialTaskLoadLevel: 'high',
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
