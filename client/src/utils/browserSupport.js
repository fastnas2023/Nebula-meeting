export function detectTouchCapableDevice() {
  if (typeof window === 'undefined') return false;

  const coarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
  return coarsePointer || touchPoints > 0;
}

export function detectMobileEdgeBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /EdgA|EdgiOS/i.test(ua) && detectTouchCapableDevice();
}
