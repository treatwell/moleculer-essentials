import { FlowProducer, type QueueBaseOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { isFunction } from 'lodash-es';
import { wrapMixin } from '../../types/index.js';
import { createRedisConnection } from './queue-utils.js';
import type { QueueMixinOptions, WithoutConnection } from './types.js';

const kConnection = Symbol('Queue FlowProducer Connection');

/**
 * This Mixin add the capability to launch a BullMQ flows.
 */
export function QueueFlowProducerMixin(
  opts: WithoutConnection<QueueBaseOptions> & QueueMixinOptions,
) {
  return wrapMixin({
    methods: {
      getFlowProducer(): FlowProducer {
        return this.$flowProducer;
      },
    },
    async started() {
      if (this.$flowProducer) {
        throw new Error(
          `Queue Flow producer already exists on service '${this.name}'`,
        );
      }

      const url = isFunction(opts.brokerURL)
        ? await opts.brokerURL(this)
        : opts.brokerURL;
      const connection = createRedisConnection(url);
      this.$flowProducer = new FlowProducer({ connection, ...opts });
      this[kConnection] = connection;
    },
    async stopped() {
      await this.$flowProducer?.close();
      (this[kConnection] as Redis | undefined)?.disconnect();
    },
  });
}
