import { useState, useEffect } from 'react';
export function useTheme() {
    const [theme, setThemeState] = useState('dark');
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('rudra_theme', theme);
    }, [theme]);
    const toggleTheme = () => setThemeState(t => t === 'dark' ? 'light' : 'dark');
    const setTheme = (t) => setThemeState(t);
    return { theme, toggleTheme, setTheme };
}
//# sourceMappingURL=useTheme.js.map