import { describe, it, expect, beforeEach } from "vitest";
import { TtlCache } from "../../src/cache/ttl.js";

describe("TtlCache", () => {
  let now: number;
  let cache: TtlCache<string>;

  beforeEach(() => {
    now = 1_000_000;
    cache = new TtlCache<string>(60_000); // 60s
  });

  it("returns null for missing keys", () => {
    expect(cache.get("missing", now)).toBeNull();
  });

  it("stores and retrieves values within TTL", () => {
    cache.set("a", "alpha", now);
    expect(cache.get("a", now)).toBe("alpha");
    expect(cache.get("a", now + 30_000)).toBe("alpha");
  });

  it("returns null after TTL expires", () => {
    cache.set("a", "alpha", now);
    expect(cache.get("a", now + 60_001)).toBeNull();
  });

  it("evicts expired entries on access", () => {
    cache.set("a", "alpha", now);
    cache.get("a", now + 60_001);
    expect(cache.has("a", now + 60_001)).toBe(false);
  });

  it("setWithTtl uses the custom TTL", () => {
    cache.setWithTtl("a", "alpha", 5_000, now);
    expect(cache.get("a", now + 4_999)).toBe("alpha");
    expect(cache.get("a", now + 5_001)).toBeNull();
  });

  it("has() returns true for fresh entries and false for expired/missing", () => {
    expect(cache.has("missing", now)).toBe(false);
    cache.set("a", "alpha", now);
    expect(cache.has("a", now)).toBe(true);
    expect(cache.has("a", now + 60_001)).toBe(false);
  });

  it("delete() removes entries and reports whether anything was deleted", () => {
    cache.set("a", "alpha", now);
    expect(cache.delete("a")).toBe(true);
    expect(cache.delete("a")).toBe(false);
    expect(cache.get("a", now)).toBeNull();
  });

  it("clear() empties the cache", () => {
    cache.set("a", "alpha", now);
    cache.set("b", "beta", now);
    cache.clear();
    expect(cache.size(now)).toBe(0);
    expect(cache.get("a", now)).toBeNull();
  });

  it("size() excludes expired entries", () => {
    cache.set("a", "alpha", now);
    cache.setWithTtl("b", "beta", 30_000, now);
    expect(cache.size(now)).toBe(2);
    expect(cache.size(now + 30_001)).toBe(1); // b expired
    expect(cache.size(now + 60_001)).toBe(0); // both expired
  });

  it("overwrites a key with a new value", () => {
    cache.set("a", "alpha", now);
    cache.set("a", "alpha2", now + 1000);
    expect(cache.get("a", now + 1000)).toBe("alpha2");
  });

  it("rejects non-positive TTL", () => {
    expect(() => new TtlCache<string>(0)).toThrow();
    expect(() => new TtlCache<string>(-1)).toThrow();
  });
});
