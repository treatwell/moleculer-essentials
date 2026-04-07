import type { ActionSchema, Context } from 'moleculer';
import type { OperationObject } from '../openapi/index.js';

/**
 * Redefine RestSchema from API gateway to add type support
 */
export interface CustomRestSchema {
  path?: string;
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
  fullPath?: string;
  basePath?: string;
  type?: 'call' | 'stream' | 'multipart';
}

export interface CustomActionSchema<T = unknown> extends Omit<
  ActionSchema,
  'params' | 'handler'
> {
  // Params validation related fields
  params?: unknown;
  handler?: (ctx: Context<never, never>) => Promise<T> | T;
  disableTransforms?: boolean;

  // OpenAPI related fields
  openAPINames?: string[] | null;
  openapi?: OperationObject;
  bodySchemaRefName?: string;

  // API Gateway
  rest?: CustomRestSchema | CustomRestSchema[] | string | string[] | null;
}

export type Alias = {
  actionName: string;
  path: string;
  fullPath: string;
  methods: string;
  routePath: string;
  action: CustomActionSchema;
};
