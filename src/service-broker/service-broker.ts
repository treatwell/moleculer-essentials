import Moleculer, { ServiceBroker } from 'moleculer';

/**
 * LoggerFactory only call get and set method.
 * https://github.com/moleculerjs/moleculer/blob/master/src/logger-factory.js
 */
const NOOP_CACHE = {
  get: () => undefined,
  set: () => undefined,
};

/**
 * Override the default ServiceBroker to:
 * - Change the getLogger method to disable cache on the loggerFactory
 */
export class CustomServiceBroker extends ServiceBroker {
  /**
   * By replacing the cache property of the loggerFactory, we can disable the cache.
   * This is because caching loggers can lead to OOM because of
   * the large number of child loggers created (one per span).
   */
  override getLogger(
    module: string,
    props?: Moleculer.GenericObject,
  ): Moleculer.LoggerInstance {
    this.loggerFactory.cache = NOOP_CACHE;
    return super.getLogger(module, props);
  }
}
