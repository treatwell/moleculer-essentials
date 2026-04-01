import { join } from 'node:path';
import fg from 'fast-glob';
import {
  createLoggerConfig,
  createServiceBroker,
  ZodValidator,
} from '@treatwell/moleculer-essentials';
import { config } from 'dotenv';
import { logger } from './logger.js';

async function run() {
  config();

  // Create Service Broker
  const broker = createServiceBroker({
    validator: new ZodValidator(),
    logger: createLoggerConfig(),
  });

  // -> Filter out service to launch
  const entries = await fg('**/*.service.{ts,js}', {
    cwd: join(import.meta.dirname, 'services'),
    absolute: true,
  });

  const services = entries.map(f => broker.loadService(f));

  if (process.env.MOLECULER_CALL_WRAPPER === 'yes') {
    import('@treatwell/moleculer-call-wrapper')
      .then(async ({ createWrapperCall }) =>
        createWrapperCall('./src/call.ts', services, entries, []),
      )
      .catch(err => {
        broker.logger.error('Error while creating call wrapper', err);
      });
  }

  await broker.start();

  broker.logger.info(
    `You can now test published endpoints from here: http://localhost:${process.env.PORT}/openapi/ui`,
  );
}

run().catch(err => {
  logger.error('Error while starting server', { err });
  process.exit(1);
});
