import { useEffect, useRef, useState } from 'react';
import {
  createSimulation,
  DEFAULT_SIMULATION_CONFIG,
  type MapPreset,
  type SimulationController,
  type SimulationSnapshot,
  type Task,
  type TaskLoadLevel,
  type Vehicle,
} from './simulation';
import { FactoryViewport } from './stage/FactoryViewport';
import type { StageMode } from './stage/types';

function formatPoint(x: number, y: number) {
  return `(${x}, ${y})`;
}

function formatMs(ms: number) {
  if (ms <= 0) {
    return '0.0s';
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

const TASK_LOAD_OPTIONS: Array<{ label: string; value: TaskLoadLevel }> = [
  { label: '10', value: 'low' },
  { label: '30', value: 'medium' },
  { label: '60', value: 'high' },
];

const MAP_PRESET_OPTIONS: Array<{ label: string; value: MapPreset }> = [
  { label: '标准', value: 'standard' },
  { label: '大型', value: 'irregular' },
];

interface InstructionItem {
  id: string;
  color: string;
  title: string;
  detail: string;
  meta: string;
  status: string;
  level: 'active' | 'queued' | 'pending';
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
    case 'loading':
      return '装货中';
    case 'delivering':
      return '配送中';
    case 'unloading':
      return '卸货中';
    default:
      return vehicle.state;
  }
}

function buildVehicleInstruction(task: Task, vehicle: Vehicle, isPrimary: boolean): InstructionItem {
  const pickup = formatPoint(task.pickup.x, task.pickup.y);
  const dropoff = formatPoint(task.dropoff.x, task.dropoff.y);
  const current = formatPoint(vehicle.position.x, vehicle.position.y);
  const activeTaskId = vehicle.routeStops[0]?.taskId ?? vehicle.onboardTaskIds[0];
  const isActiveTask = activeTaskId === task.id;
  const onboard = vehicle.onboardTaskIds.includes(task.id);

  if (isActiveTask && vehicle.state === 'to-pickup') {
    return {
      id: `${vehicle.id}-${task.id}-pickup`,
      color: task.color,
      title: `${vehicle.id} 前往 ${pickup}`,
      detail: `从 ${current} 去装载 ${task.id}，完成后送往 ${dropoff}`,
      meta: `${vehicle.id} · 货物 ${task.id}`,
      status: '执行中',
      level: 'active',
    };
  }

  if (isActiveTask && vehicle.state === 'loading') {
    return {
      id: `${vehicle.id}-${task.id}-loading`,
      color: task.color,
      title: `${vehicle.id} 在 ${pickup} 装货`,
      detail: `正在装载 ${task.id}，装载完成后前往 ${dropoff}`,
      meta: `${vehicle.id} · 货物 ${task.id}`,
      status: '装货中',
      level: 'active',
    };
  }

  if (isActiveTask && vehicle.state === 'delivering') {
    return {
      id: `${vehicle.id}-${task.id}-delivering`,
      color: task.color,
      title: `${vehicle.id} 运送 ${task.id}`,
      detail: `货物从 ${pickup} 运往 ${dropoff}，车辆当前位于 ${current}`,
      meta: `${vehicle.id} · 货物 ${task.id}`,
      status: '运输中',
      level: 'active',
    };
  }

  if (isActiveTask && vehicle.state === 'unloading') {
    return {
      id: `${vehicle.id}-${task.id}-unloading`,
      color: task.color,
      title: `${vehicle.id} 在 ${dropoff} 卸货`,
      detail: `正在卸载 ${task.id}，完成后本条任务结束`,
      meta: `${vehicle.id} · 货物 ${task.id}`,
      status: '卸货中',
      level: 'active',
    };
  }

  if (onboard) {
    return {
      id: `${vehicle.id}-${task.id}-queued-dropoff`,
      color: task.color,
      title: `${vehicle.id} 后续送达 ${task.id}`,
      detail: `货物已在车上，稍后送往 ${dropoff}`,
      meta: `${vehicle.id} · 货物 ${task.id}`,
      status: '排队中',
      level: isPrimary ? 'active' : 'queued',
    };
  }

  return {
    id: `${vehicle.id}-${task.id}-queued-pickup`,
    color: task.color,
    title: `${vehicle.id} 后续取货 ${task.id}`,
    detail: `后续前往 ${pickup} 装载，再运送至 ${dropoff}`,
    meta: `${vehicle.id} · 货物 ${task.id}`,
    status: '待执行',
    level: isPrimary ? 'active' : 'queued',
  };
}

function buildPendingInstruction(task: Task): InstructionItem {
  const pickup = formatPoint(task.pickup.x, task.pickup.y);
  const dropoff = formatPoint(task.dropoff.x, task.dropoff.y);

  return {
    id: `pending-${task.id}`,
    color: task.color,
    title: `等待下发 ${task.id}`,
    detail: `待调度车辆从 ${pickup} 取货，并送往 ${dropoff}`,
    meta: `待分配 · 货物 ${task.id}`,
    status: '待调度',
    level: 'pending',
  };
}

function buildInstructionItems(snapshot: SimulationSnapshot) {
  const tasksById = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const activeItems: InstructionItem[] = [];
  const queuedItems: InstructionItem[] = [];

  for (const vehicle of snapshot.vehicles) {
    const taskIds = Array.from(
      new Set([
        ...vehicle.routeStops.map((stop) => stop.taskId),
        ...vehicle.onboardTaskIds,
      ]),
    );

    taskIds.forEach((taskId, index) => {
      const task = tasksById.get(taskId);
      if (!task || task.status === 'completed') {
        return;
      }

      const item = buildVehicleInstruction(task, vehicle, index === 0);
      if (item.level === 'active') {
        activeItems.push(item);
      } else {
        queuedItems.push(item);
      }
    });
  }

  const pendingItems = snapshot.tasks
    .filter((task) => task.status === 'pending')
    .map((task) => buildPendingInstruction(task));

  return [...activeItems, ...queuedItems, ...pendingItems].slice(0, 10);
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
  const [activeTab, setActiveTab] = useState<'tasks' | 'instructions' | 'vehicles'>('tasks');
  const [showVehicleRoutes, setShowVehicleRoutes] = useState(true);
  const [stageMode, setStageMode] = useState<StageMode>('2d');
  const recentTasks = [...snapshot.tasks]
    .filter((task) => task.status !== 'completed')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);
  const instructions = buildInstructionItems(snapshot);

  return (
    <main className="app-shell">
      <section className="panel stage-panel">
        <div className="panel-header">
          <div className="stage-heading">
            <h1>工厂搬运调度地图</h1>
            <div className="stage-controls">
              <button type="button" className="action-button ghost" onClick={() => controller.reset()}>
                重新开始
              </button>
              <button
                type="button"
                aria-pressed={showVehicleRoutes}
                className={`toggle-button ${showVehicleRoutes ? 'active' : ''}`}
                onClick={() => setShowVehicleRoutes((current) => !current)}
              >
                显示轨迹
              </button>
              <div className="stage-mode-control">
                <div className="stage-mode-meta">
                  <span className="task-load-label">视图模式</span>
                  <small>{stageMode === '2d' ? 'Phaser 2D' : 'Babylon 3D'}</small>
                </div>
                <div className="stage-mode-options">
                  <button
                    type="button"
                    aria-pressed={stageMode === '2d'}
                    className={`stage-mode-button ${stageMode === '2d' ? 'active' : ''}`}
                    onClick={() => setStageMode('2d')}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    aria-pressed={stageMode === '3d'}
                    className={`stage-mode-button ${stageMode === '3d' ? 'active' : ''}`}
                    onClick={() => setStageMode('3d')}
                  >
                    3D
                  </button>
                </div>
              </div>
              <div className="map-preset-control">
                <div className="map-preset-meta">
                  <span className="task-load-label">地图参数</span>
                  <small>
                    {snapshot.map.width} x {snapshot.map.height} 格
                  </small>
                </div>
                <div className="map-preset-options">
                  {MAP_PRESET_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={snapshot.mapPreset === option.value}
                      className={`map-preset-button ${
                        snapshot.mapPreset === option.value ? 'active' : ''
                      }`}
                      onClick={() => controller.setMapPreset(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="task-load-control">
                <div className="task-load-meta">
                  <span className="task-load-label">任务繁忙程度</span>
                  <small>目标 {snapshot.targetTasksPerMinute} 个任务/分钟</small>
                </div>
                <div className="task-load-options">
                  {TASK_LOAD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={snapshot.taskLoadLevel === option.value}
                      className={`task-load-button ${option.value} ${
                        snapshot.taskLoadLevel === option.value ? 'active' : ''
                      }`}
                      onClick={() => controller.setTaskLoadLevel(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="stage-frame">

          <div className="stage-content">
            <div className="stage-side-stack">
              <div className="stage-metrics-side">
                <div className="metric-card">
                  <span>已完成</span>
                  <strong>{snapshot.metrics.completedTasks}</strong>
                </div>
                <div className="metric-card">
                  <span>待分配</span>
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
                  <span>利用率</span>
                  <strong>{(snapshot.metrics.utilizationRate * 100).toFixed(1)}%</strong>
                </div>
                <div className="metric-card">
                  <span>拼单率</span>
                  <strong>{(snapshot.metrics.batchingRate * 100).toFixed(1)}%</strong>
                </div>
              </div>

              <div className="map-legend docked-left">
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
                <span className="legend-item">
                  <i className="legend-swatch vehicle" />
                  小车
                </span>
                <span className="legend-item">
                  <i className="legend-line route" />
                  轨迹
                </span>
              </div>
            </div>

            <FactoryViewport
              snapshot={snapshot}
              showVehicleRoutes={showVehicleRoutes}
              stageMode={stageMode}
            />
          </div>
        </div>
      </section>

      <section className="panel split-panel">
        <div className="panel-header">
          <div>
            <h2>任务与调度面板</h2>
          </div>
        </div>

        <div className="split-stack">
          <article className="split-card list-card">
            <div className="list-block tabbed-block">
              <div className="tab-row">
                <button
                  type="button"
                  className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tasks')}
                >
                  任务列表
                  <span>{recentTasks.length}</span>
                </button>
                <button
                  type="button"
                  className={`tab-button ${activeTab === 'instructions' ? 'active' : ''}`}
                  onClick={() => setActiveTab('instructions')}
                >
                  关键指令
                  <span>{instructions.length}</span>
                </button>
                <button
                  type="button"
                  className={`tab-button ${activeTab === 'vehicles' ? 'active' : ''}`}
                  onClick={() => setActiveTab('vehicles')}
                >
                  车辆状态
                  <span>
                    {snapshot.vehicles.filter((vehicle) => vehicle.state !== 'idle').length}/
                    {snapshot.vehicles.length}
                  </span>
                </button>
              </div>

              {activeTab === 'tasks' ? (
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
              ) : activeTab === 'instructions' ? (
                <div className="instruction-list">
                  {instructions.length === 0 ? (
                    <p className="empty-copy">当前没有需要下发的关键指令。</p>
                  ) : (
                    instructions.map((instruction) => (
                      <div key={instruction.id} className="instruction-row">
                        <span
                          className="instruction-color"
                          style={{ backgroundColor: instruction.color }}
                        />
                        <div className="instruction-meta">
                          <div className="instruction-head">
                            <strong>{instruction.title}</strong>
                            <span className={`instruction-chip ${instruction.level}`}>
                              {instruction.status}
                            </span>
                          </div>
                          <span>{instruction.detail}</span>
                          <small>{instruction.meta}</small>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
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
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

export default App;
