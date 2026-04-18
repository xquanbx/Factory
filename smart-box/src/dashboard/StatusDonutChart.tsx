import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { DashboardCountItem } from '../analytics/dashboard';
import { chartTextStyle, dashboardPalette } from './theme';

interface StatusDonutChartProps {
  title: string;
  subtitle: string;
  data: DashboardCountItem[];
  centerValue: string;
  centerLabel: string;
}

export function StatusDonutChart({
  title,
  subtitle,
  data,
  centerValue,
  centerLabel,
}: StatusDonutChartProps) {
  const option: EChartsOption = {
    animation: false,
    color: data.map((item) => item.color),
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(7, 16, 29, 0.96)',
      borderColor: dashboardPalette.line,
      textStyle: {
        ...chartTextStyle,
        fontSize: 12,
      },
      valueFormatter: (value) => `${value ?? 0} 项`,
    },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        color: dashboardPalette.muted,
        fontSize: 11,
      },
    },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '40%',
        style: {
          text: centerValue,
          fill: dashboardPalette.text,
          fontSize: 26,
          fontWeight: 700,
          align: 'center',
          verticalAlign: 'middle',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '54%',
        style: {
          text: centerLabel,
          fill: dashboardPalette.muted,
          fontSize: 11,
          align: 'center',
          verticalAlign: 'middle',
        },
      },
    ],
    series: [
      {
        name: title,
        type: 'pie',
        radius: ['58%', '78%'],
        center: ['50%', '44%'],
        startAngle: 90,
        label: {
          show: false,
        },
        itemStyle: {
          borderRadius: 8,
          borderColor: 'rgba(7, 16, 29, 0.85)',
          borderWidth: 3,
        },
        emphasis: {
          scale: true,
          scaleSize: 8,
        },
        data: data.map((item) => ({
          name: item.label,
          value: item.value,
        })),
      },
    ],
  };

  return (
    <article className="dashboard-panel chart-panel">
      <div className="dashboard-panel-head">
        <div>
          <span className="dashboard-eyebrow">状态分布</span>
          <h3>{title}</h3>
        </div>
        <small>{subtitle}</small>
      </div>
      <ReactECharts option={option} className="chart-canvas donut-chart" />
    </article>
  );
}
