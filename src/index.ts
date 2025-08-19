/**
 * Export everything related to JSON Schema.
 * It includes some helper types and some attributes constants that
 * can be used in schemas.
 */
export {
  type JSONSchemaType,
  type SomeJSONSchema,
  type RequiredMembers,
  type PropertiesSchema,
  DATE_TYPE,
  SCHEMA_REF_NAME,
  OBJECTID_TYPE,
  EMPTY_OBJECT_SCHEMA,
  COERCE_ARRAY_ATTRIBUTE,
  omitFields,
  pickFields,
  addFieldsToSchema,
  optionalFields,
  optionalExceptFields,
  toPartialSchema,
  composeSchemas,
} from './json-schema/index.js';

/**
 * Export everything related to Zod schemas.
 */
export * from './zod/zod-helpers.js';

/**
 * Export OpenAPI types and helpers.
 */
export * from './openapi/index.js';

/**
 * Export everything related to validation in moleculer.
 */
export { AjvValidator } from './validator/index.js';
export { ZodValidator } from './validator/zod-validator.js';
export { AjvExtractor } from './validator/ajv-extractor.js';
export { RefExtractor } from './validator/ref-extractor.js';
export type {
  Transformer,
  Transform,
  TransformLevel,
  TransformMap,
  TransformField,
  ValidationSchema,
} from './validator/types.js';

/**
 * Export moleculer typings and the 2 wrappers `wrapService`
 * and `wrapMixin` that add typings to services.
 */
export * from './types/index.js';

/**
 * Export a way to run a moleculer broker with some defaults.
 * It includes:
 * - A default validator
 * - Disabled internal services
 * - Disabled logger when running tests
 * - A custom ContextFactory that adds a ctx.logger instance (with span.id and trace.id)
 */
export {
  ContextFactory,
  ServiceFactory,
  createServiceBroker,
  getMetadataFromService,
  isServiceSelected,
  type Selector,
} from './service-broker/index.js';

/**
 * Export mixins.
 */
export * from './mixins/index.js';

/**
 * Export middlewares.
 */
export * from './middlewares/index.js';

/**
 * Export logger.
 */
export * from './logger/index.js';

/**
 * Export exporters/reporters for tracing/metrics moleculer features.
 */
export * from './exporters/index.js';

/**
 * TODO: List of things that still need to be added:
 *  - Errors
 *  - API Service
 */
