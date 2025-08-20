import type { Redis } from 'ioredis';
import { Errors } from 'moleculer';
import { type Job, type JobsOptions, Queue, type QueueOptions } from 'bullmq';
import { isFunction } from 'lodash';

import { wrapMixin } from '../../types/index.js';
import { GlobalStoreMixin } from '../global-store.mixin.js';
import { createRedisConnection } from './queue-utils.js';
import type { QueueMixinOptions, WithoutConnection } from './types.js';

/**
 * This Mixin add the capability to launch a job.
 */
export function QueueClient<N extends string>(
  queueName: N,
  opts: WithoutConnection<QueueOptions> & QueueMixinOptions,
) {
  const kKey = Symbol('Queue Client Key');

  return wrapMixin({
    mixins: [GlobalStoreMixin<Redis>()],
    methods: {
      _getQueues(): Map<string, Queue> {
        return this.$queues;
      },

      /**
       * Add a job to a specific queue. The queue name needs to be passed as parameters
       * to enable multiple queue clients in the same service.
       */
      addJob<D = unknown>(
        qName: N,
        name: string,
        data: D,
        jOpts?: JobsOptions,
      ): Promise<Job> {
        const q = this._getQueues().get(qName);
        if (!q) {
          throw new Errors.MoleculerServerError(
            `Queue '${qName}' does not exists on '${this.name}'`,
          );
        }
        return q.add(name, data, jOpts);
      },

      /**
       * Add jobs to a specific queue. The queue name needs to be passed as parameters
       * to enable multiple queue clients in the same service.
       */
      addBulkJob<D = unknown>(
        qName: N,
        name: string,
        data: D[],
        jOpts?: JobsOptions,
      ): Promise<Job[]> {
        const q = this._getQueues().get(qName);
        if (!q) {
          throw new Errors.MoleculerServerError(
            `Queue '${qName}' does not exists on '${this.name}'`,
          );
        }
        return q.addBulk(data.map(d => ({ name, data: d, opts: jOpts })));
      },

      /**
       * Get a queue bundle if you need specific features
       */
      getQueue(qName: N): Queue {
        const q = this._getQueues().get(qName);
        if (!q) {
          throw new Errors.MoleculerServerError(
            `Queue '${qName}' does not exists on '${this.name}'`,
          );
        }
        return q;
      },
    },
    created() {
      if (!this.$queues) {
        this.$queues = new Map();
      }
    },
    async started() {
      if (this._getQueues().has(queueName)) {
        throw new Error(
          `Queue client '${queueName}' already exists on service '${this.name}'`,
        );
      }

      const key = isFunction(opts.brokerURL)
        ? await opts.brokerURL(this)
        : opts.brokerURL;
      this[kKey] = key;

      let connection = this.getFromStore('redis', key);
      if (!connection) {
        connection = createRedisConnection(key);
        this.setClientToStore('redis', key, connection, () =>
          connection?.disconnect(),
        );
      }

      const queue = new Queue(queueName, { connection, ...opts });
      // Disable max listeners warning
      queue.setMaxListeners(0);
      queue.on('error', err =>
        this.logger.error(`Queue ${queueName} got error`, { err }),
      );

      this._getQueues().set(queueName, queue);
    },
    async stopped() {
      const q = this._getQueues().get(queueName);
      if (q) {
        await q.close();
      }
      await this.removeServiceFromStore('redis', this[kKey] as string);
    },
  });
}
