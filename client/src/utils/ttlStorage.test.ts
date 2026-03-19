import { describe, expect, it } from 'vitest';
import { getWithTtl, setWithTtl } from './ttlStorage';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  } as Storage;
}

describe('ttlStorage', () => {
  it('returns value before expiry and null after expiry', () => {
    const storage = createMemoryStorage();
    setWithTtl(storage, 'k', { a: 1 }, 1000, 100);
    expect(getWithTtl(storage, 'k', 500)).toEqual({ a: 1 });
    expect(getWithTtl(storage, 'k', 1100)).toBeNull();
    expect(storage.getItem('k')).toBeNull();
  });

  it('removes invalid json', () => {
    const storage = createMemoryStorage();
    storage.setItem('k', '{bad');
    expect(getWithTtl(storage, 'k', 0)).toBeNull();
    expect(storage.getItem('k')).toBeNull();
  });
});

