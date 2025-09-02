import { z } from 'zod/v4';
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
    // Change the internal services actions to use Zod validation
    // instead of the default `fastest-validator` schemas
    // @ts-expect-error Moleculer types doesn't support zod validators
    internalServices: {
      $node: {
        actions: {
          list: {
            params: z
              .object({ withServices: z.boolean(), onlyAvailable: z.boolean() })
              .partial(),
          },
          services: {
            params: z
              .object({
                onlyLocal: z.boolean(),
                skipInternal: z.boolean(),
                withActions: z.boolean(),
                withEvents: z.boolean(),
                onlyAvailable: z.boolean(),
                grouping: z.boolean().default(true),
              })
              .partial(),
          },
          actions: {
            params: z
              .object({
                onlyLocal: z.boolean(),
                skipInternal: z.boolean(),
                withEndpoints: z.boolean(),
                onlyAvailable: z.boolean(),
              })
              .partial(),
          },
          events: {
            params: z
              .object({
                onlyLocal: z.boolean(),
                skipInternal: z.boolean(),
                withEndpoints: z.boolean(),
                onlyAvailable: z.boolean(),
              })
              .partial(),
          },
          health: { params: z.object({}) },
          options: { params: z.object({}) },
          metrics: {
            params: z
              .object({
                types: z.union([z.string(), z.array(z.string())]),
                includes: z.union([z.string(), z.array(z.string())]),
                excludes: z.union([z.string(), z.array(z.string())]),
              })
              .partial(),
          },
        },
      },
    },
    ...opts,
  });
}
