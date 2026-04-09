import { useRef, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions, Chart } from 'chart.js';

interface LineChartProps {
  data: ChartData<'line'>;
  options?: ChartOptions<'line'>;
  height?: number;
  gradient?: boolean;
}

export function LineChart({ data, options, height, gradient = false }: LineChartProps) {
  const chartRef = useRef<Chart<'line'>>(null);

  // Apply gradient fill after chart mounts / updates
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !gradient) return;
    const ctx = chart.ctx;
    const area = chart.chartArea;
    if (!ctx || !area) return;

    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue('--accent').trim() || '#9d6fff';

    chart.data.datasets.forEach(ds => {
      const grad = ctx.createLinearGradient(0, area.top, 0, area.bottom);
      grad.addColorStop(0, hexToRGBA(accent, 0.35));
      grad.addColorStop(0.5, hexToRGBA(accent, 0.08));
      grad.addColorStop(1, hexToRGBA(accent, 0));
      ds.backgroundColor = grad;
      ds.fill = true;
    });
    chart.update('none');
  });

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
  const tickColor = isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.35)';
  const tooltipBg = isLight ? 'rgba(255,255,255,0.96)' : 'rgba(20, 20, 40, 0.95)';
  const tooltipText = isLight ? '#333' : '#fff';

  const defaultOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    layout: {
      padding: 0,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipText,
        borderColor: 'rgba(157, 111, 255, 0.3)',
        borderWidth: 1,
        titleFont: { size: 11, weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { color: gridColor, drawTicks: false },
        ticks: {
          color: tickColor,
          font: { size: 9 },
          maxRotation: 45,
          padding: 4,
        },
        border: { display: false },
      },
      y: {
        grid: { color: gridColor, drawTicks: false },
        ticks: {
          color: tickColor,
          font: { size: 9 },
          padding: 8,
          callback: (value: string | number) => {
            if (typeof value === 'string') return value;
            if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
            if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
            if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
            return `₹${value}`;
          },
        },
        border: { display: false },
        beginAtZero: true,
      },
    },
    elements: {
      line: { borderJoinStyle: 'round' },
    },
    ...options,
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: height || 200 }}>
      <Line ref={chartRef} data={data} options={defaultOptions} />
    </div>
  );
}

function hexToRGBA(hex: string, alpha: number): string {
  // handle rgb/rgba strings
  if (hex.startsWith('rgb')) {
    const m = hex.match(/[\d.]+/g);
    if (m && m.length >= 3) return `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${alpha})`;
  }
  // handle hex
  let c = hex.replace('#', '');
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
