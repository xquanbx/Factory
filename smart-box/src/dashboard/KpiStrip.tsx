import type { CSSProperties } from 'react';
import type { DashboardKpi } from '../analytics/dashboard';

interface KpiStripProps {
  items: DashboardKpi[];
}

export function KpiStrip({ items }: KpiStripProps) {
  return (
    <div className="kpi-strip">
      {items.map((item) => (
        <article
          key={item.id}
          className="kpi-card"
          style={{ '--kpi-accent': item.accent } as CSSProperties}
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </article>
      ))}
    </div>
  );
}
