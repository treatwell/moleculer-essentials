import type { Logger, LoggerOptions } from 'pino';
import type { PrettyOptions } from 'pino-pretty';

export type CreateLoggerOptions = LoggerOptions & {
  /**
   * Allow filtering messages, should only be used during development.
   */
  filter?: RegExp;

  /**
   * Options related to the included prettifier (pino-pretty).
   */
  prettyOptions?: {
    /**
     * Enable/Disable the prettifier transport.
     * If transport is specified, the default prettifier will be disabled.
     *
     * @default process.stdout.isTTY
     */
    enabled?: boolean;

    /**
     * Options to be forwarded to pino-pretty.
     */
    options?: PrettyOptions;
  };
};

export type MoleculerLoggerConfigOptions = {
  /**
   * Pino logger instance to use.
   *
   * @default createLogger()
   */
  logger?: Logger;

  /**
   * Name of the field added for context logging. `false` disable the field
   * @default 'trace.id'
   */
  traceIdField?: string | false;

  /**
   * Name of the field added for context logging. `false` disable the field
   * @default 'span.id'
   */
  spanIdField?: string | false;
};

/**
 * Augment pino to something closer to what Moleculer is using.
 */
declare module 'pino' {
  interface LogFn {
    (msg: string, ...args: (Error | object)[]): void;
  }
}
