import { pino, type Logger, type LoggerOptions } from 'pino';
import { hostname } from 'node:os';
import type { LoggerConfig } from 'moleculer';
import type {
  CreateLoggerOptions,
  MoleculerLoggerConfigOptions,
} from './types.js';
import { createPinoPrettyTransport } from './pino-pretty-transport-config.js';
import { pinoLogMethod, wrapLogMethodWithFilter } from './log-method.js';

// Copied from moleculer as v0.15 doesn't export it
type LoggerBindings = {
  nodeID: string;
  ns: string;
  mod: string;
  svc?: string;
  ver?: string;
};

const DEFAULT_REDACT_PATHS = [
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
];

/**
 * Create a Pino logger with multiple customization by default (can be overridden):
 * - A more open `logMethod` function that allows mixed string/object arguments
 * - Add hostname as base prop
 * - Enable pino-pretty on TTY terminals (with some basic http support)
 * - Some default redaction of paths related to req&res props
 */
export function createLogger(opts: CreateLoggerOptions = {}): Logger {
  const { prettyOptions, filter, ...pinoOpts } = opts;

  let transport: LoggerOptions['transport'] = undefined;
  if ('transport' in opts) {
    transport = opts.transport;
  } else if (prettyOptions?.enabled ?? process.stdout.isTTY) {
    transport = createPinoPrettyTransport(prettyOptions);
  }

  const redact: LoggerOptions['redact'] = {
    paths: DEFAULT_REDACT_PATHS,
    remove: true,
  };
  if (Array.isArray(opts.redact)) {
    redact.paths = opts.redact;
  } else if (opts.redact) {
    Object.assign(redact, opts.redact);
  }

  return pino({
    ...pinoOpts,
    transport,
    base: { hostname: hostname(), ...pinoOpts.base },
    hooks: {
      logMethod: filter
        ? wrapLogMethodWithFilter(pinoLogMethod, filter)
        : pinoLogMethod,
      ...pinoOpts.hooks,
    },
    redact,
  });
}

/**
 * Create moleculer logger config.
 * This returns a Pino config with a couple of customization:
 * - Trace ID and Span ID is automatically added to the ctx.logger (only with this package's ContextFactory)
 */
export function createLoggerConfig(
  opts: MoleculerLoggerConfigOptions = {},
): LoggerConfig {
  const {
    traceIdField = 'trace.id',
    spanIdField = 'span.id',
    logger = createLogger(),
  } = opts;

  return {
    type: 'Pino',
    options: {
      createLogger: (
        level: string,
        bindings: LoggerBindings & Record<string, unknown>,
      ) => {
        const childBindings: Record<string, unknown> = { label: bindings.mod };
        if (traceIdField !== false) {
          childBindings[traceIdField] = bindings.traceID;
        }
        if (spanIdField !== false) {
          childBindings[spanIdField] = bindings.spanID;
        }

        return logger.child(childBindings, { level });
      },
    },
  };
}
