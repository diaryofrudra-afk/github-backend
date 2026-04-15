import { Bar } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';

interface BarChartProps {
  data: ChartData<'bar'>;
  options?: ChartOptions<'bar'>;
  height?: number;
}

export function BarChart({ data, options, height }: BarChartProps) {
  const defaultOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    ...options,
  };
  return <Bar data={data} options={defaultOptions} height={height} />;
}
