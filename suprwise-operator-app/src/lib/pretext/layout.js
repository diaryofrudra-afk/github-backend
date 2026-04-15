// Canvas-based text layout engine used by the Pretext component and useTextLayout hook.
let _canvas = null;
let _ctx = null;
function getCtx() {
    if (typeof document === 'undefined')
        return null;
    if (!_canvas) {
        _canvas = document.createElement('canvas');
        _ctx = _canvas.getContext('2d');
    }
    return _ctx;
}
function measureWord(ctx, word) {
    return ctx.measureText(word).width;
}
function buildLines(words, ctx, maxWidth) {
    const lines = [];
    let current = '';
    let currentWidth = 0;
    const spaceWidth = measureWord(ctx, ' ');
    for (const word of words) {
        const wordWidth = measureWord(ctx, word);
        if (current === '') {
            current = word;
            currentWidth = wordWidth;
        }
        else if (currentWidth + spaceWidth + wordWidth <= maxWidth) {
            current += ' ' + word;
            currentWidth += spaceWidth + wordWidth;
        }
        else {
            lines.push(current);
            current = word;
            currentWidth = wordWidth;
        }
    }
    if (current)
        lines.push(current);
    return lines;
}
export function prepare(text, font, options) {
    const whiteSpace = options?.whiteSpace ?? 'normal';
    const words = whiteSpace === 'pre-wrap'
        ? text.split(/(\n)/).flatMap(s => s === '\n' ? ['\n'] : s.split(/\s+/).filter(Boolean))
        : text.split(/\s+/).filter(Boolean);
    return { words, font, whiteSpace };
}
export function prepareWithSegments(text, font, options) {
    const base = prepare(text, font, options);
    return { ...base, segments: base.words };
}
export function layout(prepared, maxWidth, lineHeight) {
    const ctx = getCtx();
    if (!ctx || maxWidth <= 0)
        return { height: lineHeight, lineCount: 1 };
    ctx.font = prepared.font;
    const lines = buildLines(prepared.words, ctx, maxWidth);
    const lineCount = Math.max(1, lines.length);
    return { height: lineCount * lineHeight, lineCount };
}
export function layoutWithLines(prepared, maxWidth, lineHeight) {
    const ctx = getCtx();
    if (!ctx || maxWidth <= 0)
        return { height: lineHeight, lineCount: 1, lines: [prepared.words.join(' ')] };
    ctx.font = prepared.font;
    const lines = buildLines(prepared.words, ctx, maxWidth);
    const lineCount = Math.max(1, lines.length);
    return { height: lineCount * lineHeight, lineCount, lines };
}
//# sourceMappingURL=layout.js.map