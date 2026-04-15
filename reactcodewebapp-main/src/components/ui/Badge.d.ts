type BadgeVariant = 'green' | 'red' | 'yellow' | 'amber' | 'blue' | 'default';
interface BadgeProps {
    label: string;
    variant?: BadgeVariant;
    className?: string;
}
export declare function Badge({ label, variant, className }: BadgeProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=Badge.d.ts.map