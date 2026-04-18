import type { SimulationSnapshot, TaskStatus, VehicleState } from '../simulation';

export type DashboardTone = 'healthy' | 'busy' | 'alert';
export type DashboardTrendDirection = 'rising' | 'stable' | 'falling';

export interface DashboardKpi {
  id: string;
  label: string;
  value: string;
  accent: string;
  detail: string;
}

export interface DashboardStageMetric {
  id: string;
  label: string;
  currentCount: number;
  averageMs: number;
  targetMs: number;
  tone: DashboardTone;
  description: string;
}

export interface DashboardCountItem {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface DashboardTrendPoint {
  time: number;
  throughputPerMinute: number;
  wipTasks: number;
  utilizationRate: number;
  pendingTasks: number;
  assignedTasks: number;
  pickedTasks: number;
}

export interface DashboardFunnelStage {
  id: string;
  stageLabel: string;
  value: number;
  detail: string;
  color: string;
}

export interface DashboardPerformanceGauge {
  id: string;
  label: string;
  value: number;
}

export interface DashboardHealthSummary {
  score: number;
  label: string;
  detail: string;
  color: string;
}

export interface DashboardBottleneckSummary {
  stageLabel: string;
  title: string;
  detail: string;
  recommendation: string;
  severity: DashboardTone;
  capacityTension: number;
  capacityLabel: string;
  backlogTrend: DashboardTrendDirection;
}

export interface DashboardStats {
  kpis: DashboardKpi[];
  healthSummary: DashboardHealthSummary;
  stageMetrics: DashboardStageMetric[];
  vehicleStateCounts: DashboardCountItem[];
  taskStateCounts: DashboardCountItem[];
  trendSeries: DashboardTrendPoint[];
  pipelineTotals: DashboardFunnelStage[];
  performanceGauges: DashboardPerformanceGauge[];
  bottleneckSummary: DashboardBottleneckSummary;
}

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '待派单',
  assigned: '待取货',
  picked: '运输中',
  completed: '已完成',
};

const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#f97316',
  assigned: '#38bdf8',
  picked: '#facc15',
  completed: '#22c55e',
};

const VEHICLE_STATE_LABELS: Record<VehicleState, string> = {
  idle: '空闲',
  'to-pickup': '去取货',
  loading: '装货中',
  delivering: '配送中',
  unloading: '卸货中',
};

const VEHICLE_STATE_COLORS: Record<VehicleState, string> = {
  idle: '#64748b',
  'to-pickup': '#38bdf8',
  loading: '#06b6d4',
  delivering: '#facc15',
  unloading: '#fb7185',
};

const STAGE_TARGETS = {
  dispatch: 4_000,
  pickup: 8_000,
  transport: 15_000,
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatSeconds(ms: number) {
  if (ms <= 0) {
    return '0.0s';
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function toneFromRatio(ratio: number): DashboardTone {
  if (ratio >= 1.35) {
    return 'alert';
  }

  if (ratio >= 0.9) {
    return 'busy';
  }

  return 'healthy';
}

function getHealthLabel(score: number) {
  if (score >= 85) {
    return '健康';
  }

  if (score >= 70) {
    return '稳定';
  }

  if (score >= 55) {
    return '承压';
  }

  return '预警';
}

function countRecentCompletions(snapshot: SimulationSnapshot, windowMs = 60_000) {
  const cutoff = snapshot.simulationTime - windowMs;

  return snapshot.tasks.filter(
    (task) => task.completedAt !== null && task.completedAt >= cutoff,
  ).length;
}

function getTaskStatusCounts(snapshot: SimulationSnapshot) {
  return snapshot.tasks.reduce(
    (counts, task) => {
      counts[task.status] += 1;
      return counts;
    },
    {
      pending: 0,
      assigned: 0,
      picked: 0,
      completed: 0,
    } satisfies Record<TaskStatus, number>,
  );
}

function getVehicleStateCounts(snapshot: SimulationSnapshot) {
  return snapshot.vehicles.reduce(
    (counts, vehicle) => {
      counts[vehicle.state] += 1;
      return counts;
    },
    {
      idle: 0,
      'to-pickup': 0,
      loading: 0,
      delivering: 0,
      unloading: 0,
    } satisfies Record<VehicleState, number>,
  );
}

export function buildDashboardHistoryPoint(snapshot: SimulationSnapshot): DashboardTrendPoint {
  const taskCounts = getTaskStatusCounts(snapshot);

  return {
    time: snapshot.simulationTime,
    throughputPerMinute: countRecentCompletions(snapshot),
    wipTasks: taskCounts.pending + taskCounts.assigned + taskCounts.picked,
    utilizationRate: snapshot.metrics.utilizationRate,
    pendingTasks: taskCounts.pending,
    assignedTasks: taskCounts.assigned,
    pickedTasks: taskCounts.picked,
  };
}

function deriveBacklogTrend(trendSeries: DashboardTrendPoint[]) {
  if (trendSeries.length < 2) {
    return 'stable' as DashboardTrendDirection;
  }

  const first = trendSeries[Math.max(0, trendSeries.length - 12)];
  const last = trendSeries[trendSeries.length - 1];
  const delta = last.wipTasks - first.wipTasks;

  if (delta >= 2) {
    return 'rising' as DashboardTrendDirection;
  }

  if (delta <= -2) {
    return 'falling' as DashboardTrendDirection;
  }

  return 'stable' as DashboardTrendDirection;
}

export function buildDashboardStats(
  snapshot: SimulationSnapshot,
  history: DashboardTrendPoint[],
): DashboardStats {
  const taskCounts = getTaskStatusCounts(snapshot);
  const vehicleCounts = getVehicleStateCounts(snapshot);
  const activeVehicleCount = snapshot.vehicles.filter((vehicle) => vehicle.state !== 'idle').length;
  const tasksAssigned = snapshot.tasks.filter((task) => task.assignedAt !== null);
  const tasksPicked = snapshot.tasks.filter(
    (task) => task.assignedAt !== null && task.pickedAt !== null,
  );
  const tasksCompleted = snapshot.tasks.filter(
    (task) =>
      task.assignedAt !== null && task.pickedAt !== null && task.completedAt !== null,
  );
  const dispatchAvg = average(
    tasksAssigned.map((task) => (task.assignedAt ?? task.createdAt) - task.createdAt),
  );
  const pickupAvg = average(
    tasksPicked.map((task) => (task.pickedAt ?? 0) - (task.assignedAt ?? task.createdAt)),
  );
  const transportAvg = average(
    tasksCompleted.map((task) => (task.completedAt ?? 0) - (task.pickedAt ?? 0)),
  );
  const totalCycleAvg = average(
    tasksCompleted.map((task) => (task.completedAt ?? 0) - task.createdAt),
  );
  const throughputPerMinute = countRecentCompletions(snapshot);
  const trendSeries =
    history.length > 0 || snapshot.simulationTime <= 0
      ? history
      : [buildDashboardHistoryPoint(snapshot)];
  const backlogTrend = deriveBacklogTrend(trendSeries);
  const wipTasks = taskCounts.pending + taskCounts.assigned + taskCounts.picked;
  const utilizationRate = snapshot.metrics.utilizationRate;
  const batchingRate = snapshot.metrics.batchingRate;
  const activeVehicleRate =
    snapshot.vehicles.length === 0 ? 0 : activeVehicleCount / snapshot.vehicles.length;
  const loadingCount = vehicleCounts.loading;
  const unloadingCount = vehicleCounts.unloading;
  const serviceCount = loadingCount + unloadingCount;
  const capacityTension = clamp(
    utilizationRate * 0.65 + clamp(wipTasks / Math.max(snapshot.vehicles.length * 2, 1), 0, 1) * 0.35,
    0,
    1,
  );
  const healthPenalty =
    taskCounts.pending * 4 +
    taskCounts.assigned * 3 +
    taskCounts.picked * 2 +
    Math.round(capacityTension * 28) +
    (backlogTrend === 'rising' ? 10 : backlogTrend === 'stable' ? 4 : 0) +
    (utilizationRate >= 0.82 ? 12 : utilizationRate >= 0.65 ? 6 : 0);
  const healthScore = clamp(100 - healthPenalty, 28, 98);
  const healthLabel = getHealthLabel(healthScore);
  const healthColor =
    healthScore >= 85 ? '#22c55e' : healthScore >= 70 ? '#38bdf8' : healthScore >= 55 ? '#facc15' : '#fb7185';

  const stageMetrics: DashboardStageMetric[] = [
    {
      id: 'dispatch',
      label: '调度响应',
      currentCount: taskCounts.pending,
      averageMs: dispatchAvg,
      targetMs: STAGE_TARGETS.dispatch,
      tone: toneFromRatio(
        Math.max(taskCounts.pending / Math.max(snapshot.vehicles.length, 1), dispatchAvg / STAGE_TARGETS.dispatch),
      ),
      description: `${taskCounts.pending} 个任务等待下发，平均派单等待 ${formatSeconds(dispatchAvg)}`,
    },
    {
      id: 'pickup',
      label: '取货执行',
      currentCount: taskCounts.assigned,
      averageMs: pickupAvg,
      targetMs: STAGE_TARGETS.pickup,
      tone: toneFromRatio(
        Math.max(taskCounts.assigned / Math.max(snapshot.vehicles.length, 1), pickupAvg / STAGE_TARGETS.pickup),
      ),
      description: `${taskCounts.assigned} 个任务待取货，平均取货等待 ${formatSeconds(pickupAvg)}`,
    },
    {
      id: 'transport',
      label: '在途运输',
      currentCount: taskCounts.picked,
      averageMs: transportAvg,
      targetMs: STAGE_TARGETS.transport,
      tone: toneFromRatio(
        Math.max(taskCounts.picked / Math.max(snapshot.vehicles.length, 1), transportAvg / STAGE_TARGETS.transport),
      ),
      description: `${taskCounts.picked} 个任务运输中，平均运输时长 ${formatSeconds(transportAvg)}`,
    },
    {
      id: 'service',
      label: '装卸协同',
      currentCount: serviceCount,
      averageMs: snapshot.serviceDurationMs,
      targetMs: snapshot.serviceDurationMs,
      tone: toneFromRatio(clamp(serviceCount / Math.max(snapshot.vehicles.length / 2, 1), 0, 2)),
      description: `${loadingCount} 台装货 / ${unloadingCount} 台卸货，标准装卸节拍 ${formatSeconds(snapshot.serviceDurationMs)}`,
    },
  ];

  let bottleneckSummary: DashboardBottleneckSummary;

  if (taskCounts.pending >= Math.max(3, snapshot.vehicles.length) || dispatchAvg > 7_000) {
    bottleneckSummary = {
      stageLabel: '调度派单',
      title: '待派单任务出现积压',
      detail: `当前有 ${taskCounts.pending} 个任务还未派出，平均派单等待 ${formatSeconds(dispatchAvg)}，前端调度压力已经显性化。`,
      recommendation: '建议增加可用车辆或提升派单优先级策略，优先清空待派单队列。',
      severity: taskCounts.pending >= Math.max(4, snapshot.vehicles.length + 1) ? 'alert' : 'busy',
      capacityTension,
      capacityLabel: capacityTension >= 0.82 ? '产能紧张' : '负荷偏高',
      backlogTrend,
    };
  } else if (taskCounts.assigned >= Math.max(3, snapshot.vehicles.length) || pickupAvg > 12_000) {
    bottleneckSummary = {
      stageLabel: '取货执行',
      title: '车辆到货前等待偏长',
      detail: `待取货任务 ${taskCounts.assigned} 个，平均取货等待 ${formatSeconds(pickupAvg)}，说明车辆到取货点的响应速度偏慢。`,
      recommendation: '建议优化派单插单顺序，优先压缩车辆空驶到取货点的距离。',
      severity: taskCounts.assigned >= Math.max(4, snapshot.vehicles.length + 1) ? 'alert' : 'busy',
      capacityTension,
      capacityLabel: capacityTension >= 0.82 ? '产能紧张' : '执行偏慢',
      backlogTrend,
    };
  } else if (taskCounts.picked >= Math.max(4, snapshot.vehicles.length + 1) || transportAvg > 18_000) {
    bottleneckSummary = {
      stageLabel: '在途运输',
      title: '运输链路成为主要耗时',
      detail: `运输中任务 ${taskCounts.picked} 个，平均运输时长 ${formatSeconds(transportAvg)}，当前主要压力在运输和送达环节。`,
      recommendation: '建议优化回程合单策略和路径规划，减少空驶与绕行距离。',
      severity: taskCounts.picked >= Math.max(5, snapshot.vehicles.length + 2) ? 'alert' : 'busy',
      capacityTension,
      capacityLabel: capacityTension >= 0.82 ? '产能紧张' : '运输偏慢',
      backlogTrend,
    };
  } else if (utilizationRate >= 0.82 && backlogTrend === 'rising') {
    bottleneckSummary = {
      stageLabel: '产能边界',
      title: '系统接近满负荷运行',
      detail: `当前车辆利用率 ${formatPercent(utilizationRate)}，且在制任务呈上升趋势，说明系统已经逼近产能边界。`,
      recommendation: '建议在高负载演示中强调 AI 拼单与动态派单对稳住吞吐的价值。',
      severity: 'alert',
      capacityTension,
      capacityLabel: '产能紧张',
      backlogTrend,
    };
  } else {
    bottleneckSummary = {
      stageLabel: '运行平稳',
      title: '系统运行处于可控区间',
      detail: `当前在制任务 ${wipTasks} 个，车辆利用率 ${formatPercent(utilizationRate)}，各环节暂未出现明显瓶颈。`,
      recommendation: '可切换更高任务负荷或更复杂地图，展示系统在压力提升后的调度稳定性。',
      severity: 'healthy',
      capacityTension,
      capacityLabel: capacityTension >= 0.58 ? '平稳偏满' : '产能充足',
      backlogTrend,
    };
  }

  return {
    kpis: [
      {
        id: 'throughput',
        label: '实时吞吐',
        value: `${throughputPerMinute}`,
        accent: '#38bdf8',
        detail: '最近 60 秒完成任务数 / 分钟',
      },
      {
        id: 'wip',
        label: '在制任务',
        value: `${wipTasks}`,
        accent: '#facc15',
        detail: `待派单 ${taskCounts.pending} / 待取货 ${taskCounts.assigned} / 运输中 ${taskCounts.picked}`,
      },
      {
        id: 'cycle',
        label: '平均总周转',
        value: formatSeconds(totalCycleAvg),
        accent: '#fb7185',
        detail: '从任务生成到完成的平均耗时',
      },
      {
        id: 'utilization',
        label: '车辆利用率',
        value: formatPercent(utilizationRate),
        accent: '#34d399',
        detail: '累计忙碌时间占总运行时间的比例',
      },
      {
        id: 'batching',
        label: '拼单率',
        value: formatPercent(batchingRate),
        accent: '#a78bfa',
        detail: '完成任务中采用顺路拼单的占比',
      },
      {
        id: 'activity',
        label: '当前活跃车辆占比',
        value: formatPercent(activeVehicleRate),
        accent: '#f97316',
        detail: `${activeVehicleCount}/${snapshot.vehicles.length} 台车辆处于作业中`,
      },
    ],
    healthSummary: {
      score: healthScore,
      label: healthLabel,
      detail: `${bottleneckSummary.stageLabel} · ${bottleneckSummary.capacityLabel}`,
      color: healthColor,
    },
    stageMetrics,
    vehicleStateCounts: (Object.keys(VEHICLE_STATE_LABELS) as VehicleState[]).map((key) => ({
      id: key,
      label: VEHICLE_STATE_LABELS[key],
      value: vehicleCounts[key],
      color: VEHICLE_STATE_COLORS[key],
    })),
    taskStateCounts: (Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((key) => ({
      id: key,
      label: TASK_STATUS_LABELS[key],
      value: taskCounts[key],
      color: TASK_STATUS_COLORS[key],
    })),
    trendSeries,
    pipelineTotals: [
      {
        id: 'created',
        stageLabel: '任务生成',
        value: snapshot.tasks.length,
        detail: `目标负荷 ${snapshot.targetTasksPerMinute} 个/分钟`,
        color: '#38bdf8',
      },
      {
        id: 'assigned',
        stageLabel: '已派单',
        value: tasksAssigned.length,
        detail: `平均派单等待 ${formatSeconds(dispatchAvg)}`,
        color: '#06b6d4',
      },
      {
        id: 'picked',
        stageLabel: '已取货',
        value: tasksPicked.length,
        detail: `平均取货等待 ${formatSeconds(pickupAvg)}`,
        color: '#facc15',
      },
      {
        id: 'completed',
        stageLabel: '已完成',
        value: tasksCompleted.length,
        detail: `平均运输时长 ${formatSeconds(transportAvg)}`,
        color: '#22c55e',
      },
    ],
    performanceGauges: [
      {
        id: 'utilization',
        label: '利用率',
        value: utilizationRate,
      },
      {
        id: 'batching',
        label: '拼单率',
        value: batchingRate,
      },
      {
        id: 'activity',
        label: '活跃率',
        value: activeVehicleRate,
      },
    ],
    bottleneckSummary,
  };
}
