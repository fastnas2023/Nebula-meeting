import { describe, expect, it } from 'vitest';
import type { FullscreenState } from './meetingState';
import {
  DEFAULT_SORT_RULE,
  loadFullscreenTileId,
  loadSortRule,
  saveFullscreenTileId,
  saveSortRule,
  sortParticipantIds,
  toggleFullscreenState,
} from './meetingState';

function createStorageMock(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    _dump: () => Object.fromEntries(map.entries()),
  };
}

describe('meetingState', () => {
  it('toggles fullscreen default → fullscreen → exiting', () => {
    let state: FullscreenState = { fullscreenTileId: null, exitingFullscreenTileId: null };
    state = toggleFullscreenState(state, 'local');
    expect(state).toEqual({ fullscreenTileId: 'local', exitingFullscreenTileId: null });
    state = toggleFullscreenState(state, 'local');
    expect(state).toEqual({ fullscreenTileId: null, exitingFullscreenTileId: 'local' });
  });

  it('loads default sort rule on invalid json', () => {
    const storage = createStorageMock({ 'webrtc.sortRule': '{not-json' });
    expect(loadSortRule(storage)).toEqual(DEFAULT_SORT_RULE);
  });

  it('saves and loads fullscreen tile id', () => {
    const storage = createStorageMock();
    saveFullscreenTileId(storage, 'abc');
    expect(loadFullscreenTileId(storage)).toBe('abc');
    saveFullscreenTileId(storage, null);
    expect(loadFullscreenTileId(storage)).toBeNull();
  });

  it('saves and loads sort rule', () => {
    const storage = createStorageMock();
    saveSortRule(storage, { type: 'name', direction: 'asc' });
    expect(loadSortRule(storage)).toEqual({ type: 'name', direction: 'asc' });
  });

  it('sorts by name asc/desc', () => {
    const inputs = [
      { id: 'b', name: 'Bob', joinedAt: 2, isSpeaking: false },
      { id: 'a', name: 'Alice', joinedAt: 1, isSpeaking: false },
    ];
    expect(sortParticipantIds(inputs, { type: 'name', direction: 'asc' })).toEqual(['a', 'b']);
    expect(sortParticipantIds(inputs, { type: 'name', direction: 'desc' })).toEqual(['b', 'a']);
  });

  it('sorts speaking first and keeps stable tie-break', () => {
    const inputs = [
      { id: 'u1', name: 'Amy', joinedAt: 1, isSpeaking: false },
      { id: 'u2', name: 'Zoe', joinedAt: 2, isSpeaking: true },
      { id: 'u3', name: 'Ben', joinedAt: 3, isSpeaking: false },
    ];
    expect(sortParticipantIds(inputs, { type: 'speaking', direction: 'desc' })).toEqual(['u2', 'u1', 'u3']);
  });

  it('sorts by join time asc/desc', () => {
    const inputs = [
      { id: 'u1', name: 'A', joinedAt: 30, isSpeaking: false },
      { id: 'u2', name: 'B', joinedAt: 10, isSpeaking: false },
      { id: 'u3', name: 'C', joinedAt: 20, isSpeaking: false },
    ];
    expect(sortParticipantIds(inputs, { type: 'joinedAt', direction: 'asc' })).toEqual(['u2', 'u3', 'u1']);
    expect(sortParticipantIds(inputs, { type: 'joinedAt', direction: 'desc' })).toEqual(['u1', 'u3', 'u2']);
  });
});
