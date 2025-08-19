// This json-schema folder could be extracted to a shared package
// It doesn't depend on any moleculer specific code.
export type {
  PropertiesSchema,
  JSONSchemaType,
  SomeJSONSchema,
  RequiredMembers,
} from './base-types.js';

export * from './helpers.js';

export * from './constants.js';
