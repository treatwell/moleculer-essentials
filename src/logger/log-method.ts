import type { LogFn, LoggerOptions } from 'pino';

type LogMethodFn = Exclude<
  Exclude<LoggerOptions['hooks'], undefined>['logMethod'],
  undefined
>;

/**
 * Log method Hook for pino. This function allow logs like `logger.info('str 1', {a: 1}, 'str 2', ...)`
 * to be formatted correctly (every string are concatenated into one and objects are merged in the log).
 */
export function pinoLogMethod(
  args: (string | Error | object)[],
  method: LogFn,
): void {
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

  mergingObject.msg = msg;
  // @ts-expect-error TS only allow one of the 3 method signatures (msg: string, ...args: any[])
  return method.apply(this, [mergingObject]);
}

export function wrapLogMethodWithFilter(
  original: LogMethodFn,
  filter: RegExp,
): LogMethodFn {
  const isMatch = (arg: string | Error | object) => {
    let msg: string | undefined;
    if (arg instanceof Error) {
      msg = arg.message;
    } else if (typeof arg === 'string') {
      msg = arg;
    } else if (arg && 'msg' in arg && typeof arg.msg === 'string') {
      msg = arg.msg;
    }
    return msg ? filter.test(msg) : false;
  };

  return function (args, method, level) {
    if (args.some(isMatch)) {
      return; // skip log
    }
    return original.apply(this, [args, method, level]);
  };
}
