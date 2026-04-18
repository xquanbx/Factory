import { useEffect, useRef, useState } from 'react';
import type { DashboardStats } from '../analytics/dashboard';
import type { SimulationSnapshot } from '../simulation';
import { BottleneckCard } from './BottleneckCard';
import { HealthScorePanel } from './HealthScorePanel';
import { KpiStrip } from './KpiStrip';
import { StageFunnelChart } from './StageFunnelChart';
import { StatusDonutChart } from './StatusDonutChart';
import { TrendChart } from './TrendChart';

interface DashboardStageProps {
  snapshot: SimulationSnapshot;
  stats: DashboardStats;
}

const DASHBOARD_WIDTH = 1520;
const DASHBOARD_HEIGHT = 920;

export function DashboardStage({ snapshot, stats }: DashboardStageProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const activeVehicleRate =
    stats.performanceGauges.find((item) => item.id === 'activity')?.value ?? 0;
  const summaryItems = [
    {
      id: 'sim-time',
      label: '仿真时间',
      value: `${(snapshot.simulationTime / 1000).toFixed(0)}s`,
      accent: '#06b6d4',
      detail: '当前仿真运行时长',
    },
    {
      id: 'active-rate',
      label: '活跃车辆',
      value: `${Math.round(activeVehicleRate * 100)}%`,
      accent: '#f97316',
      detail: '非空闲车辆占比',
    },
    {
      id: 'completed-total',
      label: '已完成任务',
      value: `${snapshot.metrics.completedTasks}`,
      accent: '#22c55e',
      detail: '累计完成搬运任务数',
    },
    ...stats.kpis.slice(0, 4),
  ];

  useEffect(() => {
    const container = shellRef.current;
    if (!container) {
      return;
    }

    const updateScale = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) {
        return;
      }

      const nextScale = Math.min(width / DASHBOARD_WIDTH, height / DASHBOARD_HEIGHT, 1);
      setScale(nextScale);
    };

    updateScale();

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={shellRef} className="stage-dashboard-shell">
      <div
        className="stage-dashboard-viewport"
        style={{
          width: `${DASHBOARD_WIDTH * scale}px`,
          height: `${DASHBOARD_HEIGHT * scale}px`,
        }}
      >
        <div
          className="stage-dashboard"
          style={{
            width: `${DASHBOARD_WIDTH}px`,
            height: `${DASHBOARD_HEIGHT}px`,
            transform: `scale(${scale})`,
          }}
        >
          <div className="stage-dashboard-kpis">
            <KpiStrip items={summaryItems} />
          </div>

          <div className="stage-dashboard-grid">
            <div className="stage-dashboard-main">
              <div className="stage-dashboard-chart-grid">
                <HealthScorePanel health={stats.healthSummary} />
                <StatusDonutChart
                  title="任务状态分布"
                  subtitle="观察队列结构是否健康"
                  data={stats.taskStateCounts}
                  centerValue={`${stats.taskStateCounts.reduce((sum, item) => sum + item.value, 0)}`}
                  centerLabel="累计任务"
                />
                <StageFunnelChart data={stats.pipelineTotals} />
                <TrendChart data={stats.trendSeries} />
              </div>
            </div>

            <div className="stage-dashboard-side">
              <BottleneckCard
                summary={stats.bottleneckSummary}
                stageMetrics={stats.stageMetrics}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
