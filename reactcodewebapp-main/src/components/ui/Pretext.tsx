import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useTextLayout } from '../../hooks/useTextLayout';
import { walkLineRanges, layoutWithLines } from '../../lib/pretext/layout';

interface PretextProps {
  text: string;
  font?: string;
  lineHeight?: number;
  maxWidth?: number;
  balanced?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Parse font shorthand into individual properties for better React inline style support
function parseFont(font: string): React.CSSProperties {
  const match = font.match(/^(?:(normal|italic|oblique)\s+)?(?:(normal|bold|[1-9]\d{2,})\s+)?(\d+(?:\.\d+)?(?:px|em|rem|pt))\s+(.+)$/i);
  if (!match) return { fontFamily: font };

  const [, fontStyle, fontWeight, fontSize, fontFamily] = match;
  return {
    ...(fontStyle && { fontStyle }),
    ...(fontWeight && { fontWeight: isNaN(Number(fontWeight)) ? fontWeight : Number(fontWeight) }),
    fontSize,
    fontFamily: fontFamily.replace(/['"]/g, ''),
  };
}

export const Pretext: React.FC<PretextProps> = ({
  text,
  font = '16px Inter',
  lineHeight = 24,
  maxWidth,
  balanced = false,
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(maxWidth || 0);
  const { preparedWithSegments } = useTextLayout(text, font);

  // Stable callback for ResizeObserver
  const handleResize = useCallback((width: number) => {
    setContainerWidth(width);
  }, []);

  // Resize observer to handle dynamic container widths
  useEffect(() => {
    if (maxWidth) {
      setContainerWidth(maxWidth);
      return;
    }

    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        handleResize(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [maxWidth, handleResize]);

  const { lines, balancedWidth } = useMemo(() => {
    if (!preparedWithSegments || containerWidth <= 0) {
      return { lines: [], balancedWidth: containerWidth };
    }

    let targetWidth = containerWidth;

    // Balanced Text: Find the tightest width that keeps the same line count
    if (balanced) {
      // walkLineRanges to get the widest line at current wrap
      let maxLineW = 0;
      walkLineRanges(preparedWithSegments, containerWidth, (line) => {
        if (line.width > maxLineW) maxLineW = line.width;
      });
      targetWidth = Math.ceil(maxLineW);
    }

    // Get the final lines for rendering
    const { lines: layoutLines } = layoutWithLines(preparedWithSegments, targetWidth, lineHeight);

    return { lines: layoutLines, balancedWidth: targetWidth };
  }, [preparedWithSegments, containerWidth, lineHeight, balanced]);

  // Fallback to standard rendering if pretext fails or not ready
  if (!preparedWithSegments || containerWidth <= 0) {
    return (
      <div ref={containerRef} className={className} style={{ ...style, ...parseFont(font), lineHeight: `${lineHeight}px` }}>
        {text}
      </div>
    );
  }

  // Don't render empty content
  if (lines.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        ...parseFont(font),
        lineHeight: `${lineHeight}px`,
        width: balanced ? `${balancedWidth}px` : '100%',
        display: balanced ? 'inline-block' : 'block',
      }}
    >
      {lines.map((line: any, i: number) => (
        <div key={i} style={{ whiteSpace: 'pre', overflow: 'hidden' }}>
          {line.text}
        </div>
      ))}
    </div>
  );
};
