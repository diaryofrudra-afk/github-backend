import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect } from 'react';
const CANVAS_SIZE = 280;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
export function ImageCropper({ src, onCrop, onCancel }) {
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
    const [loaded, setLoaded] = useState(false);
    // Load image
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            // Fit image to canvas initially
            const fitScale = CANVAS_SIZE / Math.min(img.width, img.height);
            setScale(fitScale);
            setOffset({
                x: (CANVAS_SIZE - img.width * fitScale) / 2,
                y: (CANVAS_SIZE - img.height * fitScale) / 2,
            });
            setLoaded(true);
        };
        img.src = src;
    }, [src]);
    // Draw
    const draw = useCallback(() => {
        const ctx = canvasRef.current?.getContext('2d');
        const img = imgRef.current;
        if (!ctx || !img)
            return;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        // Draw image
        ctx.save();
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
        ctx.restore();
        // Draw circular border
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 1, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }, [scale, offset]);
    useEffect(() => {
        if (loaded)
            draw();
    }, [loaded, draw]);
    // Drag handlers
    const onPointerDown = (e) => {
        setDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
        e.target.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
        if (!dragging)
            return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
    };
    const onPointerUp = () => setDragging(false);
    // Zoom
    const handleZoom = (delta) => {
        setScale(prev => {
            const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta));
            // Adjust offset to zoom toward center
            const img = imgRef.current;
            if (img) {
                const cx = CANVAS_SIZE / 2;
                const cy = CANVAS_SIZE / 2;
                const ratio = next / prev;
                setOffset(o => ({
                    x: cx - (cx - o.x) * ratio,
                    y: cy - (cy - o.y) * ratio,
                }));
            }
            return next;
        });
    };
    const handleWheel = (e) => {
        e.preventDefault();
        handleZoom(e.deltaY < 0 ? 0.05 : -0.05);
    };
    // Export cropped
    const handleConfirm = () => {
        const out = document.createElement('canvas');
        out.width = 256;
        out.height = 256;
        const ctx = out.getContext('2d');
        const img = imgRef.current;
        if (!ctx || !img)
            return;
        // Draw circle-cropped image at 256x256
        const s = 256 / CANVAS_SIZE;
        ctx.beginPath();
        ctx.arc(128, 128, 128, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, offset.x * s, offset.y * s, img.width * scale * s, img.height * scale * s);
        onCrop(out.toDataURL('image/jpeg', 0.85));
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }, children: [_jsx("div", { style: { fontSize: 12, color: 'var(--t3)' }, children: "Drag to reposition. Scroll or use slider to zoom." }), _jsx("div", { style: {
                    width: CANVAS_SIZE,
                    height: CANVAS_SIZE,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: 'var(--bg3)',
                    cursor: dragging ? 'grabbing' : 'grab',
                    position: 'relative',
                    boxShadow: '0 0 0 4px var(--border)',
                }, onWheel: handleWheel, children: _jsx("canvas", { ref: canvasRef, width: CANVAS_SIZE, height: CANVAS_SIZE, style: { display: 'block' }, onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp }) }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', maxWidth: CANVAS_SIZE }, children: [_jsx("button", { type: "button", onClick: () => handleZoom(-0.1), style: { background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 18, padding: '2px 6px' }, children: "-" }), _jsx("input", { type: "range", min: MIN_SCALE * 100, max: MAX_SCALE * 100, value: scale * 100, onChange: e => {
                            const next = Number(e.target.value) / 100;
                            const img = imgRef.current;
                            if (img) {
                                const cx = CANVAS_SIZE / 2;
                                const cy = CANVAS_SIZE / 2;
                                const ratio = next / scale;
                                setOffset(o => ({
                                    x: cx - (cx - o.x) * ratio,
                                    y: cy - (cy - o.y) * ratio,
                                }));
                            }
                            setScale(next);
                        }, style: { flex: 1, accentColor: 'var(--accent)' } }), _jsx("button", { type: "button", onClick: () => handleZoom(0.1), style: { background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 18, padding: '2px 6px' }, children: "+" })] }), _jsxs("div", { style: { display: 'flex', gap: '8px' }, children: [_jsx("button", { className: "btn-sm accent", type: "button", onClick: handleConfirm, children: "Set as Profile Photo" }), _jsx("button", { className: "btn-sm outline", type: "button", onClick: onCancel, children: "Cancel" })] })] }));
}
//# sourceMappingURL=ImageCropper.js.map