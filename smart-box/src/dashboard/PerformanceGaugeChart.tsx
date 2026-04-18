import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { DashboardPerformanceGauge } from '../analytics/dashboard';
import { chartTextStyle, dashboardPalette } from './theme';

interface PerformanceGaugeChartProps {
  data: DashboardPerformanceGauge[];
}

export function PerformanceGaugeChart({ data }: PerformanceGaugeChartProps) {
  const option: EChartsOption = {
    animationDuration: 500,
    radar: {
      radius: '66%',
      splitNumber: 4,
      indicator: data.map((item) => ({
        name: item.label,
        max: 100,
      })),
      axisName: {
        color: dashboardPalette.text,
        fontSize: 12,
      },
      splitLine: {
        lineStyle: {
          color: [
            'rgba(148, 163, 184, 0.12)',
            'rgba(148, 163, 184, 0.1)',
            'rgba(148, 163, 184, 0.08)',
            'rgba(148, 163, 184, 0.06)',
          ],
        },
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(56, 189, 248, 0.05)', 'rgba(56, 189, 248, 0.02)'],
        },
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(148, 163, 184, 0.12)',
        },
      },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(7, 16, 29, 0.96)',
      borderColor: dashboardPalette.line,
      textStyle: {
        ...chartTextStyle,
        fontSize: 12,
      },
      formatter: () =>
        data
          .map((item) => `${item.label}: ${(item.value * 100).toFixed(1)}%`)
          .join('<br/>'),
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: {
          color: dashboardPalette.sky,
        },
        lineStyle: {
          color: dashboardPalette.sky,
          width: 2,
        },
        areaStyle: {
          color: 'rgba(56, 189, 248, 0.24)',
        },
        data: [
          {
            value: data.map((item) => Number((item.value * 100).toFixed(1))),
            name: '当前画像',
          },
        ],
      },
    ],
  };

  return (
    <article className="dashboard-panel chart-panel">
      <div className="dashboard-panel-head">
        <div>
          <span className="dashboard-eyebrow">产能画像</span>
          <h3>利用、拼单与活跃程度</h3>
        </div>
        <small>当前系统负荷雷达</small>
      </div>
      <ReactECharts option={option} className="chart-canvas gauge-chart" />
    </article>
  );
}
