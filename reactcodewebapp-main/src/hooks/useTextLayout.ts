import { useMemo } from 'react';
import { prepare, layout, prepareWithSegments, layoutWithLines } from '../lib/pretext/layout';

export interface TextLayoutResult {
  height: number;
  lineCount: number;
}

export interface DetailedTextLayoutResult extends TextLayoutResult {
  lines: any[];
}

export function useTextLayout(text: string, font: string, options?: { whiteSpace?: 'normal' | 'pre-wrap' }) {
  // Memoize the prepared handle to avoid redundant measurements
  const prepared = useMemo(() => {
    try {
      return prepare(text, font, options);
    } catch (e) {
      console.error('Pretext prepare error:', e);
      return null;
    }
  }, [text, font, options]);

  const preparedWithSegments = useMemo(() => {
    try {
      return prepareWithSegments(text, font, options);
    } catch (e) {
      console.error('Pretext prepareWithSegments error:', e);
      return null;
    }
  }, [text, font, options]);

  const calculateLayout = (maxWidth: number, lineHeight: number): TextLayoutResult | null => {
    if (!prepared) return null;
    return layout(prepared, maxWidth, lineHeight);
  };

  const calculateDetailedLayout = (maxWidth: number, lineHeight: number): DetailedTextLayoutResult | null => {
    if (!preparedWithSegments) return null;
    return layoutWithLines(preparedWithSegments, maxWidth, lineHeight);
  };

  return {
    prepared,
    preparedWithSegments,
    calculateLayout,
    calculateDetailedLayout,
  };
}
