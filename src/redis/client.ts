import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.REDIS_URL,
}).on('error', (err) => console.log('Redis Client Error', err));

client.connect();

export default client;
