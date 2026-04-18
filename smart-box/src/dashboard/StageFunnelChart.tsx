import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { DashboardFunnelStage } from '../analytics/dashboard';
import { chartTextStyle, dashboardPalette } from './theme';

interface StageFunnelChartProps {
  data: DashboardFunnelStage[];
}

export function StageFunnelChart({ data }: StageFunnelChartProps) {
  const option: EChartsOption = {
    animationDuration: 500,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(7, 16, 29, 0.96)',
      borderColor: dashboardPalette.line,
      textStyle: {
        ...chartTextStyle,
        fontSize: 12,
      },
      formatter: (params: any) => {
        const point = params.data as DashboardFunnelStage;
        return `${params.name}<br/>累计 ${params.value ?? 0} 项<br/>${point.detail}`;
      },
    },
    series: [
      {
        name: '任务转化漏斗',
        type: 'funnel',
        left: '8%',
        top: 20,
        bottom: 8,
        width: '84%',
        minSize: '24%',
        maxSize: '92%',
        sort: 'descending',
        gap: 4,
        label: {
          show: true,
          position: 'inside',
          formatter: (params: any) => {
            const point = params.data as DashboardFunnelStage;
            return `${point.stageLabel}\n${point.value} 项`;
          },
          color: '#f8fafc',
          fontSize: 12,
          fontWeight: 700,
        },
        itemStyle: {
          borderColor: 'rgba(7, 16, 29, 0.9)',
          borderWidth: 2,
          opacity: 0.95,
        },
        emphasis: {
          label: {
            fontSize: 13,
          },
        },
        data: data.map((item) => ({
          ...item,
          name: item.stageLabel,
          value: item.value,
          itemStyle: {
            color: item.color,
          },
        })),
      },
    ],
  };

  return (
    <article className="dashboard-panel chart-panel">
      <div className="dashboard-panel-head">
        <div>
          <span className="dashboard-eyebrow">环节效率</span>
          <h3>任务流程转化漏斗</h3>
        </div>
        <small>从生成到完成的全链路转化</small>
      </div>
      <ReactECharts option={option} className="chart-canvas funnel-chart" />
    </article>
  );
}
