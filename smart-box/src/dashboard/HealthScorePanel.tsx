import type { CSSProperties } from 'react';
import type { DashboardHealthSummary } from '../analytics/dashboard';

interface HealthScorePanelProps {
  health: DashboardHealthSummary;
}

export function HealthScorePanel({ health }: HealthScorePanelProps) {
  return (
    <article className="dashboard-panel health-score-panel">
      <div className="dashboard-panel-head">
        <div>
          <span className="dashboard-eyebrow">整体状态</span>
          <h3>运行健康分</h3>
        </div>
        <small>{health.label}</small>
      </div>

      <div className="health-score-panel-body">
        <div
          className="health-score-ring"
          style={{ '--health-accent': health.color } as CSSProperties}
        >
          <strong>{health.score}</strong>
        </div>

        <div className="health-score-panel-copy">
          <strong>{health.label}</strong>
          <p>{health.detail}</p>
          <small>用于快速判断当前整体运行状态，分数越高表示系统越稳定。</small>
        </div>
      </div>
    </article>
  );
}
