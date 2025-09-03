import type { Redis } from 'ioredis';
import {
  type Job,
  type JobsOptions,
  QueueEvents,
  type QueueEventsOptions,
} from 'bullmq';
import { wrapMixin } from '../../types/index.js';
import { GlobalStoreMixin } from '../global-store.mixin.js';
import { createRedisConnection } from './queue-utils.js';
import type { QueueMixinOptions, WithoutConnection } from './types.js';

/**
 * This Mixin add the capability to wait on a job.
 * WARNING: Needs to be used with QueueClient mixin.
 */
export function QueueEventsClient<N extends string>(
  queueName: N,
  opts: WithoutConnection<QueueEventsOptions> & QueueMixinOptions,
) {
  const kKey = Symbol('Queue Events Client Key');

  return wrapMixin({
    mixins: [GlobalStoreMixin<Redis>()],
    methods: {
      _getQueueEvents(): Map<
        string,
        { events: QueueEvents; running: boolean }
      > {
        return this.$queuesEvents;
      },

      /**
       * Return the QueueEvents instance for the given queue name.
       * Will run the QueueEvents if it's not already running (lazy connect).
       * Will throw an error if the QueueEvents is not found.
       */
      getQueueEvents(qName: N): QueueEvents {
        const queueEvents = this._getQueueEvents().get(qName);
        if (!queueEvents) {
          throw new Error(`QueueEvents '${qName}' not found`);
        }
        const qEvents = queueEvents.events;
        if (!queueEvents.running) {
          qEvents.run().catch(error => qEvents.emit('error', error));
          queueEvents.running = true;
        }
        return qEvents;
      },

      /**
       * Same as addJob but will also wait for the job to finish before returning.
       */
      async addAndWait<T = unknown, D = unknown>(
        qName: N,
        name: string,
        data: D,
        jOpts?: JobsOptions,
        ttl?: number,
      ): Promise<T> {
        const job = (await this.addJob(qName, name, data, jOpts)) as Job;

        return job.waitUntilFinished(this.getQueueEvents(qName), ttl);
      },

      /**
       * Same as addBulkJob but will also wait for the jobs to finish before returning.
       */
      async addBulkAndWait<T = unknown, D = unknown>(
        qName: N,
        name: string,
        data: D[],
        jOpts?: JobsOptions,
        ttl?: number,
      ): Promise<T[]> {
        const jobs = (await this.addBulkJob(qName, name, data, jOpts)) as Job[];
        const q = this.getQueueEvents(qName);

        return Promise.all(jobs.map(j => j.waitUntilFinished(q, ttl)));
      },
    },

    created() {
      if (!this.$queuesEvents) {
        this.$queuesEvents = new Map();
      }
    },
    async started() {
      if (this._getQueueEvents().get(queueName)) {
        throw new Error(
          `Queue client '${queueName}' already exists on service '${this.name}'`,
        );
      }

      const key =
        typeof opts.brokerURL === 'function'
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

      const qEvents = new QueueEvents(queueName, {
        connection,
        ...opts,
        autorun: false,
      });

      // Disable max listeners warning
      qEvents.setMaxListeners(0);
      qEvents.on('error', err =>
        this.logger.error(`QueueEvents on ${queueName} got error`, { err }),
      );

      this._getQueueEvents().set(queueName, {
        events: qEvents,
        running: false,
      });
    },

    async stopped() {
      const q = this._getQueueEvents().get(queueName);
      if (q) {
        await q.events.close();
      }
      await this.removeServiceFromStore('redis', this[kKey] as string);
    },
  });
}
