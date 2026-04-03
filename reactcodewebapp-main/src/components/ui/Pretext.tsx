import React, { useMemo, useRef, useState, useEffect } from 'react';
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

  // Resize observer to handle dynamic container widths
  useEffect(() => {
    if (maxWidth) {
      setContainerWidth(maxWidth);
      return;
    }

    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [maxWidth]);

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
  if (!preparedWithSegments) {
    return <div ref={containerRef} className={className} style={{ ...style, font, lineHeight: `${lineHeight}px` }}>{text}</div>;
  }

  return (
    <div 
      ref={containerRef} 
      className={className} 
      style={{ 
        ...style, 
        font, 
        lineHeight: `${lineHeight}px`,
        width: balanced ? `${balancedWidth}px` : '100%',
        display: balanced ? 'inline-block' : 'block',
      }}
    >
      {lines && lines.map((line: any, i: number) => (
        <div key={i} style={{ whiteSpace: 'pre', overflow: 'hidden' }}>
          {line.text}
        </div>
      ))}
    </div>
  );
};
