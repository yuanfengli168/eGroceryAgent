/**
 * Tiny TTL cache. Used to avoid re-scraping the same product within
 * the freshness window (default 48h, as per brainstorming).
 *
 * Pure data, no async — sync get/set. TTL is wall-clock based.
 */

export interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly defaultTtlMs: number) {
    if (defaultTtlMs <= 0) {
      throw new Error("defaultTtlMs must be > 0");
    }
  }

  /** Get a value if present and not expired. */
  get(key: string, now: number = Date.now()): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /** Set a value with the default TTL. */
  set(key: string, value: T, now: number = Date.now()): void {
    this.store.set(key, { value, expiresAt: now + this.defaultTtlMs });
  }

  /** Set a value with a custom TTL. */
  setWithTtl(key: string, value: T, ttlMs: number, now: number = Date.now()): void {
    this.store.set(key, { value, expiresAt: now + ttlMs });
  }

  /** Check if a key exists and is fresh. */
  has(key: string, now: number = Date.now()): boolean {
    return this.get(key, now) !== null;
  }

  /** Remove a key. */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /** Clear all entries. */
  clear(): void {
    this.store.clear();
  }

  /** Number of (still-fresh) entries. */
  size(now: number = Date.now()): number {
    let count = 0;
    for (const entry of this.store.values()) {
      if (entry.expiresAt > now) count++;
    }
    return count;
  }
}
