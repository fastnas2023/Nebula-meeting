export type ParticipantId = 'local' | string;

export type SortRule =
  | { type: 'name'; direction: 'asc' | 'desc' }
  | { type: 'speaking'; direction: 'desc' }
  | { type: 'joinedAt'; direction: 'asc' | 'desc' };

export type ParticipantSortInput = {
  id: ParticipantId;
  name: string;
  joinedAt: number;
  isSpeaking: boolean;
};

export type FullscreenState = {
  fullscreenTileId: string | null;
  exitingFullscreenTileId: string | null;
};

export const STORAGE_KEYS = {
  fullscreenTileId: 'webrtc.fullscreenTileId',
  sortRule: 'webrtc.sortRule',
} as const;

export const DEFAULT_SORT_RULE: SortRule = { type: 'joinedAt', direction: 'asc' };

export function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function loadSortRule(storage: Pick<Storage, 'getItem'>): SortRule {
  const parsed = safeJsonParse<SortRule>(storage.getItem(STORAGE_KEYS.sortRule));
  if (!parsed) return DEFAULT_SORT_RULE;
  if (parsed.type === 'name' && (parsed.direction === 'asc' || parsed.direction === 'desc')) return parsed;
  if (parsed.type === 'joinedAt' && (parsed.direction === 'asc' || parsed.direction === 'desc')) return parsed;
  if (parsed.type === 'speaking') return { type: 'speaking', direction: 'desc' };
  return DEFAULT_SORT_RULE;
}

export function saveSortRule(storage: Pick<Storage, 'setItem'>, rule: SortRule) {
  storage.setItem(STORAGE_KEYS.sortRule, JSON.stringify(rule));
}

export function loadFullscreenTileId(storage: Pick<Storage, 'getItem'>): string | null {
  const value = storage.getItem(STORAGE_KEYS.fullscreenTileId);
  if (!value) return null;
  return value;
}

export function saveFullscreenTileId(storage: Pick<Storage, 'setItem' | 'removeItem'>, id: string | null) {
  if (!id) {
    storage.removeItem(STORAGE_KEYS.fullscreenTileId);
    return;
  }
  storage.setItem(STORAGE_KEYS.fullscreenTileId, id);
}

export function sortParticipantIds(inputs: ParticipantSortInput[], rule: SortRule): ParticipantId[] {
  const indexed = inputs.map((p, index) => ({ p, index }));

  indexed.sort((a, b) => {
    if (rule.type === 'speaking') {
      const sa = a.p.isSpeaking ? 1 : 0;
      const sb = b.p.isSpeaking ? 1 : 0;
      if (sb !== sa) return sb - sa;
      const nameCmp = a.p.name.localeCompare(b.p.name);
      if (nameCmp !== 0) return nameCmp;
      return a.index - b.index;
    }

    if (rule.type === 'name') {
      const cmp = a.p.name.localeCompare(b.p.name);
      if (cmp !== 0) return rule.direction === 'asc' ? cmp : -cmp;
      return a.index - b.index;
    }

    const diff = a.p.joinedAt - b.p.joinedAt;
    if (diff !== 0) return rule.direction === 'asc' ? diff : -diff;
    return a.index - b.index;
  });

  return indexed.map(x => x.p.id);
}

export function toggleFullscreenState(state: FullscreenState, tileId: string): FullscreenState {
  const active = state.fullscreenTileId || state.exitingFullscreenTileId;
  if (active === tileId) {
    return {
      fullscreenTileId: null,
      exitingFullscreenTileId: active,
    };
  }
  return {
    fullscreenTileId: tileId,
    exitingFullscreenTileId: null,
  };
}
