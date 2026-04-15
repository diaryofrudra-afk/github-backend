import { useRef, useEffect, useState } from 'react';

interface PretextProps {
  text: string;
  font: string;
  balanced?: boolean;
  className?: string;
}

// Measure how wide text is at a given font using a shared canvas.
let _canvas: HTMLCanvasElement | null = null;
function measureText(text: string, font: string): number {
  if (typeof document === 'undefined') return 0;
  if (!_canvas) _canvas = document.createElement('canvas');
  const ctx = _canvas.getContext('2d')!;
  ctx.font = font;
  return ctx.measureText(text).width;
}

// Binary-search for the narrowest maxWidth that keeps line count ≤ target.
function balancedWidth(words: string[], font: string, naturalWidth: number): number {
  if (words.length <= 1) return naturalWidth;

  let lo = naturalWidth / words.length;
  let hi = naturalWidth;

  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const lines = wordWrapCount(words, font, mid);
    const naturalLines = wordWrapCount(words, font, naturalWidth);
    if (lines <= naturalLines) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi);
}

function wordWrapCount(words: string[], font: string, maxWidth: number): number {
  let lines = 1;
  let lineWidth = 0;
  const spaceWidth = measureText(' ', font);
  for (const word of words) {
    const w = measureText(word, font);
    if (lineWidth === 0) {
      lineWidth = w;
    } else if (lineWidth + spaceWidth + w <= maxWidth) {
      lineWidth += spaceWidth + w;
    } else {
      lines++;
      lineWidth = w;
    }
  }
  return lines;
}

export function Pretext({ text, font, balanced = false, className }: PretextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [maxWidth, setMaxWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!balanced || !ref.current) return;

    const compute = () => {
      const parent = ref.current!.parentElement;
      if (!parent) return;
      const containerWidth = parent.getBoundingClientRect().width;
      if (containerWidth <= 0) return;
      const naturalWidth = Math.min(measureText(text, font), containerWidth);
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length <= 1) { setMaxWidth(null); return; }
      const w = balancedWidth(words, font, naturalWidth);
      setMaxWidth(w);
    };

    compute();
    const ro = new ResizeObserver(compute);
    if (ref.current.parentElement) ro.observe(ref.current.parentElement);
    return () => ro.disconnect();
  }, [text, font, balanced]);

  const style: React.CSSProperties = {};
  if (balanced && maxWidth !== null) {
    style.display = 'inline-block';
    style.maxWidth = maxWidth;
  }

  return (
    <span ref={ref} className={className} style={style}>
      {text}
    </span>
  );
}
