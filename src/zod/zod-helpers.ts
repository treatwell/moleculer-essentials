import { ObjectId } from 'bson';
import { parseISO } from 'date-fns';
import { z, ZodType } from 'zod';
import type { SomeJSONSchema } from '../json-schema/index.js';
import { OpenAPIExtractor } from '../openapi/index.js';
import type { ReferenceObject, SchemaObject } from '../openapi/types.js';

/**
 * Simple recursive function to replace all `$ref` in an object.
 */
function deepRefReplacer(
  obj: unknown,
  extractor: OpenAPIExtractor,
  currentId = '',
): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }
  if ('$ref' in obj && typeof obj.$ref === 'string') {
    let id: string | undefined;
    if (obj.$ref === '#') {
      if (!currentId) {
        throw new Error('Got a recursive ref (#) without a parent id.');
      }
      id = currentId;
    } else if (obj.$ref.startsWith('#/$defs/')) {
      id = obj.$ref.replace('#/$defs/', '');
    }

    if (id) {
      obj.$ref = extractor.refReplacer(id);
    }
  } else {
    // Recursively replace refs in nested objects
    for (const val of Object.values(obj)) {
      deepRefReplacer(val, extractor, currentId);
    }
  }
}

/**
 * Convert a zod schema to a JSON Schema with an OpenAPI spec (for refs).
 *
 * We always take the input version of a Zod schema, before transforms.
 * It means that we don't support inputs not JSON schemas compatible, including dates, objectIds.
 * For this, you should use helpers provided by this package.
 */
export function zodToOpenAPISchema(
  schema: ZodType,
  extractor: OpenAPIExtractor,
): SchemaObject | ReferenceObject {
  const res = z.toJSONSchema(schema, {
    io: 'input',
    unrepresentable: 'any',
    override: ({ zodSchema, jsonSchema }) => {
      // 1. Transform unrepresentable types into json schemas
      const { def } = zodSchema._zod;
      if (def.type === 'date') {
        jsonSchema.type = 'string';
        jsonSchema.format = 'date-time';
      }
      if (def.type === 'custom' && def.fn === isObjectId) {
        jsonSchema.type = 'string';
        jsonSchema.format = 'object-id';
        jsonSchema.pattern = '^[0-9A-Fa-f]{24}$';
      }

      // 2. Throw for remaining unrepresentable types
      if (Object.keys(jsonSchema).length === 0) {
        throw new Error(
          `Zod schema ${def.type} is not representable in OpenAPI.`,
        );
      }

      // 3. Replace id by $id as zod doesn't use $id, but it is
      //    the standard since JSON Schema Draft 4.
      if (jsonSchema.id) {
        jsonSchema.$id = jsonSchema.id;
        delete jsonSchema.id;
      }
    },
  });

  // To have working $refs with zod, we need to:
  // - Rename refs to OpenAPI format (from '#/$defs/<name>' to '#/components/schemas/<name>')
  // - Move from $defs to the OpenAPI format (spec.components.schemas) using the extractor
  deepRefReplacer(res, extractor, res.$id);
  if (res.$defs) {
    for (const [key, val] of Object.entries(res.$defs)) {
      deepRefReplacer(val, extractor, key);
      extractor.onNewRef(key, val as SomeJSONSchema);
    }
    delete res.$defs;
  }

  // Delete $schema field always added by zod
  delete res.$schema;

  // Zod will not extract root level refs when passing a schema
  // (it only does it if you pass the full registry)
  // If we find an id here, we should extract it manually
  if (res.$id) {
    extractor.onNewRef(res.$id, res as SomeJSONSchema);
    return { $ref: extractor.refReplacer(res.$id) };
  }

  return res as SomeJSONSchema;
}

export const zodDate = z
  .transform(val => {
    if (typeof val === 'string') {
      const date = parseISO(val);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
    return val;
  })
  .pipe(z.date());

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
function isObjectId(val: unknown): val is ObjectId {
  return val instanceof ObjectId;
}

export const zodObjectId = z
  .transform(val => {
    // Better use a regex since ObjectId.isValid isn't 100% reliable
    // to test if a string is an object id: ObjectId('babyliss-pro') === true
    if (typeof val === 'string' && OBJECT_ID_PATTERN.test(val)) {
      return new ObjectId(val);
    }
    return val;
  })
  .pipe(z.custom<ObjectId>(isObjectId, { abort: true }))
  .meta({ id: 'ObjectId' });

export function zodCoerceArray<T extends ZodType>(
  element: T,
  params?: Parameters<typeof z.array>[1],
) {
  return z
    .transform(val => (!Array.isArray(val) && val !== undefined ? [val] : val))
    .pipe(z.array(element, params));
}
