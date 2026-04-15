import { createCanvas } from 'canvas';
import * as pretext from '../lib/pretext/layout.js';

// Polyfill for Node.js environment if Pretext needs global access
// Pretext's getMeasureContext() checks for OffscreenCanvas and document.
if (typeof globalThis !== 'undefined' && !(globalThis as any).OffscreenCanvas) {
    (globalThis as any).OffscreenCanvas = class {
        constructor(width: number, height: number) {
            return createCanvas(width, height) as any;
        }
    };
}

export interface TextLayoutOptions {
    font: string;
    lineHeight: number;
    maxWidth: number;
    whiteSpace?: 'normal' | 'pre-wrap';
}

export class TextLayoutService {
    /**
     * Measures the height and line count of a text string at a given width.
     * Useful for server-side report generation or metadata calculation.
     */
    static measure(text: string, options: TextLayoutOptions) {
        const { font, maxWidth, lineHeight, whiteSpace = 'normal' } = options;

        try {
            const prepared = pretext.prepare(text, font, { whiteSpace });
            return pretext.layout(prepared, maxWidth, lineHeight);
        } catch (e) {
            console.error('Backend Pretext measurement failed:', e);
            // Basic fallback based on average character width if pretext fails
            const avgCharWidth = 8;
            const charsPerLine = Math.floor(maxWidth / avgCharWidth);
            const lineCount = Math.ceil(text.length / charsPerLine);
            return {
                height: lineCount * lineHeight,
                lineCount: lineCount
            };
        }
    }

    /**
     * Gets detailed line-by-line information.
     */
    static getLines(text: string, options: TextLayoutOptions) {
        const { font, maxWidth, lineHeight, whiteSpace = 'normal' } = options;

        try {
            const prepared = pretext.prepareWithSegments(text, font, { whiteSpace });
            return pretext.layoutWithLines(prepared, maxWidth, lineHeight);
        } catch (e) {
            console.error('Backend Pretext detailed layout failed:', e);
            return { height: 0, lineCount: 0, lines: [] };
        }
    }
}
