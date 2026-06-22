import type { ReactNode } from 'react';
interface Column {
    key: string;
    label: string;
    width?: string;
    usePretext?: boolean;
}
interface TableProps {
    columns: Column[];
    children: ReactNode;
    className?: string;
}
export declare function Table({ columns, children, className }: TableProps): import("react/jsx-runtime").JSX.Element;
interface TableRowProps {
    cells: ReactNode[];
    onClick?: () => void;
    className?: string;
    pretextCells?: number[];
    font?: string;
}
export declare function TableRow({ cells, onClick, className, pretextCells, font }: TableRowProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=Table.d.ts.map