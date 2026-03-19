export type FacingMode = 'user' | 'environment' | string | undefined;

export function isIOSUserAgent(userAgent: string): boolean {
  if (!userAgent) return false;
  if (/(iPhone|iPad|iPod)/i.test(userAgent)) return true;
  if (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent)) return true;
  return false;
}

export function isSafariUserAgent(userAgent: string): boolean {
  if (!userAgent) return false;
  const hasSafari = /Safari/i.test(userAgent);
  const isChromeFamily = /(Chrome|CriOS|Edg|EdgiOS|OPR|SamsungBrowser)/i.test(userAgent);
  return hasSafari && !isChromeFamily;
}

export function shouldCssFlipLocalPreview(params: {
  userAgent: string;
  facingMode: FacingMode;
  userMirrorEnabled: boolean;
  isScreenShare: boolean;
}): boolean {
  const { userAgent, facingMode, userMirrorEnabled, isScreenShare } = params;

  if (isScreenShare) return false;
  if (facingMode === 'environment') return false;

  const isIOS = isIOSUserAgent(userAgent);
  const isSafari = isSafariUserAgent(userAgent);

  const safariAutoMirrors = isIOS && isSafari && facingMode === 'user';

  if (safariAutoMirrors) {
    return !userMirrorEnabled;
  }

  return userMirrorEnabled;
}

