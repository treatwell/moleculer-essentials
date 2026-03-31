import type { ActionSchema, Context } from 'moleculer';
import type { OperationObject } from '../openapi/index.js';

export interface CustomActionSchema<T = unknown> extends Omit<
  ActionSchema,
  'params' | 'handler'
> {
  // Params validation related fields
  // JSONSchemaType doesn't work well when the type is unknown.
  // There is the SomeJSONSchema type that exists but isn't working with optional props.
  // For now I set it to `unknown` but it would be nice to replace it as soon as a correct solution
  // exists.
  params?: unknown;
  handler?: (ctx: Context<never, never>) => Promise<T> | T;
  disableTransforms?: boolean;

  // OpenAPI related fields
  openAPINames?: string[] | null;
  openapi?: OperationObject;
  bodySchemaRefName?: string;

  // API Gateway
  rest?: string | string[];
}

export type Alias = {
  actionName: string;
  path: string;
  fullPath: string;
  methods: string;
  routePath: string;
  action: CustomActionSchema;
};
