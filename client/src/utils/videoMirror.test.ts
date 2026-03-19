import { describe, expect, it } from 'vitest';
import { isIOSUserAgent, isSafariUserAgent, shouldCssFlipLocalPreview } from './videoMirror';

describe('videoMirror', () => {
  it('detects iOS user agent', () => {
    expect(isIOSUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe(true);
    expect(isIOSUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).toBe(false);
    expect(isIOSUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe(true);
  });

  it('detects Safari user agent', () => {
    expect(isSafariUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).toBe(true);
    expect(isSafariUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')).toBe(false);
    expect(isSafariUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.0.0 Mobile/15E148 Safari/604.1')).toBe(false);
  });

  it('mirrors local preview on Chrome when enabled', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    expect(shouldCssFlipLocalPreview({ userAgent: ua, facingMode: 'user', userMirrorEnabled: true, isScreenShare: false })).toBe(true);
    expect(shouldCssFlipLocalPreview({ userAgent: ua, facingMode: 'user', userMirrorEnabled: false, isScreenShare: false })).toBe(false);
  });

  it('handles iOS Safari auto-mirror by inverting CSS flip', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(shouldCssFlipLocalPreview({ userAgent: ua, facingMode: 'user', userMirrorEnabled: true, isScreenShare: false })).toBe(false);
    expect(shouldCssFlipLocalPreview({ userAgent: ua, facingMode: 'user', userMirrorEnabled: false, isScreenShare: false })).toBe(true);
  });

  it('never mirrors screen share or rear camera', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    expect(shouldCssFlipLocalPreview({ userAgent: ua, facingMode: 'environment', userMirrorEnabled: true, isScreenShare: false })).toBe(false);
    expect(shouldCssFlipLocalPreview({ userAgent: ua, facingMode: 'user', userMirrorEnabled: true, isScreenShare: true })).toBe(false);
  });
});

