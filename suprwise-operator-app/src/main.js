import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './global.css';
import App from './App';
import { AppProvider } from './context/AppContext';
import { ErrorBoundary } from './ErrorBoundary';
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(ErrorBoundary, { children: _jsx(AppProvider, { children: _jsx(ErrorBoundary, { children: _jsx(App, {}) }) }) }) }));
//# sourceMappingURL=main.js.map