import { Redis, type RedisOptions } from 'ioredis';
import type { Service } from 'moleculer';
import { GlobalStoreMixin } from './global-store.mixin.js';
import { wrapMixin } from '../types/index.js';

type AllowedOptions = Omit<RedisOptions, 'lazyConnect'>;

export type RedisMixinOptions = {
  reuseClient?: boolean;
  getOptions?: <TService extends Service = Service>(
    svc: TService,
  ) => Promise<AllowedOptions>;
};

export function RedisMixin(
  options: AllowedOptions,
  { reuseClient = true, getOptions }: RedisMixinOptions = {},
) {
  const kKey = Symbol('Redis Key Symbol');

  return wrapMixin({
    mixins: [GlobalStoreMixin<Redis>()],
    methods: {
      getRedis(): Redis {
        return this.redis;
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
      this.redis = this.getFromStore('redis', key);
      if (!this.redis) {
        this.redis = new Redis({
          ...finalOptions,
          lazyConnect: true,
        });
        this.setClientToStore('redis', key, this.redis, () =>
          this.redis?.disconnect(),
        );
      }
    },

    async stopped() {
      await this.removeServiceFromStore('redis', this[kKey] as string);
    },
  });
}
