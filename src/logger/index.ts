import { type Logger, type TransportSingleOptions, pino } from 'pino';
import { hostname } from 'node:os';
import type { LoggerBindings, LoggerConfig } from 'moleculer';

const FILTER_SERVICE_LOGS_REGEX =
  /('[^']*' service is registered\.)|(Service '[^']*' started\.)|('[^']*' finished starting\.)/;

let transport: TransportSingleOptions | undefined;
if (process.env.NODE_ENV !== 'production') {
  transport = {
    target: './pino-pretty-transport.cjs',
    options: {
      colorize: true,
      singleLine: true,
      ignore: [
        'hostname',
        // Hide req and res in logs as it will be included in the pretty message
        // or is not useful in development
        'req',
        'res',
        'responseTime',
        'span\\.id',
      ].join(','),
    },
  };
}

const logger = pino({
  base: {
    hostname: hostname(),
    // Need to set this to allow logs in context of traces
    // Note that this will not work with dotenv loaded environment variables.
    'service.name': process.env.NEWRELIC_APP_NAME,
  },
  transport,
  hooks: {
    /**
     * This function allow logs like `logger.info('str 1', {a: 1}, 'str 2', ...)` to
     * be formatted correctly (every string are concatenated into one and objects are merged in the log).
     */
    logMethod(args: (string | Error | object)[], method) {
      const mergingObject: Record<string, unknown> = {};
      let msg = '';

      for (const arg of args) {
        if (arg instanceof Error) {
          mergingObject.err = arg;
        } else if (typeof arg === 'string') {
          msg += (msg ? ' ' : '') + arg;
        } else if (arg && 'msg' in arg && typeof arg.msg === 'string') {
          msg += (msg ? ' ' : '') + arg.msg;
          Object.assign(mergingObject, arg);
        } else {
          Object.assign(mergingObject, arg);
        }
      }

      if (
        process.env.FILTER_SERVICE_LOGS === 'yes' &&
        FILTER_SERVICE_LOGS_REGEX.test(msg)
      ) {
        return undefined;
      }

      mergingObject.msg = msg;
      // @ts-expect-error TS only allow one of the 3 method signatures (msg: string, ...args: any[])
      return method.apply(this, [mergingObject]);
    },
  },
  redact: {
    paths: [
      // Request headers
      'req.headers.authorization',
      'req.headers["device-useragent"]',
      'req.headers.connection',
      'req.headers["content-type"]',
      'req.headers["accept"]',
      'req.headers["keep-alive"]',
      'req.headers["dnt"]',
      'req.headers["accept-encoding"]',
      'req.headers["accept-language"]',
      'req.headers["sec-fetch-site"]',
      'req.headers["sec-fetch-mode"]',
      'req.headers["sec-fetch-dest"]',
      'req.headers["sec-fetch-user"]',
      'req.headers["sec-ch-ua"]',
      'req.headers["sec-ch-ua-mobile"]',
      'req.headers["upgrade-insecure-requests"]',
      'req.headers["if-none-match"]',
      'req.headers["cookie"]',
      'req.headers.referer',
      // Response headers
      'res.headers.allow',
      'res.headers.vary',
      'res.headers["x-powered-by"]',
      'res.headers["access-control-allow-origin"]',
      'res.headers["content-type"]',
      'res.headers["content-encoding"]',
    ],
    remove: true,
  },
});

export const createLogger = (bindings: Record<string, unknown>): Logger =>
  logger.child(bindings);

export function createLoggerConfig(): LoggerConfig {
  return {
    type: 'Pino',
    options: {
      createLogger: (
        level: string,
        bindings: LoggerBindings & Record<string, unknown>,
      ) =>
        createLogger({
          label: bindings.mod,
          'trace.id': bindings.traceID,
          'span.id': bindings.spanID,
        }),
    },
  };
}

export const defaultLogger = createLogger({ label: 'default' });
