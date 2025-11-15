/**
 * Simple in-memory cache for Penpot files
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class FileCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private ttlSeconds: number;

  constructor(ttlSeconds: number = 600) {
    this.ttlSeconds = ttlSeconds;
  }

  set(key: string, value: any): void {
    const expiresAt = Date.now() + (this.ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getAllKeys(): string[] {
    // Clean expired entries first
    this.cleanExpired();
    return Array.from(this.cache.keys());
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    this.cleanExpired();
    return this.cache.size;
  }
}