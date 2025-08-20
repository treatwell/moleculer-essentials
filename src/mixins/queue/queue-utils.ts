import { Redis, type RedisOptions } from 'ioredis';
import { parseURL } from 'ioredis/built/utils';

export function createRedisConnection(url: string): Redis {
  let tls: RedisOptions['tls'];
  if (url.startsWith('rediss://')) {
    tls = {};
  }
  const connection = new Redis({
    ...parseURL(url),
    tls,
    maxRetriesPerRequest: null,
    connectTimeout: 1000 * 60,
  });
  // Disable max listeners warning
  connection.setMaxListeners(0);
  return connection;
}
