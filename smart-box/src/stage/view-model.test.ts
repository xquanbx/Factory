import { describe, expect, it } from 'vitest';
import type { SimulationSnapshot } from '../simulation';
import { createSimulationState } from '../simulation';
import {
  buildStageViewModel,
  buildTaskMarkers,
  buildVehicleCargoSlots,
  buildVehicleProgress,
  buildVehicleRoutePoints,
} from './view-model';

function createSnapshot(): SimulationSnapshot {
  const state = createSimulationState({
    serviceDurationMs: 1000,
  });

  return {
    map: state.map,
    tasks: [],
    vehicles: state.vehicles,
    metrics: {
      completedTasks: 0,
      pendingTasks: 0,
      averageWaitMs: 0,
      averageDeliveryMs: 0,
      utilizationRate: 0,
      batchingRate: 0,
    },
    simulationTime: 0,
    serviceDurationMs: state.config.serviceDurationMs,
    taskLoadLevel: state.taskLoadLevel,
    mapPreset: state.mapPreset,
    targetTasksPerMinute: 0,
    speed: state.speed,
    isRunning: state.isRunning,
  };
}

describe('stage view model', () => {
  it('keeps the remaining current path and future route stops in order', () => {
    const state = createSimulationState();
    const vehicle = state.vehicles[0];
    vehicle.position = { x: 1, y: 1 };
    vehicle.displayPosition = { x: 1.5, y: 1 };
    vehicle.currentPath = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ];
    vehicle.pathIndex = 0;
    vehicle.routeStops = [
      { taskId: 'T1', kind: 'pickup', point: { x: 3, y: 1 } },
      { taskId: 'T1', kind: 'dropoff', point: { x: 3, y: 4 } },
    ];

    const routePoints = buildVehicleRoutePoints(state.map, vehicle);

    expect(routePoints[0]).toEqual({ x: 1.5, y: 1 });
    expect(routePoints.slice(1, 4)).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ]);
    expect(routePoints[routePoints.length - 1]).toEqual({ x: 3, y: 4 });
  });

  it('shows pickup markers until cargo has been picked and keeps dropoff markers visible', () => {
    const markers = buildTaskMarkers([
      {
        id: 'T1',
        color: '#f97316',
        pickup: { x: 1, y: 2 },
        dropoff: { x: 3, y: 2 },
        createdAt: 0,
        assignedVehicleId: 'V1',
        pickedAt: null,
        completedAt: null,
        status: 'assigned',
        batchedAtPickup: false,
      },
      {
        id: 'T2',
        color: '#22c55e',
        pickup: { x: 4, y: 1 },
        dropoff: { x: 5, y: 1 },
        createdAt: 0,
        assignedVehicleId: 'V1',
        pickedAt: 100,
        completedAt: null,
        status: 'picked',
        batchedAtPickup: false,
      },
      {
        id: 'T3',
        color: '#38bdf8',
        pickup: { x: 6, y: 1 },
        dropoff: { x: 7, y: 1 },
        createdAt: 0,
        assignedVehicleId: 'V1',
        pickedAt: 100,
        completedAt: 200,
        status: 'completed',
        batchedAtPickup: false,
      },
    ]);

    expect(markers).toEqual([
      { taskId: 'T1', kind: 'dropoff', color: '#f97316', point: { x: 3, y: 2 } },
      { taskId: 'T1', kind: 'pickup', color: '#f97316', point: { x: 1, y: 2 } },
      { taskId: 'T2', kind: 'dropoff', color: '#22c55e', point: { x: 5, y: 1 } },
    ]);
  });

  it('maps onboard tasks into fixed cargo slots', () => {
    const state = createSimulationState();
    const vehicle = state.vehicles[0];
    vehicle.onboardTaskIds = ['T3', 'T1'];
    const slots = buildVehicleCargoSlots(vehicle, [
      {
        id: 'T1',
        color: '#f97316',
        pickup: { x: 1, y: 1 },
        dropoff: { x: 2, y: 1 },
        createdAt: 0,
        assignedVehicleId: 'V1',
        pickedAt: null,
        completedAt: null,
        status: 'assigned',
        batchedAtPickup: false,
      },
      {
        id: 'T3',
        color: '#38bdf8',
        pickup: { x: 3, y: 1 },
        dropoff: { x: 4, y: 1 },
        createdAt: 0,
        assignedVehicleId: 'V1',
        pickedAt: null,
        completedAt: null,
        status: 'assigned',
        batchedAtPickup: false,
      },
    ]);

    expect(slots).toEqual(['#38bdf8', '#f97316', null, null]);
  });

  it('derives loading and unloading progress with direction-aware fill ratios', () => {
    const state = createSimulationState({
      serviceDurationMs: 1000,
    });
    const vehicle = state.vehicles[0];
    vehicle.routeStops = [{ taskId: 'T1', kind: 'pickup', point: { x: 2, y: 2 } }];
    vehicle.activeStopKind = 'pickup';
    vehicle.operationRemainingMs = 250;
    vehicle.state = 'loading';

    const loading = buildVehicleProgress(
      vehicle,
      [
        {
          id: 'T1',
          color: '#f97316',
          pickup: { x: 2, y: 2 },
          dropoff: { x: 3, y: 2 },
          createdAt: 0,
          assignedVehicleId: 'V1',
          pickedAt: null,
          completedAt: null,
          status: 'assigned',
          batchedAtPickup: false,
        },
      ],
      1000,
    );

    vehicle.state = 'unloading';
    vehicle.activeStopKind = 'dropoff';
    const unloading = buildVehicleProgress(
      vehicle,
      [
        {
          id: 'T1',
          color: '#f97316',
          pickup: { x: 2, y: 2 },
          dropoff: { x: 3, y: 2 },
          createdAt: 0,
          assignedVehicleId: 'V1',
          pickedAt: null,
          completedAt: null,
          status: 'picked',
          batchedAtPickup: false,
        },
      ],
      1000,
    );

    expect(loading).toMatchObject({
      kind: 'loading',
      color: '#f97316',
      ratio: 0.75,
      filledRatio: 0.75,
    });
    expect(unloading).toMatchObject({
      kind: 'unloading',
      color: '#f97316',
      ratio: 0.75,
      filledRatio: 0.25,
    });
  });

  it('packages map cells, task markers, and vehicle state into a single shared model', () => {
    const snapshot = createSnapshot();
    snapshot.tasks = [
      {
        id: 'T1',
        color: '#f97316',
        pickup: { x: 1, y: 1 },
        dropoff: { x: 2, y: 1 },
        createdAt: 0,
        assignedVehicleId: null,
        pickedAt: null,
        completedAt: null,
        status: 'pending',
        batchedAtPickup: false,
      },
    ];

    const viewModel = buildStageViewModel(snapshot);

    expect(viewModel.map.cells).toHaveLength(snapshot.map.width * snapshot.map.height);
    expect(viewModel.taskMarkers).toHaveLength(2);
    expect(viewModel.vehicles).toHaveLength(snapshot.vehicles.length);
  });
});
