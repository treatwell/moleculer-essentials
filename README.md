# moleculer-essentials

[![](https://cdn1.treatwell.net/images/view/v2.i1756348.w200.h50.x4965194E.jpeg)](https://treatwell.com/tech)

[![npm](https://img.shields.io/npm/v/@treatwell/moleculer-essentials?style=flat-square)](https://www.npmjs.com/package/@treatwell/moleculer-essentials)

<!-- TOC -->

- [Purpose](#purpose)
- [Features](#features)
- [Installation](#installation)
- [Companion Packages](#companion-packages)
- [Usage](#usage)
  - [Basic Example](#basic-example)
- [Mixins](#mixins)
- [License](#license)
<!-- TOC -->

## Purpose

`@treatwell/moleculer-essentials` is a collection of essential utilities and helpers for building
and managing microservices using the Moleculer framework. It aims to have a better TS support and add commonly use mixins
and middlewares.

## Features

- **TypeScript Support**: By using the `wrapService` (and `wrapMixin`) functions, TS can automatically infer methods signatures, settings, etc.
- **Common Mixins**: Includes MongoDB, Redis, Redlock, BullMQ, and more mixins commonly used in backend applications.
- **Zod Validation**: Integrates Zod for schema validation in service actions. Also supports (legacy) Ajv validation.
- **OpenAPI Integration**: Easily provide a OpenAPI (Swagger) documentation for your services.
- And more...

## Installation

You need to add both `moleculer-essentials` and `moleculer` in your dependencies:

```bash
  yarn add @treatwell/moleculer-essentials moleculer
```

## Companion Packages

To complete the TS support and improve the developer experience, we also provide the following companion packages:

- [@treatwell/moleculer-call-wrapper](https://github.com/treatwell/moleculer-call-wrapper): A dev dependency to generate a fully typed `call` function that replaces the default `ctx.call` in Moleculer services.
- [@treatwell/eslint-plugin-moleculer](https://github.com/treatwell/eslint-plugin-moleculer): An ESLint plugin to work with this package to improve TS support and prevent some common mistakes.

## Usage

### Basic Example

```ts
// src/index.ts
import fg from 'fast-glob';
import {
  HealthCheckMiddleware,
  createLoggerConfig,
  createServiceBroker,
  defaultLogger,
  ZodValidator,
} from '@treatwell/moleculer-essentials';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

async function run() {
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
}

run().catch(err => {
  defaultLogger.error('Error while starting server', { err });
  process.exit(1);
});
```

```ts
// src/services/sum.service.ts
import { wrapService } from '@treatwell/moleculer-essentials';
import { z } from 'zod/v4';
import { Context } from 'moleculer';

const AddParamsSchema = z.object({ a: z.number(), b: z.number() });

export default wrapService({
  name: `sum`,
  actions: {
    add: {
      params: AddParamsSchema,
      async handler(
        ctx: Context<z.infer<typeof AddParamsSchema>>,
      ): Promise<number> {
        return ctx.params.a + ctx.params.b;
      },
    },
  },
});
```

### Mixins

Except for the `OpenAPIMixin`, mixins are **not** exported directly from `@treatwell/moleculer-essentials`.
Each mixin is available in its own namespace. For example, to use the `RedisMixin`, you first need to install the `ioredis`
package:

```bash
yarn add ioredis
```

Then, you can import and use the mixin like this:

```ts
import { wrapService } from '@treatwell/moleculer-essentials';
import { RedisMixin } from '@treatwell/moleculer-essentials/redis';
import { Context } from 'moleculer';

export default wrapService({
  name: 'my-service',
  mixins: [RedisMixin({ host: 'localhost' })],

  actions: {
    myAction: {
      async handler(ctx: Context): Promise<string | undefined> {
        return this.getRedis().get('key');
      },
    },
  },
});
```

> Moleculer-essentials doesn't provide the dependencies for the mixins, but only declares them as optional `peerDependencies`.
> By using a specific namespace for each mixin, you can install only the dependencies you need and use.

### Documentation

The documentation isn't done yet, but you can check the [source code](./src/) to see what is available.

### ServiceSchema & ActionSchema overriding

By using TS declaration [merging feature](https://www.typescriptlang.org/docs/handbook/declaration-merging.html),
you can augment the default services and action schemas to support additional features:

```ts
declare module '@treatwell/moleculer-essentials' {
  export interface CustomActionSchema {
    myCustomFeature?: number;
  }
}

export default wrapService({
  name: 'my-service',
  actions: {
    myAction: {
      myCustomFeature: 'not_a_number', // TS2322: Type string is not assignable to type number
    },
  },
});
```

#### Moleculer channels example

For example, adding support for the [`@moleculer/channels`](https://github.com/moleculerjs/moleculer-channels) package
can be achieved like this:

```ts
import { CustomActionSchema, InternalObjectServiceThis } from '@treatwell/moleculer-essentials';
import { Context } from 'moleculer';

declare module '@treatwell/moleculer-essentials' {
  type DeadLetteringOptions = {
    /**
     * Enable dead-letter-queue
     */
    enabled: boolean;
    /**
     * Name of the dead-letter queue
     */
    queueName: string;
    /**
     * Name of the dead-letter exchange (only for AMQP adapter)
     */
    exchangeName: string;
    /**
     * Options for the dead-letter exchange (only for AMQP adapter)
     */
    exchangeOptions: unknown;
    /**
     * Options for the dead-letter queue (only for AMQP adapter)
     */
    queueOptions: unknown;
  };

  type MoleculerChannel = {
    /**
     * Channel/Queue/Stream name
     * @default record name (with adapter prefix)
     */
    name?: string;
    /**
     * Consumer group
     * @default Service name
     */
    group?: string;

    /**
     * Use moleculer context instead of direct payload.
     * To have typing enabled, should always be true.
     *
     * @default uses Middleware `context` option (should be set to true)
     */
    context?: boolean;

    /**
     * Maximum number of messages that can be processed simultaneously
     *
     * @default adapter's maxInFlight
     */
    maxInFlight?: number | null;

    /**
     * Maximum number of retries before sending the message to dead-letter-queue.
     *
     * @default adapter's maxRetries (default: 3)
     */
    maxRetries?: number | null;

    /**
     * Dead-letter-queue options
     *
     * @default adapter's deadLettering (default: not enabled)
     */
    deadLettering?: DeadLetteringOptions | null;

    /**
     * Mandatory handler function (can be provided through mixins)
     */
    handler?: (ctx: Context<never, never>, raw: never) => Promise<unknown> | unknown;
  };

  export interface CustomServiceSchema<Settings, Methods, Mixins> {
    channels?: Record<string, InternalObjectServiceThis<MoleculerChannel, Settings, Methods, Mixins>>;
  }
}


export default wrapService({
  name: 'my-service',
  channels: {
    'payment.processed': {
      group: "other",
      async handler(ctx: Context<{...}>) {
        ctx.logger.info('Processing payment', ctx.params);
      },
    },
  },
});
```

## License

[MIT](https://choosealicense.com/licenses/mit/)
