import * as echarts from 'echarts';

export const dashboardPalette = {
  sky: '#38bdf8',
  cyan: '#06b6d4',
  mint: '#34d399',
  lime: '#84cc16',
  gold: '#facc15',
  amber: '#f97316',
  rose: '#fb7185',
  violet: '#a78bfa',
  slate: '#94a3b8',
  line: 'rgba(148, 163, 184, 0.18)',
  text: '#e2e8f0',
  muted: '#94a3b8',
  panel: 'rgba(7, 16, 29, 0.94)',
};

export function createAreaGradient(topColor: string, bottomColor: string) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: topColor },
    { offset: 1, color: bottomColor },
  ]);
}

export function createGlowGradient(leftColor: string, rightColor: string) {
  return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: leftColor },
    { offset: 1, color: rightColor },
  ]);
}

export const chartTextStyle = {
  color: dashboardPalette.text,
  fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
};

export const chartGridStyle = {
  left: 18,
  right: 18,
  top: 42,
  bottom: 28,
  containLabel: true,
};

export const axisLabelStyle = {
  color: dashboardPalette.muted,
  fontSize: 11,
};
