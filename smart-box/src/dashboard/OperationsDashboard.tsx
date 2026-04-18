import { FactoryViewport } from '../stage/FactoryViewport';
import type { StageMode } from '../stage/types';
import type { DashboardStats } from '../analytics/dashboard';
import type { MapPreset, SimulationSnapshot, Task, TaskLoadLevel } from '../simulation';
import { formatTaskLabel } from '../utils/task-label';
import { BottleneckCard } from './BottleneckCard';
import { KpiStrip } from './KpiStrip';
import { PerformanceGaugeChart } from './PerformanceGaugeChart';
import { StageFunnelChart } from './StageFunnelChart';
import { StatusDonutChart } from './StatusDonutChart';
import { TrendChart } from './TrendChart';

interface Option<T> {
  label: string;
  value: T;
}

interface InstructionItem {
  id: string;
  color: string;
  title: string;
  detail: string;
  meta: string;
  status: string;
}

interface OperationsDashboardProps {
  snapshot: SimulationSnapshot;
  stats: DashboardStats;
  appMode: 'dispatch' | 'dashboard';
  stageMode: StageMode;
  showVehicleRoutes: boolean;
  taskLoadOptions: Array<Option<TaskLoadLevel>>;
  mapPresetOptions: Array<Option<MapPreset>>;
  recentTasks: Task[];
  instructions: InstructionItem[];
  onReset: () => void;
  onAppModeChange: (mode: 'dispatch' | 'dashboard') => void;
  onToggleRoutes: () => void;
  onStageModeChange: (mode: StageMode) => void;
  onMapPresetChange: (preset: MapPreset) => void;
  onTaskLoadChange: (level: TaskLoadLevel) => void;
}

function formatPoint(x: number, y: number) {
  return `(${x}, ${y})`;
}

function taskStatusLabel(task: Task) {
  switch (task.status) {
    case 'pending':
      return '待派单';
    case 'assigned':
      return '待取货';
    case 'picked':
      return '运输中';
    case 'completed':
      return '已完成';
    default:
      return task.status;
  }
}

export function OperationsDashboard({
  snapshot,
  stats,
  appMode,
  stageMode,
  showVehicleRoutes,
  taskLoadOptions,
  mapPresetOptions,
  recentTasks,
  instructions,
  onReset,
  onAppModeChange,
  onToggleRoutes,
  onStageModeChange,
  onMapPresetChange,
  onTaskLoadChange,
}: OperationsDashboardProps) {
  const activeVehicleRate = stats.performanceGauges.find((item) => item.id === 'activity')?.value ?? 0;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-title-group">
          <div className="page-mode-switch page-mode-switch-inline">
            <button
              type="button"
              className={`page-mode-button ${appMode === 'dispatch' ? 'active' : ''}`}
              onClick={() => onAppModeChange('dispatch')}
            >
              调度视图
            </button>
            <button
              type="button"
              className={`page-mode-button ${appMode === 'dashboard' ? 'active' : ''}`}
              onClick={() => onAppModeChange('dashboard')}
            >
              运营大屏
            </button>
          </div>
          <span className="dashboard-eyebrow dashboard-eyebrow-large">AI Dispatch Cockpit</span>
          <h1>智能调度运营大屏</h1>
          <p>
            用实时地图、环节转化和运行诊断，集中展示当前各环节效率与调度价值。
          </p>
        </div>

        <div className="dashboard-control-wall">
          <button type="button" className="action-button" onClick={onReset}>
            重置仿真
          </button>
          <button
            type="button"
            aria-pressed={showVehicleRoutes}
            className={`toggle-button ${showVehicleRoutes ? 'active' : ''}`}
            onClick={onToggleRoutes}
          >
            {showVehicleRoutes ? '轨迹已开启' : '显示轨迹'}
          </button>

          <div className="dashboard-pill-control">
            <div className="dashboard-pill-meta">
              <span>视图模式</span>
              <small>{stageMode === '2d' ? 'Phaser 2D' : 'Babylon 3D'}</small>
            </div>
            <div className="stage-mode-options">
              <button
                type="button"
                aria-pressed={stageMode === '2d'}
                className={`stage-mode-button ${stageMode === '2d' ? 'active' : ''}`}
                onClick={() => onStageModeChange('2d')}
              >
                2D
              </button>
              <button
                type="button"
                aria-pressed={stageMode === '3d'}
                className={`stage-mode-button ${stageMode === '3d' ? 'active' : ''}`}
                onClick={() => onStageModeChange('3d')}
              >
                3D
              </button>
            </div>
          </div>

          <div className="dashboard-pill-control">
            <div className="dashboard-pill-meta">
              <span>地图参数</span>
              <small>
                {snapshot.map.width} x {snapshot.map.height} 格
              </small>
            </div>
            <div className="map-preset-options">
              {mapPresetOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={snapshot.mapPreset === option.value}
                  className={`map-preset-button ${snapshot.mapPreset === option.value ? 'active' : ''}`}
                  onClick={() => onMapPresetChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dashboard-pill-control">
            <div className="dashboard-pill-meta">
              <span>任务繁忙度</span>
              <small>目标 {snapshot.targetTasksPerMinute} 个/分钟</small>
            </div>
            <div className="task-load-options">
              {taskLoadOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={snapshot.taskLoadLevel === option.value}
                  className={`task-load-button ${option.value} ${snapshot.taskLoadLevel === option.value ? 'active' : ''}`}
                  onClick={() => onTaskLoadChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <KpiStrip items={stats.kpis} />

      <section className="dashboard-grid">
        <article className="dashboard-panel dashboard-map-panel">
          <div className="dashboard-panel-head">
            <div>
              <span className="dashboard-eyebrow">现场态势</span>
              <h3>工厂搬运地图</h3>
            </div>
            <small>
              活跃车辆 {Math.round(activeVehicleRate * 100)}% · 已完成 {snapshot.metrics.completedTasks} 单
            </small>
          </div>

          <div className="dashboard-map-meta">
            <div className="map-meta-card">
              <span>仿真时间</span>
              <strong>{(snapshot.simulationTime / 1000).toFixed(0)}s</strong>
            </div>
            <div className="map-meta-card">
              <span>平均等待</span>
              <strong>{(snapshot.metrics.averageWaitMs / 1000).toFixed(1)}s</strong>
            </div>
            <div className="map-meta-card">
              <span>平均送达</span>
              <strong>{(snapshot.metrics.averageDeliveryMs / 1000).toFixed(1)}s</strong>
            </div>
          </div>

          <div className="dashboard-map-stage">
            <FactoryViewport
              snapshot={snapshot}
              showVehicleRoutes={showVehicleRoutes}
              stageMode={stageMode}
            />
          </div>

          <div className="dashboard-map-footer">
            <div className="map-signal-list">
              <span className="legend-item">
                <i className="legend-swatch road" />
                道路
              </span>
              <span className="legend-item">
                <i className="legend-swatch obstacle" />
                障碍
              </span>
              <span className="legend-item">
                <i className="legend-swatch inactive" />
                封闭区
              </span>
              <span className="legend-item">
                <i className="legend-dot pickup" />
                起点
              </span>
              <span className="legend-item">
                <i className="legend-dot dropoff" />
                终点
              </span>
            </div>
            <p>
              AI 调度价值说明：把现场位置、队列积压和车辆状态转成统一可解释指标，让效率提升可视化。
            </p>
          </div>
        </article>

        <div className="dashboard-rail">
          <div className="dashboard-rail-grid">
            <StatusDonutChart
              title="车辆状态分布"
              subtitle="中心数值展示当前活跃率"
              data={stats.vehicleStateCounts}
              centerValue={`${Math.round(activeVehicleRate * 100)}%`}
              centerLabel="活跃率"
            />
            <StatusDonutChart
              title="任务状态分布"
              subtitle="观察当前队列结构是否健康"
              data={stats.taskStateCounts}
              centerValue={`${stats.taskStateCounts.reduce((sum, item) => sum + item.value, 0)}`}
              centerLabel="累计任务"
            />
            <StageFunnelChart data={stats.pipelineTotals} />
            <PerformanceGaugeChart data={stats.performanceGauges} />
          </div>

          <BottleneckCard summary={stats.bottleneckSummary} stageMetrics={stats.stageMetrics} />

          <article className="dashboard-panel queue-panel">
            <div className="dashboard-panel-head">
              <div>
                <span className="dashboard-eyebrow">任务看板</span>
                <h3>关键任务与调度指令</h3>
              </div>
              <small>{instructions.length} 条关键动作</small>
            </div>

            <div className="queue-panel-body">
              <div className="queue-task-list">
                {recentTasks.length === 0 ? (
                  <p className="empty-copy">当前没有活跃任务，系统正在等待新任务进入。</p>
                ) : (
                  recentTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="queue-task-row">
                      <span className="task-color" style={{ backgroundColor: task.color }} />
                      <div className="queue-task-meta">
                        <strong>{formatTaskLabel(task.id)}</strong>
                        <span>
                          {formatPoint(task.pickup.x, task.pickup.y)} → {formatPoint(task.dropoff.x, task.dropoff.y)}
                        </span>
                      </div>
                      <span className={`status-chip ${task.status}`}>{taskStatusLabel(task)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="dashboard-instruction-feed">
                {instructions.slice(0, 4).map((instruction) => (
                  <div key={instruction.id} className="instruction-row compact">
                    <span className="instruction-color" style={{ backgroundColor: instruction.color }} />
                    <div className="instruction-meta">
                      <div className="instruction-head">
                        <strong>{instruction.title}</strong>
                        <span className="instruction-chip active">{instruction.status}</span>
                      </div>
                      <span>{instruction.detail}</span>
                      <small>{instruction.meta}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      <TrendChart data={stats.trendSeries} />
    </main>
  );
}
