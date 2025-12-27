import Redis from 'ioredis';

class RedisClient {
  private static instance: Redis | null = null;
  private client: Redis;

  private constructor() {
    const redisUrl = process.env.REDIS_URL;
    console.log('🔍 Redis URL:', redisUrl ? redisUrl.replace(/:[^:@]+@/, ':****@') : 'NOT SET');

    if (redisUrl) {
      this.client = new Redis(redisUrl, {
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
        family: 4, // Changed from 6 to 4 (IPv4)
        enableOfflineQueue: false,
        lazyConnect: false,
      });
    } else {
      const host = process.env.REDIS_HOST || 'localhost';
      const port = parseInt(process.env.REDIS_PORT || '6379');
      const password = process.env.REDIS_PASSWORD || undefined;

      console.log('🔍 Redis Config:', { host, port, hasPassword: !!password });

      this.client = new Redis({
        host,
        port,
        password,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        family: 4, // Use IPv4
        enableOfflineQueue: false,
        lazyConnect: false,
        // Add TLS for Upstash even when using individual params
        tls: host.includes('upstash.io') ? {} : undefined,
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
