export interface TextLayoutResult {
    height: number;
    lineCount: number;
}
export interface DetailedTextLayoutResult extends TextLayoutResult {
    lines: any[];
}
export declare function useTextLayout(text: string, font: string, options?: {
    whiteSpace?: 'normal' | 'pre-wrap';
}): {
    prepared: any;
    preparedWithSegments: any;
    calculateLayout: (maxWidth: number, lineHeight: number) => TextLayoutResult | null;
    calculateDetailedLayout: (maxWidth: number, lineHeight: number) => DetailedTextLayoutResult | null;
};
//# sourceMappingURL=useTextLayout.d.ts.map