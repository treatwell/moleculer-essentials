import { defaultsDeep, isFunction } from 'lodash-es';
import {
  MetricReporters,
  type MetricRegistry,
  type LoggerInstance,
  type GaugeMetricSnapshot,
  type HistogramMetricSnapshot,
  type MetricReporterOptions,
} from 'moleculer';
import { flattenTags } from './utils.js';

type GaugeType = {
  type: 'gauge';
  value: number;
};
type CountType = {
  type: 'count';
  'interval.ms': number;
  value: number;
};
type SummaryType = {
  type: 'summary';
  'interval.ms': number;
  value: { count: number; sum: number; min: number; max: number };
};

type MetricEntry = {
  name: string;
  timestamp: number;
  attributes: Record<string, string | number | boolean>;
} & (GaugeType | CountType | SummaryType);

type DefaultTags =
  | Record<string, unknown>
  | ((registry: MetricRegistry) => Record<string, unknown>);

type NewrelicMetricsOptions = MetricReporterOptions & {
  /**
   * Base URL for NewRelic server.
   */
  baseURL?: string;

  /**
   * NewRelic Insert API Key
   */
  insertKey?: string;

  /**
   * Batch send time interval in seconds.
   */
  interval?: number;

  /**
   * Default tags to be added to all metrics.
   */
  defaultTags?: DefaultTags;
};

/**
 * NewRelic metrics reporter.
 *
 * NewRelic API: https://docs.newrelic.com/docs/data-apis/understand-data/metric-data/metric-data-type/
 */
export class NewrelicMetricsReporter extends MetricReporters.Base {
  // Those fields are not declared on the Base class.
  public registry!: MetricRegistry;

  public logger!: LoggerInstance;

  private timer: NodeJS.Timeout | null = null;

  private defaultTags: DefaultTags = {};

  constructor(opts: NewrelicMetricsOptions) {
    super(opts);

    this.opts = defaultsDeep(this.opts, {
      baseURL:
        process.env.NEW_RELIC_METRICS_API_URL ||
        'https://metric-api.newrelic.com',
      insertKey: '',
      interval: 10,
    });
  }

  /**
   * Initialize Trace Exporter.
   */
  init(registry: MetricRegistry): void {
    super.init(registry);

    if (this.opts.interval > 0) {
      this.timer = setInterval(() => this.flush(), this.opts.interval * 1000);
      this.timer.unref();
    }

    const defaultTags = isFunction(this.opts.defaultTags)
      ? this.opts.defaultTags.call(this, registry)
      : this.opts.defaultTags;

    if (defaultTags) {
      this.defaultTags = flattenTags(defaultTags, true);
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
   * Flush tracing data to NewRelic Zipkin api endpoint
   */
  async flush(): Promise<void> {
    const data = this.generateMetricsPayload();

    if (!this.opts.insertKey) {
      this.logger.warn(
        `Unable to upload metrics to NewRelic. No insertKey provided.`,
      );
      return;
    }

    try {
      const res = await fetch(`${this.opts.baseURL}/metric/v1`, {
        method: 'post',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': this.opts.insertKey,
        },
      });

      if (res.status >= 400) {
        this.logger.warn(
          `Unable to upload metrics to NewRelic. Status: ${res.status} ${res.statusText}`,
        );
      } else {
        this.logger.debug(
          `Tracing metrics uploaded to NewRelic. Status: ${res.statusText}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Unable to upload metrics to NewRelic. Error:${(err as Error).message}`,
        err,
      );
    }
  }

  /**
   * Generate metrics data for NewRelic
   */
  generateMetricsPayload(): unknown[] {
    const metrics: MetricEntry[] = [];

    this.registry.store.forEach(metric => {
      // Filtering
      if (!this.matchMetricName(metric.name)) {
        return;
      }
      // Skip datetime metrics (register too much labels)
      if (metric.name.startsWith('os.datetime')) {
        return;
      }
      const snapshot = metric.snapshot();
      if (!snapshot.length) {
        return;
      }

      switch (metric.type) {
        case 'counter':
        case 'gauge':
          snapshot.forEach(item => {
            const { value, timestamp, labels } = item as GaugeMetricSnapshot;
            metrics.push({
              name: metric.name,
              attributes: labels,
              type: 'gauge',
              timestamp,
              value,
            });
          });
          break;
        case 'histogram':
          snapshot.forEach(item => {
            const {
              timestamp,
              labels,
              count,
              min,
              max,
              sum,
              buckets,
              quantiles,
            } = item as HistogramMetricSnapshot;
            metrics.push({
              name: metric.name,
              type: 'summary',
              attributes: labels,
              timestamp,
              value: { count, sum, min: min || 0, max: max || 0 },
              'interval.ms': this.opts.interval * 1000,
            });

            if (buckets) {
              Object.entries(buckets).forEach(([key, val]) => {
                metrics.push({
                  name: `${metric.name}.${key}`,
                  type: 'gauge',
                  attributes: labels,
                  timestamp,
                  value: val,
                });
              });
            }
            if (quantiles) {
              Object.entries(quantiles).forEach(([key, val]) => {
                metrics.push({
                  name: `${metric.name}.q.${key}`,
                  type: 'gauge',
                  attributes: labels,
                  timestamp,
                  value: val,
                });
              });
            }
          });
          break;
        case 'info':
        default:
          break;
      }
    });

    return [
      {
        common: { attributes: this.defaultTags || {} },
        metrics,
      },
    ];
  }
}
