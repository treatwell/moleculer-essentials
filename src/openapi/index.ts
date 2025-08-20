import { z } from 'zod/v4';

import type { OperationObject, SchemaObject } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OpenAPIResponses = SchemaObject<NonNullable<any>> | z.ZodType;

export * from './types.js';
export * from './openapi.mixin.js';
export * from './openapi-extractor.js';

export function createOpenAPIResponses(
  model: OpenAPIResponses,
  description: string = '',
): OperationObject {
  const isZodType = model instanceof z.ZodType;
  return {
    responses: {
      '200': {
        description,
        content: {
          'application/json': {
            // @ts-expect-error Moleculer will clone this object using lodash,
            // losing the zod class instance. By using a function, we ensure
            // that clone doesn't break the zod instance
            zodInstance: isZodType ? () => model : undefined,
            schema: isZodType ? undefined : model,
          },
        },
      },
    },
  };
}
