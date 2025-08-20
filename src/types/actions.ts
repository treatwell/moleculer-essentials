import type {
  ActionCacheOptions,
  ActionHooks,
  ActionVisibility,
  BrokerCircuitBreakerOptions,
  BulkheadOptions,
  Context,
  FallbackHandler,
  RestSchema,
  RetryPolicyOptions,
  Service,
  TracingActionOptions,
} from 'moleculer';
import type { OperationObject } from '../openapi/index.js';

export interface CustomActionSchema<T = unknown> {
  // Copied from moleculer -> ActionSchema
  name?: string;
  rest?: RestSchema | RestSchema[] | string | string[];
  visibility?: ActionVisibility;
  service?: Service;
  cache?: boolean | ActionCacheOptions;
  handler?: (ctx: Context<never, never>) => Promise<T> | T;
  tracing?: boolean | TracingActionOptions;
  bulkhead?: BulkheadOptions;
  circuitBreaker?: BrokerCircuitBreakerOptions;
  retryPolicy?: RetryPolicyOptions;
  fallback?: string | FallbackHandler;
  hooks?: ActionHooks;

  // Params validation related fields
  // JSONSchemaType doesn't work well when the type is unknown.
  // There is the SomeJSONSchema type that exists but isn't working with optional props.
  // For now I set it to `unknown` but it would be nice to replace it as soon as a correct solution
  // exists.
  params?: unknown;
  disableTransforms?: boolean;

  // Rate limiter related fields
  rateLimiter?: string;
  // Specify if it should consume both the custom rateLimiter
  // AND the custom rateLimiter. By default, to `true`.
  rateLimiterCountTowardDefault?: boolean;

  // OpenAPI related fields
  openAPINames?: string[] | null;
  openapi?: OperationObject;
  bodySchemaRefName?: string;
}

export type Alias = {
  actionName: string;
  path: string;
  fullPath: string;
  methods: string;
  routePath: string;
  action: CustomActionSchema;
};
