import { type BrokerOptions, ServiceBroker } from 'moleculer';
import { AjvValidator } from '../validator/index.js';
import { ZodValidator } from '../validator/zod-validator.js';
import { ServiceFactory } from './service-factory.js';
import { ContextFactory } from './context-factory.js';
import { CustomServiceBroker } from './service-broker.js';

export function createServiceBroker(opts: BrokerOptions = {}): ServiceBroker {
  return new CustomServiceBroker({
    logger: process.env.NODE_ENV === 'test' ? false : undefined, // TODO Add default logger
    validator: new AjvValidator(
      {
        default: {
          useDefaults: true,
          coerceTypes: true,
          allErrors: true,
          removeAdditional: false,
        },
      },
      'default',
      new ZodValidator(),
    ),
    ServiceFactory,
    ContextFactory,
    internalServices: false,
    ...opts,
  });
}
