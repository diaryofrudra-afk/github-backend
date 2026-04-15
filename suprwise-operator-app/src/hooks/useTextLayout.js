import { useMemo, useState, useEffect } from 'react';
import { prepare, layout, prepareWithSegments, layoutWithLines } from '../lib/pretext/layout';
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
function useFontsReady() {
    const [ready, setReady] = useState(typeof document !== 'undefined' && typeof document.fonts !== 'undefined'
        ? document.fonts.status === 'loaded'
        : true);
    useEffect(() => {
        if (typeof document === 'undefined' || typeof document.fonts === 'undefined')
            return;
        if (document.fonts.status === 'loaded') {
            setReady(true);
            return;
        }
        document.fonts.ready.then(() => setReady(true));
    }, []);
    return ready;
}
export function useTextLayout(text, font, options) {
    const fontsReady = useFontsReady();
    // Memoize the prepared handle to avoid redundant measurements.
    // Skip preparation until fonts are loaded — the canvas would measure
    // against the wrong font otherwise, producing broken layout.
    const prepared = useMemo(() => {
        if (!fontsReady)
            return null;
        try {
            return prepare(text, font, options);
        }
        catch (e) {
            console.error('Pretext prepare error:', e);
            return null;
        }
    }, [text, font, options, fontsReady]);
    const preparedWithSegments = useMemo(() => {
        if (!fontsReady)
            return null;
        try {
            return prepareWithSegments(text, font, options);
        }
        catch (e) {
            console.error('Pretext prepareWithSegments error:', e);
            return null;
        }
    }, [text, font, options, fontsReady]);
    const calculateLayout = (maxWidth, lineHeight) => {
        if (!prepared)
            return null;
        return layout(prepared, maxWidth, lineHeight);
    };
    const calculateDetailedLayout = (maxWidth, lineHeight) => {
        if (!preparedWithSegments)
            return null;
        return layoutWithLines(preparedWithSegments, maxWidth, lineHeight);
    };
    return {
        prepared,
        preparedWithSegments,
        calculateLayout,
        calculateDetailedLayout,
    };
}
//# sourceMappingURL=useTextLayout.js.map