export type TtlRecord<T> = {
  expiresAt: number;
  value: T;
};

export function setWithTtl<T>(storage: Storage, key: string, value: T, ttlMs: number, now = Date.now()) {
  const record: TtlRecord<T> = { expiresAt: now + ttlMs, value };
  storage.setItem(key, JSON.stringify(record));
}

export function getWithTtl<T>(storage: Storage, key: string, now = Date.now()): T | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TtlRecord<T>>;
    if (typeof parsed.expiresAt !== 'number') {
      storage.removeItem(key);
      return null;
    }
    if (parsed.expiresAt <= now) {
      storage.removeItem(key);
      return null;
    }
    return (parsed as TtlRecord<T>).value ?? null;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function remove(storage: Storage, key: string) {
  storage.removeItem(key);
}

