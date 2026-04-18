import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { DashboardTrendPoint } from '../analytics/dashboard';
import {
  axisLabelStyle,
  chartGridStyle,
  chartTextStyle,
  createAreaGradient,
  dashboardPalette,
} from './theme';

interface TrendChartProps {
  data: DashboardTrendPoint[];
}

function formatTimeline(ms: number) {
  return `${(ms / 1000).toFixed(0)}s`;
}

export function TrendChart({ data }: TrendChartProps) {
  const option: EChartsOption = {
    animationDuration: 450,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(7, 16, 29, 0.96)',
      borderColor: dashboardPalette.line,
      textStyle: {
        ...chartTextStyle,
        fontSize: 12,
      },
      valueFormatter: (value) =>
        typeof value === 'number' ? `${value.toFixed(1).replace('.0', '')}` : `${value ?? 0}`,
    },
    legend: {
      top: 4,
      right: 8,
      textStyle: {
        color: dashboardPalette.muted,
        fontSize: 11,
      },
    },
    grid: chartGridStyle,
    xAxis: {
      type: 'category',
      boundaryGap: false,
      axisLabel: axisLabelStyle,
      axisLine: {
        lineStyle: {
          color: dashboardPalette.line,
        },
      },
      data: data.map((point) => formatTimeline(point.time)),
    },
    yAxis: [
      {
        type: 'value',
        name: '任务',
        minInterval: 1,
        axisLabel: axisLabelStyle,
        splitLine: {
          lineStyle: {
            color: dashboardPalette.line,
          },
        },
      },
      {
        type: 'value',
        name: '利用率',
        min: 0,
        max: 1,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (value: number) => `${Math.round(value * 100)}%`,
        },
        splitLine: {
          show: false,
        },
      },
    ],
    series: [
      {
        name: '实时吞吐',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 3,
          color: dashboardPalette.sky,
        },
        areaStyle: {
          color: createAreaGradient('rgba(56, 189, 248, 0.35)', 'rgba(56, 189, 248, 0.02)'),
        },
        data: data.map((point) => point.throughputPerMinute),
      },
      {
        name: '在制任务',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 2,
          color: dashboardPalette.gold,
        },
        areaStyle: {
          color: createAreaGradient('rgba(250, 204, 21, 0.18)', 'rgba(250, 204, 21, 0.01)'),
        },
        data: data.map((point) => point.wipTasks),
      },
      {
        name: '车辆利用率',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        symbol: 'none',
        lineStyle: {
          width: 2,
          color: dashboardPalette.mint,
        },
        data: data.map((point) => point.utilizationRate),
      },
    ],
  };

  return (
    <article className="dashboard-panel trend-panel">
      <div className="dashboard-panel-head">
        <div>
          <span className="dashboard-eyebrow">趋势分析</span>
          <h3>吞吐、积压与利用率联动趋势</h3>
        </div>
        <small>最近 90 秒运行轨迹</small>
      </div>
      <ReactECharts option={option} className="chart-canvas trend-chart" />
    </article>
  );
}
