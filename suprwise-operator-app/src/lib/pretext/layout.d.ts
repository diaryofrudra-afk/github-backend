export interface PreparedText {
    words: string[];
    font: string;
    whiteSpace: 'normal' | 'pre-wrap';
}
export interface PreparedTextWithSegments extends PreparedText {
    segments: string[];
}
export interface LayoutResult {
    height: number;
    lineCount: number;
}
export interface LayoutWithLinesResult extends LayoutResult {
    lines: string[];
}
export declare function prepare(text: string, font: string, options?: {
    whiteSpace?: 'normal' | 'pre-wrap';
}): PreparedText;
export declare function prepareWithSegments(text: string, font: string, options?: {
    whiteSpace?: 'normal' | 'pre-wrap';
}): PreparedTextWithSegments;
export declare function layout(prepared: PreparedText, maxWidth: number, lineHeight: number): LayoutResult;
export declare function layoutWithLines(prepared: PreparedTextWithSegments, maxWidth: number, lineHeight: number): LayoutWithLinesResult;
//# sourceMappingURL=layout.d.ts.map