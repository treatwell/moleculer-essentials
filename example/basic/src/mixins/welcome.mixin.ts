import { wrapMixin } from '@treatwell/moleculer-essentials';

export type WelcomeMixinOptions = {
  message: string;
};

/**
 * Example mixin that log message during lifecycle events
 */
export function WelcomeMixin({ message }: WelcomeMixinOptions) {
  return wrapMixin({
    created() {
      this.logger.info(`Service created, ${message}`);
    },

    started() {
      this.logger.info(`Starting service, ${message}`);
    },

    stopped() {
      this.logger.info(`Stopping service, ${message}`);
    },
  });
}
