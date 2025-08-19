import type { ObjectId } from 'bson';
import type { JSONSchemaType } from './base-types.js';

export const COERCE_ARRAY_ATTRIBUTE = 'x-coerce-array';

export const SCHEMA_REF_NAME = '$id';

export const EMPTY_OBJECT_SCHEMA: JSONSchemaType<Record<string, never>> = {
  type: 'object',
  additionalProperties: true,
  required: [],
  properties: {},
};

export const DATE_TYPE: JSONSchemaType<Date> = {
  type: 'string',
  format: 'date-time',
};

export const OBJECTID_TYPE: JSONSchemaType<ObjectId> = {
  type: 'string',
  pattern: '^[0-9A-Fa-f]{24}$',
  format: 'object-id',
  description: 'ObjectId',
};
