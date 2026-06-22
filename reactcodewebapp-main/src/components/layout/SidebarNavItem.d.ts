import type { ReactNode } from 'react';
import type { PageId } from '../../types';
interface SidebarNavItemProps {
    page: PageId;
    label: string;
    icon: ReactNode;
    count?: number;
    countId?: string;
    countVariant?: 'default' | 'alert';
}
export declare function SidebarNavItem({ page, label, icon, count, countId, countVariant }: SidebarNavItemProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=SidebarNavItem.d.ts.map