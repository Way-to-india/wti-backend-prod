import redis from '@/config/redis';
import type { Redis } from 'ioredis';

export class CacheService {
  private redis: Redis;
  private defaultTTL: number;

  constructor() {
    this.redis = redis;
    this.defaultTTL = parseInt(process.env.CACHE_TTL || '3600'); 
  }

  /**
   * Generate cache key with prefix
   */
  private generateKey(prefix: string, identifier: string | object): string {
    if (typeof identifier === 'object') {
      return `${prefix}:${JSON.stringify(identifier)}`;
    }
    return `${prefix}:${identifier}`;
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cache data
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;
      await this.redis.setex(key, expiry, serialized);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete cache by key
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete cache by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;

      const pipeline = this.redis.pipeline();
      keys.forEach((key) => pipeline.del(key));
      await pipeline.exec();

      return keys.length;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      await this.redis.flushdb();
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get remaining TTL
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      console.error('Cache TTL error:', error);
      return -1;
    }
  }

  /**
   * Increment value
   */
  async increment(key: string, by: number = 1): Promise<number> {
    try {
      return await this.redis.incrby(key, by);
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * Set with multiple keys (batch operation)
   */
  async setMultiple(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();

      entries.forEach(({ key, value, ttl }) => {
        const serialized = JSON.stringify(value);
        const expiry = ttl || this.defaultTTL;
        pipeline.setex(key, expiry, serialized);
      });

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache set multiple error:', error);
      return false;
    }
  }

  /**
   * Get multiple keys
   */
  async getMultiple<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redis.mget(...keys);
      return values.map((val) => (val ? (JSON.parse(val) as T) : null));
    } catch (error) {
      console.error('Cache get multiple error:', error);
      return keys.map(() => null);
    }
  }
}

export default new CacheService();
