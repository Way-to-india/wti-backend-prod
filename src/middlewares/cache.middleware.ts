import type { Request, Response, NextFunction } from 'express';
import cacheService from '@/services/cache.service';
import crypto from 'crypto';

interface CacheOptions {
  ttl?: number;
  keyPrefix?: string;
  excludeQuery?: string[];
  includeHeaders?: string[];
}

/**
 * Generate cache key based on request
 */
function generateCacheKey(req: Request, options: CacheOptions = {}): string {
  const { keyPrefix = 'route', excludeQuery = [], includeHeaders = [] } = options;

  const method = req.method;
  const path = req.path;

  const queryParams = { ...req.query };
  excludeQuery.forEach((key) => delete queryParams[key]);
  const queryString = JSON.stringify(queryParams);

  const headers: Record<string, any> = {};
  includeHeaders.forEach((header) => {
    if (req.headers[header]) {
      headers[header] = req.headers[header];
    }
  });
  const headerString = JSON.stringify(headers);

  const keyString = `${method}:${path}:${queryString}:${headerString}`;
  const hash = crypto.createHash('md5').update(keyString).digest('hex');

  return `${keyPrefix}:${hash}`;
}

/**
 * Cache middleware factory
 */
export function cache(options: CacheOptions = {}) {
  const { ttl } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    console.log("req",req.params);

    const cacheKey = generateCacheKey(req, options);

    try {
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        console.log(`✅ Cache HIT: ${cacheKey}`);
        return res.deliver(200, true, cachedData);
      }

      console.log(`❌ Cache MISS: ${cacheKey}`);

      const originalDeliver = res.deliver;

      res.deliver = function (statusCode: number, success: boolean, data?: any, message?: string) {
        if (success && statusCode === 200 && data) {
          cacheService.set(cacheKey, data, ttl).catch((err) => {
            console.error('Failed to cache response:', err);
          });
        }

        return originalDeliver.call(this, statusCode, success, data, message);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Clear cache by pattern middleware
 */
export function clearCache(pattern: string) {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      const deletedCount = await cacheService.deletePattern(pattern);
      console.log(`🗑️  Cleared ${deletedCount} cache entries matching: ${pattern}`);
    } catch (error) {
      console.error('Clear cache error:', error);
    }
    next();
  };
}
