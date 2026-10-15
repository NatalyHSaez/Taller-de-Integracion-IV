export type CacheEntry<T> = {
  value: T;
  storedAt: number;
  expiresAt: number;
};

export type CacheRead<T> = {
  hit: boolean;
  value?: T;
  ageMs?: number;
  staleMs?: number;
};

/**
 * Caché simple en memoria para respuestas de lectura.
 *
 * No persiste información clínica ni tokens en disco. Su objetivo es evitar
 * solicitudes repetidas durante una misma ejecución de la aplicación.
 */
class MemoryDataCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  getFresh<T>(key: string): CacheRead<T> {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return { hit: false };
    }

    const now = Date.now();

    if (entry.expiresAt <= now) {
      return {
        hit: false,
        value: entry.value,
        ageMs: now - entry.storedAt,
        staleMs: now - entry.expiresAt,
      };
    }

    return {
      hit: true,
      value: entry.value,
      ageMs: now - entry.storedAt,
      staleMs: 0,
    };
  }

  getStale<T>(key: string, maxStaleMs: number): CacheRead<T> {
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return { hit: false };
    }

    const now = Date.now();
    const staleMs = Math.max(0, now - entry.expiresAt);

    if (staleMs > maxStaleMs) {
      this.entries.delete(key);
      return { hit: false };
    }

    return {
      hit: true,
      value: entry.value,
      ageMs: now - entry.storedAt,
      staleMs,
    };
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    const now = Date.now();

    this.entries.set(key, {
      value,
      storedAt: now,
      expiresAt: now + Math.max(0, ttlMs),
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }
}

export const dataCache = new MemoryDataCache();
