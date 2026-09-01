import Redis from 'ioredis';
import { env } from '../config/env';

export const pubClient = new Redis(env.REDIS_URL);
export const subClient = pubClient.duplicate();

pubClient.on('error', (err) => console.error('Redis pubClient error:', err.message));
subClient.on('error', (err) => console.error('Redis subClient error:', err.message));