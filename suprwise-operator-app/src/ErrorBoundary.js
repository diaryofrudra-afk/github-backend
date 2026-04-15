import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
export class ErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error('App crashed:', error, info);
    }
    render() {
        if (this.state.error) {
            return (_jsxs("div", { style: {
                    padding: '40px',
                    fontFamily: 'monospace',
                    color: '#ff6b6b',
                    background: '#0d0d0d',
                    minHeight: '100vh',
                }, children: [_jsx("h2", { style: { marginBottom: '16px' }, children: "Something went wrong" }), _jsxs("pre", { style: { whiteSpace: 'pre-wrap', fontSize: '13px', color: '#ccc' }, children: [this.state.error.message, '\n\n', this.state.error.stack] }), _jsx("button", { onClick: () => this.setState({ error: null }), style: { marginTop: '24px', padding: '8px 16px', cursor: 'pointer' }, children: "Try Again" })] }));
        }
        return this.props.children;
    }
}
//# sourceMappingURL=ErrorBoundary.js.map