import { defaultsDeep, isFunction } from 'lodash';
import {
  type LoggerInstance,
  type Span,
  type Tracer,
  TracerExporters,
} from 'moleculer';
import { flattenTags } from './utils.js';

export type NewrelicTraceExporterOptions = {
  logger?: LoggerInstance;
  safetyTags?: boolean;

  /**
   * Base URL for NewRelic server.
   */
  baseURL?: string;

  /**
   * Maximum number of spans to be sent in one time.
   */
  batchSize?: number;

  /**
   * NewRelic Insert API Key.
   */
  insertKey?: string;

  /**
   * Batch send time interval in seconds.
   */
  interval?: number;

  /**
   * Default span tags.
   */
  defaultTags?: Record<string, unknown> | (() => Record<string, unknown>);
};

/**
 * >>> Hard copy of the moleculer NewRelic provider. It didn't handle errors correctly
 *
 * Trace Exporter for NewRelic using Zipkin data.
 *
 * NewRelic zipkin tracer: https://docs.newrelic.com/docs/understand-dependencies/distributed-tracing/trace-api/report-zipkin-format-traces-trace-api
 * API v2: https://zipkin.io/zipkin-api/#/
 */
export class NewrelicTraceExporter extends TracerExporters.Base {
  private queue: Span[];

  private timer: NodeJS.Timeout | null = null;

  private defaultTags: Record<string, unknown> = {};

  constructor(opts: NewrelicTraceExporterOptions) {
    super(opts);

    this.opts = defaultsDeep(this.opts, {
      baseURL:
        process.env.NEW_RELIC_TRACE_API_URL || 'https://trace-api.newrelic.com',
      batchSize: 1000,
      insertKey: '',
      interval: 5,
      defaultTags: null,
    });

    this.queue = [];
  }

  /**
   * Initialize Trace Exporter.
   */
  init(tracer: Tracer): void {
    super.init(tracer);

    if (this.opts.interval > 0) {
      this.timer = setInterval(() => this.flush(), this.opts.interval * 1000);
      this.timer.unref();
    }

    this.defaultTags = isFunction(this.opts.defaultTags)
      ? this.opts.defaultTags.call(this, tracer)
      : this.opts.defaultTags;
    if (this.defaultTags) {
      this.defaultTags = flattenTags(this.defaultTags, true);
    }
  }

  /**
   * Stop Trace exporter
   */
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Span is finished.
   */
  spanFinished(span: Span): void {
    this.queue.push(span);

    if (this.queue.length >= this.opts.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush tracing data to NewRelic Zipkin api endpoint
   */
  async flush(): Promise<void> {
    if (!this.queue.length) {
      return;
    }

    const data = this.generateTracingData();
    this.queue.length = 0;

    try {
      const res = await fetch(`${this.opts.baseURL}/trace/v1`, {
        method: 'post',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': this.opts.insertKey,
          'Data-Format': 'newrelic',
          'Data-Format-Version': '1',
        },
      });

      if (res.status >= 400) {
        this.logger.warn(
          `Unable to upload tracing spans to NewRelic. Status: ${res.status} ${res.statusText}`,
        );
      } else {
        this.logger.debug(
          `Tracing spans (${data.length} spans) uploaded to NewRelic. Status: ${res.statusText}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Unable to upload tracing spans to NewRelic. Error:${
          (err as Error).message
        }`,
        err,
      );
    }
  }

  /**
   * Generate tracing data for NewRelic
   */
  generateTracingData(): unknown[] {
    return [
      {
        common: { attributes: this.defaultTags || {} },
        spans: this.queue.map(span => this.makePayload(span)),
      },
    ];
  }

  /**
   * Create NewRelic v1 payload
   */
  makePayload(span: Span): unknown {
    return {
      // Trace & span IDs
      'trace.id': span.traceID,
      id: span.id,
      timestamp: span.startTime,
      attributes: {
        'duration.ms': span.duration,
        name: span.name,
        'parent.id': span.parentID,
        // @ts-expect-error fullName isn't declared on span yet
        'service.name': span.service?.fullName || null,
        ...flattenTags(span.tags, true),
        ...(flattenTags(this.errorToObject(span.error!), true, 'error') || {}),
      },
    };
  }
}
