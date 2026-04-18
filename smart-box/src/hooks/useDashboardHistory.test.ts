import { describe, expect, it } from 'vitest';
import { createSimulationState, type SimulationSnapshot } from '../simulation';
import { appendHistorySample } from './useDashboardHistory';

function createSnapshot(): SimulationSnapshot {
  const state = createSimulationState();

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

describe('dashboard history', () => {
  it('samples once per second and replaces too-dense points', () => {
    const snapshot = createSnapshot();
    snapshot.simulationTime = 2_000;

    const first = appendHistorySample([], snapshot);
    expect(first).toHaveLength(1);

    snapshot.simulationTime = 2_400;
    const replaced = appendHistorySample(first, snapshot);
    expect(replaced).toHaveLength(1);
    expect(replaced[0].time).toBe(2_400);

    snapshot.simulationTime = 3_500;
    const expanded = appendHistorySample(replaced, snapshot);
    expect(expanded).toHaveLength(2);
    expect(expanded[1].time).toBe(3_500);
  });

  it('clears history when simulation resets to zero', () => {
    const snapshot = createSnapshot();
    snapshot.simulationTime = 1_000;

    const history = appendHistorySample([], snapshot);
    expect(history).toHaveLength(1);

    snapshot.simulationTime = 0;
    expect(appendHistorySample(history, snapshot)).toEqual([]);
  });
});
