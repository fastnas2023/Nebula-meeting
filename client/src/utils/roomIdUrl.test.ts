import { describe, expect, it } from 'vitest';
import { getRoomIdFromSearch, removeRoomIdFromHref } from './roomIdUrl';

describe('roomIdUrl', () => {
  it('detects roomId in search', () => {
    expect(getRoomIdFromSearch('?roomId=room-123')).toBe('room-123');
    expect(getRoomIdFromSearch('?roomId=')).toBeNull();
    expect(getRoomIdFromSearch('')).toBeNull();
  });

  it('removes roomId from href', () => {
    expect(removeRoomIdFromHref('https://example.com/?roomId=room-123')).toBe('https://example.com/');
    expect(removeRoomIdFromHref('https://example.com/?roomId=room-123&x=1')).toBe('https://example.com/?x=1');
    expect(removeRoomIdFromHref('https://example.com/?x=1&roomId=room-123')).toBe('https://example.com/?x=1');
  });
});

