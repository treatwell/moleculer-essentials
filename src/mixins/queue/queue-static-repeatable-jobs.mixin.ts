import { Queue, type RepeatOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { wrapMixin } from '../../types/index.js';
import { GlobalStoreMixin } from '../global-store.mixin.js';
import { createRedisConnection } from './queue-utils.js';
import type { QueueMixinOptions } from './types.js';

export type RepeatableJob = { name: string; data?: unknown } & RepeatOptions;

function isPropertyEqual(a: unknown, b: unknown): boolean {
  if (a && b && a === b) {
    return true;
  }
  return !a && !b;
}

function isSameRepeatableJob(
  repeatableJob: Awaited<ReturnType<Queue['getRepeatableJobs']>>[number],
  job: RepeatableJob,
) {
  return (
    isPropertyEqual(repeatableJob.name, job.name) &&
    isPropertyEqual(repeatableJob.pattern, job.pattern) &&
    isPropertyEqual(repeatableJob.every, job.every?.toString()) &&
    isPropertyEqual(repeatableJob.tz, job.tz)
  );
}

/**
 * A job can be allowed or denied simply by adding it to list with the format:
 * `${queueName}:${jobName}`.
 */
function getFilteredJobs(
  qName: string,
  jobs: RepeatableJob[],
): RepeatableJob[] {
  const allowList = new Set(
    process.env.SCHEDULER_JOBS_ALLOWLIST?.split(',') || [],
  );
  const denyList = new Set(
    process.env.SCHEDULER_JOBS_DENYLIST?.split(',') || [],
  );

  return jobs.filter(j => {
    if (allowList.size > 0) {
      return allowList.has(`${qName}:${j.name}`);
    }
    if (denyList.size > 0) {
      return !denyList.has(`${qName}:${j.name}`);
    }
    return true;
  });
}

export type QueueStaticRepeatableJobsOptions = {
  /**
   * Set to `false` to prevent deleting repeatable jobs not registered.
   */
  autoRemove?: boolean;
};

// Convert it to any because moleculer doesn't support symbol on Service instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mixinStore = Symbol('QueueStaticRepeatableJobsMixinStore') as any;

/**
 * This Mixin allow to register repeatable jobs and remove other ones.
 * It should mainly be setup on the same service as the related QueueWorker.
 */
export function QueueStaticRepeatableJobs(
  queueName: string,
  jobs: RepeatableJob[],
  opts: QueueStaticRepeatableJobsOptions & QueueMixinOptions,
) {
  const kKey = Symbol('Queue Static Repeatable Jobs Key');

  return wrapMixin({
    mixins: [GlobalStoreMixin<Redis>()],
    methods: {
      async registerRepeatableJobs() {
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
        const queue = new Queue(queueName, { connection });

        const filteredJobs = getFilteredJobs(queueName, jobs);

        // No need to set concurrency as we never have a lot
        // of static repeatable jobs.
        await Promise.all(
          filteredJobs.map(({ name, data, ...repeat }) =>
            queue.add(name, data, { repeat, removeOnComplete: true }),
          ),
        );

        if (opts.autoRemove !== false) {
          // Remove jobs no registered
          const repeatableJobs = await queue.getRepeatableJobs();
          const rjToRemove = repeatableJobs.filter(
            rj => !filteredJobs.some(j => isSameRepeatableJob(rj, j)),
          );

          if (rjToRemove.length) {
            await Promise.all(
              rjToRemove.map(rj => queue.removeRepeatableByKey(rj.key)),
            );
          }
        }
        // Shut down queue (will not close connection)
        await queue.close();
        await this.removeServiceFromStore('redis', key);
      },
    },

    created() {
      if (!this[mixinStore]) {
        this[mixinStore] = new Set();
      }
      if ((this[mixinStore] as Set<string>).has(this[kKey] as string)) {
        throw new Error(
          `Queue ${queueName} has already registered static repeatable jobs`,
        );
      }
      (this[mixinStore] as Set<string>).add(queueName);
    },

    events: {
      // TODO Improve this to only be run once in a while globally on the cluster
      '$broker.started': {
        async handler() {
          await this.registerRepeatableJobs();
        },
      },
    },
  });
}
