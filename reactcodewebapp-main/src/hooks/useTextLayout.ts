import { useMemo, useState, useEffect } from 'react';
import { prepare, layout, prepareWithSegments, layoutWithLines } from '../lib/pretext/layout';

export interface TextLayoutResult {
  height: number;
  lineCount: number;
}

export interface DetailedTextLayoutResult extends TextLayoutResult {
  lines: any[];
}

/**
 * Wait for the browser to finish loading all fonts before measuring text.
 *
 * The pretext layout engine uses Canvas.measureText() which silently falls
 * back to a system font when the requested web font hasn't loaded yet. If
 * measurements are taken against the wrong font, the layout engine produces
 * incorrect line-breaks and the rendered text appears fragmented or distorted.
 *
 * This hook returns `false` until `document.fonts.ready` resolves. In SSR or
 * non-browser environments it returns `true` immediately.
 */
function useFontsReady(): boolean {
  const [ready, setReady] = useState(
    typeof document !== 'undefined' && typeof document.fonts !== 'undefined'
      ? document.fonts.status === 'loaded' || document.fonts.status === 'unloaded'
      : true,
  );

  useEffect(() => {
    if (typeof document === 'undefined' || typeof document.fonts === 'undefined') return;

    if (document.fonts.status === 'loaded' || document.fonts.status === 'unloaded') {
      setReady(true);
      return;
    }

    document.fonts.ready.then(() => setReady(true));
  }, []);

  return ready;
}

export function useTextLayout(text: string, font: string, options?: { whiteSpace?: 'normal' | 'pre-wrap' }) {
  const fontsReady = useFontsReady();

  // Memoize the prepared handle to avoid redundant measurements.
  // Skip preparation until fonts are loaded — the canvas would measure
  // against the wrong font otherwise, producing broken layout.
  const prepared = useMemo(() => {
    if (!fontsReady) return null;
    try {
      return prepare(text, font, options);
    } catch (e) {
      console.error('Pretext prepare error:', e);
      return null;
    }
  }, [text, font, options, fontsReady]);

  const preparedWithSegments = useMemo(() => {
    if (!fontsReady) return null;
    try {
      return prepareWithSegments(text, font, options);
    } catch (e) {
      console.error('Pretext prepareWithSegments error:', e);
      return null;
    }
  }, [text, font, options, fontsReady]);

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
