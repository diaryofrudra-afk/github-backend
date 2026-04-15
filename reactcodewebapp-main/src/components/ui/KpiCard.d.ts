import type { ReactNode } from 'react';
interface KpiCardProps {
    title: string;
    value: string | number;
    delta?: string;
    icon?: ReactNode;
    className?: string;
}
export declare function KpiCard({ title, value, delta, icon, className }: KpiCardProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=KpiCard.d.ts.map