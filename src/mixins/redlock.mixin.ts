import { Errors, Service } from 'moleculer';
import { Redis, RedisOptions } from 'ioredis';
import Redlock, { CompatibleRedisClient } from 'redlock';
import { wrapMixin } from '../types/index.js';
import { GlobalStoreMixin } from './global-store.mixin.js';

type AllowedOptions = Omit<RedisOptions, 'lazyConnect'>;

export type RedlockMixinOptions = {
  redLockOptions: Redlock.Options;
  reuseClient?: boolean;
  getOptions?: <TService extends Service = Service>(
    svc: TService,
  ) => Promise<AllowedOptions>;
};

export function RedlockMixin(
  options: AllowedOptions,
  { reuseClient = true, redLockOptions, getOptions }: RedlockMixinOptions,
) {
  const kKey = Symbol('Redlock Key Symbol');

  return wrapMixin({
    mixins: [GlobalStoreMixin<Redis>()],
    methods: {
      getRedlock(): Redlock {
        return this.redlock;
      },
      async withLock<T>(
        lockKey: string,
        lockTTL: number,
        action: () => Promise<T>,
      ): Promise<T> {
        let lock: Redlock.Lock;

        try {
          lock = await this.getRedlock().acquire(lockKey, lockTTL);
        } catch {
          throw new Errors.MoleculerRetryableError('Locked', 503);
        }

        const lockInterval = setInterval(async () => {
          try {
            await lock.extend(lockTTL);
          } catch (err) {
            this.logger.warn(`Unable to extend lock ${lockKey}`, { err });
          }
          return lock.extend(lockTTL);
        }, lockTTL / 2);

        try {
          return await action();
        } finally {
          clearInterval(lockInterval);
          await lock.unlock();
        }
      },
    },

    async started() {
      const finalOptions = {
        ...options,
        ...(await getOptions?.(this)),
      };

      const key = [
        finalOptions.host,
        finalOptions.port,
        finalOptions.db,
        finalOptions.username,
        finalOptions.path,
        reuseClient ? '' : Math.random(),
      ]
        .filter(Boolean)
        .join('|');

      this[kKey] = key;

      let redis = this.getFromStore('redis', key);
      if (!redis) {
        redis = new Redis({
          ...finalOptions,
          lazyConnect: true,
        });
        this.setClientToStore('redis', key, redis, () => redis?.disconnect());
      }

      // TODO: use an array of redis clusters in order to avoid double locks in case of redis crashing
      this.redlock = new Redlock(
        [redis as unknown as CompatibleRedisClient],
        redLockOptions,
      );
    },

    async stopped() {
      if (this.getRedlock()) {
        await this.getRedlock().quit();
      }
      await this.removeServiceFromStore('redis', this[kKey] as string);
    },
  });
}
