import { describe, expect, it } from 'vitest';
import { createSimulationState, type SimulationSnapshot } from '../simulation';
import {
  buildDashboardHistoryPoint,
  buildDashboardStats,
  type DashboardTrendPoint,
} from './dashboard';

function createSnapshot(): SimulationSnapshot {
  const state = createSimulationState({
    serviceDurationMs: 1_000,
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
    targetTasksPerMinute: 30,
    speed: state.speed,
    isRunning: state.isRunning,
  };
}

describe('dashboard analytics', () => {
  it('derives stage efficiency metrics from task lifecycle timestamps', () => {
    const snapshot = createSnapshot();
    snapshot.simulationTime = 30_000;
    snapshot.metrics.utilizationRate = 0.62;
    snapshot.metrics.batchingRate = 0.25;
    snapshot.tasks = [
      {
        id: 'A',
        color: '#fff',
        pickup: { x: 1, y: 1 },
        dropoff: { x: 2, y: 2 },
        createdAt: 0,
        assignedVehicleId: 'V1',
        assignedAt: 5_000,
        pickedAt: 9_000,
        completedAt: 15_000,
        status: 'completed',
        batchedAtPickup: false,
      },
      {
        id: 'B',
        color: '#fff',
        pickup: { x: 1, y: 2 },
        dropoff: { x: 3, y: 2 },
        createdAt: 6_000,
        assignedVehicleId: 'V2',
        assignedAt: 10_000,
        pickedAt: 16_000,
        completedAt: null,
        status: 'picked',
        batchedAtPickup: false,
      },
      {
        id: 'C',
        color: '#fff',
        pickup: { x: 2, y: 2 },
        dropoff: { x: 4, y: 2 },
        createdAt: 12_000,
        assignedVehicleId: 'V3',
        assignedAt: 18_000,
        pickedAt: null,
        completedAt: null,
        status: 'assigned',
        batchedAtPickup: false,
      },
      {
        id: 'D',
        color: '#fff',
        pickup: { x: 2, y: 3 },
        dropoff: { x: 4, y: 3 },
        createdAt: 21_000,
        assignedVehicleId: null,
        assignedAt: null,
        pickedAt: null,
        completedAt: null,
        status: 'pending',
        batchedAtPickup: false,
      },
    ];
    snapshot.vehicles[0].state = 'loading';
    snapshot.vehicles[1].state = 'delivering';
    snapshot.vehicles[2].state = 'to-pickup';

    const history: DashboardTrendPoint[] = [buildDashboardHistoryPoint(snapshot)];
    const stats = buildDashboardStats(snapshot, history);

    expect(stats.stageMetrics.find((metric) => metric.id === 'dispatch')?.averageMs).toBe(5_000);
    expect(stats.stageMetrics.find((metric) => metric.id === 'pickup')?.averageMs).toBe(5_000);
    expect(stats.stageMetrics.find((metric) => metric.id === 'transport')?.averageMs).toBe(6_000);
    expect(stats.kpis.find((metric) => metric.id === 'cycle')?.value).toBe('15.0s');
    expect(stats.vehicleStateCounts.find((item) => item.id === 'loading')?.value).toBe(1);
    expect(stats.taskStateCounts.find((item) => item.id === 'pending')?.value).toBe(1);
  });

  it('flags dispatch as bottleneck when pending queue grows', () => {
    const snapshot = createSnapshot();
    snapshot.simulationTime = 40_000;
    snapshot.metrics.utilizationRate = 0.84;
    snapshot.tasks = Array.from({ length: 6 }, (_, index) => ({
      id: `P${index}`,
      color: '#fff',
      pickup: { x: 1, y: 1 },
      dropoff: { x: 2, y: 2 },
      createdAt: index * 1_000,
      assignedVehicleId: null,
      assignedAt: null,
      pickedAt: null,
      completedAt: null,
      status: 'pending' as const,
      batchedAtPickup: false,
    }));

    const history: DashboardTrendPoint[] = [
      {
        time: 30_000,
        throughputPerMinute: 4,
        wipTasks: 2,
        utilizationRate: 0.76,
        pendingTasks: 2,
        assignedTasks: 0,
        pickedTasks: 0,
      },
      {
        time: 40_000,
        throughputPerMinute: 4,
        wipTasks: 6,
        utilizationRate: 0.84,
        pendingTasks: 6,
        assignedTasks: 0,
        pickedTasks: 0,
      },
    ];

    const stats = buildDashboardStats(snapshot, history);

    expect(stats.bottleneckSummary.stageLabel).toBe('调度派单');
    expect(stats.bottleneckSummary.backlogTrend).toBe('rising');
    expect(stats.bottleneckSummary.severity).toBe('alert');
  });
});
