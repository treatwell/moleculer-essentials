import type { TransportSingleOptions } from 'pino';
import { CreateLoggerOptions } from './types.js';

/**
 * Create a pino transport to a pino-pretty wrapper with basic HTTP support.
 */
export function createPinoPrettyTransport(
  opts?: CreateLoggerOptions['prettyOptions'],
): TransportSingleOptions {
  return {
    // Building with pkgroll (rollup) will bundle the file into the root index.js so we keep
    // `logger/` in the path.
    target: './logger/pino-pretty-transport.cjs',
    options: {
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
      ...opts,
    },
  };
}
