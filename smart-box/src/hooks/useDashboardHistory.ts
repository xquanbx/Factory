import { useEffect, useState } from 'react';
import type { SimulationSnapshot } from '../simulation';
import {
  buildDashboardHistoryPoint,
  type DashboardTrendPoint,
} from '../analytics/dashboard';

export const HISTORY_SAMPLE_MS = 1_000;
export const HISTORY_RETENTION_MS = 90_000;

export function appendHistorySample(
  history: DashboardTrendPoint[],
  snapshot: SimulationSnapshot,
) {
  if (snapshot.simulationTime <= 0) {
    return [];
  }

  const nextPoint = buildDashboardHistoryPoint(snapshot);
  const trimmedHistory = history.filter(
    (point) => nextPoint.time - point.time <= HISTORY_RETENTION_MS,
  );
  const lastPoint = trimmedHistory[trimmedHistory.length - 1];

  if (!lastPoint || nextPoint.time < lastPoint.time) {
    return [nextPoint];
  }

  if (nextPoint.time - lastPoint.time < HISTORY_SAMPLE_MS) {
    return [...trimmedHistory.slice(0, -1), nextPoint];
  }

  return [...trimmedHistory, nextPoint];
}

export function useDashboardHistory(snapshot: SimulationSnapshot) {
  const [history, setHistory] = useState<DashboardTrendPoint[]>([]);

  useEffect(() => {
    setHistory((current) => appendHistorySample(current, snapshot));
  }, [snapshot]);

  return history;
}
