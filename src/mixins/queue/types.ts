import { Service } from 'moleculer';

export type QueueMixinOptions = {
  brokerURL:
    | string
    | (<TService extends Service = Service>(svc: TService) => Promise<string>);
};

/**
 * connection is mandatory for BullMQ but is managed by each mixins.
 */
export type WithoutConnection<T> = Omit<T, 'connection'>;
