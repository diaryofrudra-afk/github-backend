import { useState } from 'react';

export function useSidebar() {
  const [collapsed, setCollapsedState] = useState<boolean>(
    () => localStorage.getItem('suprwise_sidebar') === 'collapsed'
  );

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    localStorage.setItem('suprwise_sidebar', v ? 'collapsed' : 'expanded');
  };

  const toggle = () => setCollapsed(!collapsed);

  return { collapsed, toggle, setCollapsed };
}
