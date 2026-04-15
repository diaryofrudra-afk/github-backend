import type { ChartData, ChartOptions } from 'chart.js';
interface LineChartProps {
    data: ChartData<'line'>;
    options?: ChartOptions<'line'>;
    height?: number;
    gradient?: boolean;
}
export declare function LineChart({ data, options, height, gradient }: LineChartProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=LineChart.d.ts.map