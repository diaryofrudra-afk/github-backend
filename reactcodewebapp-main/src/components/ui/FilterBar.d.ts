interface FilterPill {
    value: string;
    label: string;
}
interface FilterBarProps {
    pills: FilterPill[];
    active: string;
    onChange: (v: string) => void;
    id?: string;
    className?: string;
}
export declare function FilterBar({ pills, active, onChange, id, className }: FilterBarProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=FilterBar.d.ts.map