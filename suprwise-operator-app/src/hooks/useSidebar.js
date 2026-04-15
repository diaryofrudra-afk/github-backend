import { useState } from 'react';
export function useSidebar() {
    const [collapsed, setCollapsedState] = useState(() => localStorage.getItem('suprwise_sidebar') === 'collapsed');
    const setCollapsed = (v) => {
        setCollapsedState(v);
        localStorage.setItem('suprwise_sidebar', v ? 'collapsed' : 'expanded');
    };
    const toggle = () => setCollapsed(!collapsed);
    return { collapsed, toggle, setCollapsed };
}
//# sourceMappingURL=useSidebar.js.map