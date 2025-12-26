// src/config/redis.ts
import Redis from 'ioredis';

class RedisClient {
  private static instance: Redis | null = null;
  private client: Redis;

  private constructor() {
    console.log(process.env.REDIS_URL);
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      this.client = new Redis(redisUrl, {
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
        family: 6,
      });
    } else {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });
    }

    this.client.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
    });

    this.client.on('ready', () => {
      console.log('🚀 Redis is ready to use');
    });
  }

  public static getInstance(): Redis {
    if (!RedisClient.instance) {
      const redisClient = new RedisClient();
      RedisClient.instance = redisClient.client;
    }
    return RedisClient.instance;
  }

  public static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
      RedisClient.instance = null;
      console.log('Redis disconnected');
    }
  }
}

export default RedisClient.getInstance();
