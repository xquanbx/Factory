import type { DashboardBottleneckSummary, DashboardStageMetric } from '../analytics/dashboard';

interface BottleneckCardProps {
  summary: DashboardBottleneckSummary;
  stageMetrics: DashboardStageMetric[];
}

function toneLabel(severity: DashboardBottleneckSummary['severity']) {
  switch (severity) {
    case 'alert':
      return '需要干预';
    case 'busy':
      return '负荷偏高';
    default:
      return '运行平稳';
  }
}

export function BottleneckCard({ summary, stageMetrics }: BottleneckCardProps) {
  return (
    <article className={`dashboard-panel bottleneck-panel ${summary.severity}`}>
      <div className="dashboard-panel-head">
        <div>
          <span className="dashboard-eyebrow">运行诊断</span>
          <h3>{summary.title}</h3>
        </div>
        <span className={`signal-chip ${summary.severity}`}>{toneLabel(summary.severity)}</span>
      </div>

      <div className="bottleneck-summary">
        <div className="bottleneck-topline">
          <strong>{summary.stageLabel}</strong>
          <small>{summary.capacityLabel}</small>
        </div>
        <p>{summary.detail}</p>
        <div className="capacity-meter">
          <div
            className="capacity-meter-fill"
            style={{ width: `${Math.round(summary.capacityTension * 100)}%` }}
          />
        </div>
        <span className="capacity-caption">
          产能紧张度 {Math.round(summary.capacityTension * 100)}% · 任务积压趋势 {summary.backlogTrend === 'rising' ? '上升' : summary.backlogTrend === 'falling' ? '回落' : '平稳'}
        </span>
      </div>

      <div className="stage-health-list">
        {stageMetrics.map((metric) => (
          <div key={metric.id} className={`stage-health-item ${metric.tone}`}>
            <div>
              <strong>{metric.label}</strong>
              <small>{metric.description}</small>
            </div>
            <span>{(metric.averageMs / 1000).toFixed(1)}s</span>
          </div>
        ))}
      </div>

      <p className="bottleneck-recommendation">{summary.recommendation}</p>
    </article>
  );
}
