declare module 'ioredis/built/utils' {
  import { RedisOptions } from 'ioredis';

  export function parseURL(p: string | undefined): RedisOptions;
}
