import { useEffect, useState } from 'react';

const WIDTH_QUERY = '(max-width: 820px)';
const POINTER_QUERY = '(pointer: coarse)';

function detectMobileAppMode(): boolean {
  if (typeof window === 'undefined') return false;

  const widthMatch = window.matchMedia(WIDTH_QUERY).matches;
  const coarsePointerMatch = window.matchMedia(POINTER_QUERY).matches;
  const hasTouchPoints = navigator.maxTouchPoints > 0;

  return widthMatch && (coarsePointerMatch || hasTouchPoints);
}

export function useMobileAppMode() {
  const [isMobileApp, setIsMobileApp] = useState(detectMobileAppMode);

  useEffect(() => {
    const widthMedia = window.matchMedia(WIDTH_QUERY);
    const pointerMedia = window.matchMedia(POINTER_QUERY);

    const update = () => {
      setIsMobileApp(detectMobileAppMode());
    };

    widthMedia.addEventListener('change', update);
    pointerMedia.addEventListener('change', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    update();

    return () => {
      widthMedia.removeEventListener('change', update);
      pointerMedia.removeEventListener('change', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return isMobileApp;
}
