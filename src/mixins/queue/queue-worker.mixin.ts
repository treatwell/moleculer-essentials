import { type Job, Worker, type WorkerOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import { isFunction } from 'lodash-es';
import { wrapMixin } from '../../types/index.js';
import { createRedisConnection } from './queue-utils.js';
import type { QueueMixinOptions, WithoutConnection } from './types.js';

export type JobMeta = {
  job?: Job;
  jobWorkerToken?: string;
};

export type JobProcessorOptions = {
  /**
   * Use the job name as the action name.
   * When false (default), the action name is 'processor'.
   */
  useNamedFunctions?: boolean;
  /**
   * Skip normal info logs at the start and end of the job.
   * Will never disable logs on errors.
   */
  skipNormalLogs?: boolean;
  /**
   * Allow to log additional fields from the job data.
   * Currently, doesn't support nested fields.
   */
  logDataFields?: string[];
  /**
   * Optional wrapper that MUST call the passed function.
   */
  wrapper?: (
    job: Job,
    token: string | undefined,
    fn: (job: Job, token?: string) => Promise<unknown>,
  ) => Promise<unknown>;
};

const kConnection = Symbol('Queue Worker Connection');

/**
 * This Mixin create the worker system.
 */
export function QueueWorker(
  queueName: string,
  opts: WithoutConnection<WorkerOptions> & QueueMixinOptions,
  processorOptions: JobProcessorOptions = {},
) {
  return wrapMixin({
    metadata: {
      worker: true,
      [`worker-${queueName}`]: true,
    },
    methods: {
      getWorker(): Worker {
        return this.$worker;
      },

      async processJob(job: Job, token?: string) {
        if (processorOptions.wrapper) {
          return processorOptions.wrapper(
            job,
            token,
            this._processJob.bind(this),
          );
        }
        return this._processJob(job, token);
      },

      async _processJob(job: Job, token?: string) {
        const methodName = processorOptions.useNamedFunctions
          ? job.name
          : 'processor';

        if (!this.actions[methodName]) {
          throw new Error(`action '${methodName}' does not exist.`);
        }

        const logBase: Record<string, unknown> = {
          msg: `Job ${job.name} on ${queueName} (${job.id})`,
          name: job.name,
          id: job.id,
        };
        if (processorOptions.logDataFields) {
          processorOptions.logDataFields.forEach(field => {
            logBase[field] = job.data?.[field];
          });
        }

        if (processorOptions.skipNormalLogs !== true) {
          this.logger.info(logBase);
        }
        const start = Date.now();

        try {
          // @ts-expect-error Generics will not be inferred by TS
          const res = await this.actions[methodName](job.data, {
            meta: { job, jobWorkerToken: token },
          });
          if (processorOptions.skipNormalLogs !== true) {
            this.logger.info({
              ...logBase,
              msg: `${logBase.msg} succeeded`,
              duration: Date.now() - start,
            });
          }
          return res;
        } catch (err) {
          this.logger.info({
            ...logBase,
            msg: `${logBase.msg} failed`,
            duration: Date.now() - start,
            err,
          });
          throw err;
        }
      },
    },

    async started() {
      if (this.$worker) {
        throw new Error(
          `A QueueWorker mixin was already on service '${this.name}'`,
        );
      }

      const url = isFunction(opts.brokerURL)
        ? await opts.brokerURL(this)
        : opts.brokerURL;
      const connection = createRedisConnection(url);
      const worker = new Worker(queueName, this.processJob.bind(this), {
        connection,
        ...opts,
        autorun: false,
      });
      worker.on('error', err =>
        this.logger.error(`Worker on ${queueName} got error`, { err }),
      );
      this.$worker = worker;
      this[kConnection] = connection;
    },

    events: {
      '$broker.started': {
        handler() {
          const worker = this.getWorker();
          worker.run().catch(error => worker.emit('error', error));
        },
      },
    },

    async stopped() {
      await this.$worker?.close();
      (this[kConnection] as Redis | undefined)?.disconnect();
    },
  });
}
