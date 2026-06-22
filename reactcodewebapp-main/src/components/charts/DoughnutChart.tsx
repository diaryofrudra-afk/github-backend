import { Doughnut } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';

interface DoughnutChartProps {
  data: ChartData<'doughnut'>;
  options?: ChartOptions<'doughnut'>;
}

export function DoughnutChart({ data, options }: DoughnutChartProps) {
  const defaultOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { position: 'bottom' } },
    ...options,
  };
  return <Doughnut data={data} options={defaultOptions} />;
}
