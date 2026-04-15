import * as pretext from '../lib/pretext/layout.js';
export interface TextLayoutOptions {
    font: string;
    lineHeight: number;
    maxWidth: number;
    whiteSpace?: 'normal' | 'pre-wrap';
}
export declare class TextLayoutService {
    /**
     * Measures the height and line count of a text string at a given width.
     * Useful for server-side report generation or metadata calculation.
     */
    static measure(text: string, options: TextLayoutOptions): pretext.LayoutResult;
    /**
     * Gets detailed line-by-line information.
     */
    static getLines(text: string, options: TextLayoutOptions): pretext.LayoutLinesResult;
}
//# sourceMappingURL=textLayout.d.ts.map