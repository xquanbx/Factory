import { useEffect, useRef, useState } from 'react';
import { FactoryStage } from './phaser/FactoryStage';
import {
  createSimulation,
  DEFAULT_SIMULATION_CONFIG,
  type SimulationController,
  type SimulationSnapshot,
  type Task,
  type Vehicle,
} from './simulation';

const SPEED_OPTIONS = [1, 2, 4];

function formatPoint(x: number, y: number) {
  return `(${x}, ${y})`;
}

function formatMs(ms: number) {
  if (ms <= 0) {
    return '0.0s';
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

function taskStatusLabel(task: Task) {
  switch (task.status) {
    case 'pending':
      return '待分配';
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

function vehicleStateLabel(vehicle: Vehicle) {
  switch (vehicle.state) {
    case 'idle':
      return '空闲';
    case 'to-pickup':
      return '去取货';
    case 'delivering':
      return '配送中';
    default:
      return vehicle.state;
  }
}

function useSimulation() {
  const controllerRef = useRef<SimulationController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createSimulation(DEFAULT_SIMULATION_CONFIG);
  }

  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() =>
    controllerRef.current!.getSnapshot(),
  );

  useEffect(() => {
    const controller = controllerRef.current!;
    const unsubscribe = controller.subscribe(setSnapshot);

    controller.start();

    return () => {
      unsubscribe();
      controller.pause();
    };
  }, []);

  return {
    snapshot,
    controller: controllerRef.current!,
  };
}

function App() {
  const { snapshot, controller } = useSimulation();
  const recentTasks = [...snapshot.tasks]
    .filter((task) => task.status !== 'completed')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);
  const idleVehicles = snapshot.vehicles.filter((vehicle) => vehicle.state === 'idle').length;

  return (
    <main className="app-shell">
      <section className="panel stage-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Simulation Area</p>
            <h1>工厂搬运调度地图</h1>
          </div>
          <span className="badge">{snapshot.isRunning ? '运行中' : '已暂停'}</span>
        </div>

        <div className="stage-summary">
          <div className="summary-pill">
            <span>地图</span>
            <strong>
              {snapshot.map.width} x {snapshot.map.height}
            </strong>
          </div>
          <div className="summary-pill">
            <span>车辆</span>
            <strong>{snapshot.vehicles.length} 台</strong>
          </div>
          <div className="summary-pill">
            <span>活跃任务</span>
            <strong>{snapshot.tasks.filter((task) => task.status !== 'completed').length}</strong>
          </div>
          <div className="summary-pill">
            <span>仿真时间</span>
            <strong>{formatMs(snapshot.simulationTime)}</strong>
          </div>
        </div>

        <div className="stage-frame">
          <FactoryStage snapshot={snapshot} />
          <div className="map-legend">
            <span className="legend-item">
              <i className="legend-swatch road" />
              道路
            </span>
            <span className="legend-item">
              <i className="legend-swatch obstacle" />
              障碍
            </span>
            <span className="legend-item">
              <i className="legend-dot pickup" />
              起点
            </span>
            <span className="legend-item">
              <i className="legend-dot dropoff" />
              终点
            </span>
            <span className="legend-item">
              <i className="legend-swatch vehicle" />
              小车
            </span>
          </div>
        </div>
      </section>

      <section className="panel split-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Control & Status</p>
            <h2>任务与调度面板</h2>
          </div>
          <span className="badge muted">Greedy + Batching</span>
        </div>

        <div className="split-stack">
          <article className="split-card">
            <div className="toolbar">
              <button type="button" className="action-button" onClick={() => controller.start()}>
                开始
              </button>
              <button type="button" className="action-button ghost" onClick={() => controller.pause()}>
                暂停
              </button>
              <button type="button" className="action-button ghost" onClick={() => controller.reset()}>
                重置
              </button>
            </div>

            <div className="speed-row">
              {SPEED_OPTIONS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className={`speed-chip ${snapshot.speed === speed ? 'active' : ''}`}
                  onClick={() => controller.setSpeed(speed)}
                >
                  {speed}x
                </button>
              ))}
            </div>

            <div className="mini-stats">
              <div className="mini-stat">
                <span>当前任务</span>
                <strong>{snapshot.tasks.filter((task) => task.status !== 'completed').length}</strong>
              </div>
              <div className="mini-stat">
                <span>空闲车辆</span>
                <strong>{idleVehicles}</strong>
              </div>
              <div className="mini-stat">
                <span>待分配</span>
                <strong>{snapshot.metrics.pendingTasks}</strong>
              </div>
            </div>

            <div className="list-block">
              <div className="list-head">
                <p className="card-title">任务列表</p>
                <span>{recentTasks.length} 条</span>
              </div>

              <div className="task-list">
                {recentTasks.length === 0 ? (
                  <p className="empty-copy">系统正在等待新任务生成。</p>
                ) : (
                  recentTasks.map((task) => (
                    <div key={task.id} className="task-row">
                      <span className="task-color" style={{ backgroundColor: task.color }} />
                      <div className="task-meta">
                        <strong>{task.id}</strong>
                        <span>
                          {formatPoint(task.pickup.x, task.pickup.y)} →{' '}
                          {formatPoint(task.dropoff.x, task.dropoff.y)}
                        </span>
                      </div>
                      <div className="task-side">
                        <span className={`status-chip ${task.status}`}>{taskStatusLabel(task)}</span>
                        <small>{task.assignedVehicleId ?? '未分配'}</small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="list-block">
              <div className="list-head">
                <p className="card-title">车辆状态</p>
                <span>{snapshot.vehicles.length} 台</span>
              </div>

              <div className="vehicle-list">
                {snapshot.vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="vehicle-row">
                    <span className="vehicle-badge" style={{ backgroundColor: vehicle.color }}>
                      {vehicle.id}
                    </span>
                    <div className="vehicle-meta">
                      <strong>{vehicleStateLabel(vehicle)}</strong>
                      <span>
                        位置 {formatPoint(vehicle.position.x, vehicle.position.y)} · 载货 {vehicle.load}/
                        {vehicle.capacity} · 剩余站点 {vehicle.routeStops.length}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="split-card accent">
            <div className="list-head">
              <p className="card-title">统计摘要</p>
              <span>持续更新</span>
            </div>

            <div className="metrics-grid">
              <div className="metric-card">
                <span>已完成任务</span>
                <strong>{snapshot.metrics.completedTasks}</strong>
              </div>
              <div className="metric-card">
                <span>当前待分配</span>
                <strong>{snapshot.metrics.pendingTasks}</strong>
              </div>
              <div className="metric-card">
                <span>平均等待</span>
                <strong>{formatMs(snapshot.metrics.averageWaitMs)}</strong>
              </div>
              <div className="metric-card">
                <span>平均送达</span>
                <strong>{formatMs(snapshot.metrics.averageDeliveryMs)}</strong>
              </div>
              <div className="metric-card">
                <span>车辆利用率</span>
                <strong>{(snapshot.metrics.utilizationRate * 100).toFixed(1)}%</strong>
              </div>
              <div className="metric-card">
                <span>拼单率</span>
                <strong>{(snapshot.metrics.batchingRate * 100).toFixed(1)}%</strong>
              </div>
            </div>

            <div className="insight-panel">
              <p className="card-title">当前节奏</p>
              <p className="card-copy">
                调度器会优先寻找最近可行车辆；如果忙碌车辆能在绕路阈值内顺路插单，也会把新任务插入既有路线。
              </p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

export default App;
