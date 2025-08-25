import { omit, pick } from 'lodash-es';
import type { JSONSchemaType, SomeJSONSchema } from './base-types.js';
import { SCHEMA_REF_NAME } from './constants.js';

export function omitFields<
  T extends Record<string, unknown>,
  F extends keyof T,
>(
  schema: JSONSchemaType<T>,
  fields: F[],
  refName?: string,
): JSONSchemaType<Omit<T, F>> {
  if (schema.anyOf || schema.allOf || schema.oneOf) {
    return <JSONSchemaType<Omit<T, F>>>{
      ...schema!,
      [SCHEMA_REF_NAME]: refName,
      anyOf: schema.anyOf?.map((s: JSONSchemaType<unknown>) =>
        omitFields(s, fields as string[]),
      ),
      allOf: schema.allOf?.map((s: JSONSchemaType<unknown>) =>
        omitFields(s, fields as string[]),
      ),
      oneOf: schema.oneOf?.map((s: JSONSchemaType<unknown>) =>
        omitFields(s, fields as string[]),
      ),
    };
  }

  return <JSONSchemaType<Omit<T, F>>>{
    ...schema!,
    [SCHEMA_REF_NAME]: refName,
    required: schema.required.filter((f: F) => !fields.includes(f)),
    properties: omit(schema.properties, fields),
  };
}

export function pickFields<
  T extends Record<string, unknown>,
  F extends keyof T,
>(
  schema: JSONSchemaType<T>,
  fields: F[],
  refName?: string,
): JSONSchemaType<Pick<T, F>> {
  if (schema.anyOf || schema.allOf || schema.oneOf) {
    return <JSONSchemaType<Pick<T, F>>>{
      ...schema!,
      [SCHEMA_REF_NAME]: refName,
      anyOf: schema.anyOf?.map((s: JSONSchemaType<unknown>) =>
        pickFields(s, fields as string[]),
      ),
      allOf: schema.allOf?.map((s: JSONSchemaType<unknown>) =>
        pickFields(s, fields as string[]),
      ),
      oneOf: schema.oneOf?.map((s: JSONSchemaType<unknown>) =>
        pickFields(s, fields as string[]),
      ),
    };
  }

  return <JSONSchemaType<Pick<T, F>>>{
    ...schema!,
    [SCHEMA_REF_NAME]: refName,
    required: schema.required.filter((f: F) => fields.includes(f)),
    properties: pick(schema.properties, fields),
  };
}

export function optionalExceptFields<
  T extends Record<string, unknown>,
  F extends keyof T,
>(
  schema: JSONSchemaType<T>,
  fields: F[],
  refName?: string,
): JSONSchemaType<Partial<Omit<T, F>> & Pick<T, F>> {
  if (schema.anyOf || schema.allOf || schema.oneOf) {
    return <JSONSchemaType<Partial<Omit<T, F>> & Pick<T, F>>>{
      ...schema!,
      [SCHEMA_REF_NAME]: refName,
      anyOf: schema.anyOf?.map((s: JSONSchemaType<unknown>) =>
        optionalExceptFields(s, fields as string[]),
      ),
      allOf: schema.allOf?.map((s: JSONSchemaType<unknown>) =>
        optionalExceptFields(s, fields as string[]),
      ),
      oneOf: schema.oneOf?.map((s: JSONSchemaType<unknown>) =>
        optionalExceptFields(s, fields as string[]),
      ),
    };
  }

  return <JSONSchemaType<Partial<Omit<T, F>> & Pick<T, F>>>{
    ...schema!,
    [SCHEMA_REF_NAME]: refName,
    required: schema.required.filter((f: F) => fields.includes(f)),
  };
}

export function optionalFields<
  T extends Record<string, unknown>,
  F extends keyof T,
>(
  schema: JSONSchemaType<T>,
  fields: F[],
  refName?: string,
): JSONSchemaType<Omit<T, F> & Partial<Pick<T, F>>> {
  if (schema.anyOf || schema.allOf || schema.oneOf) {
    return <JSONSchemaType<Omit<T, F> & Partial<Pick<T, F>>>>{
      ...schema!,
      [SCHEMA_REF_NAME]: refName,
      anyOf: schema.anyOf?.map((s: JSONSchemaType<unknown>) =>
        optionalFields(s, fields as string[]),
      ),
      allOf: schema.allOf?.map((s: JSONSchemaType<unknown>) =>
        optionalFields(s, fields as string[]),
      ),
      oneOf: schema.oneOf?.map((s: JSONSchemaType<unknown>) =>
        optionalFields(s, fields as string[]),
      ),
    };
  }

  return <JSONSchemaType<Omit<T, F> & Partial<Pick<T, F>>>>{
    ...schema!,
    [SCHEMA_REF_NAME]: refName,
    required: schema.required.filter((f: F) => !fields.includes(f)),
  };
}

export function toPartialSchema<T extends Record<string, unknown>>(
  schema: JSONSchemaType<T>,
  refName?: string,
): JSONSchemaType<Partial<T>, true> {
  if (schema.anyOf || schema.allOf || schema.oneOf) {
    return <JSONSchemaType<Partial<T>, true>>{
      ...schema!,
      [SCHEMA_REF_NAME]: refName,
      anyOf: schema.anyOf?.map((s: JSONSchemaType<unknown>) =>
        toPartialSchema(s),
      ),
      allOf: schema.allOf?.map((s: JSONSchemaType<unknown>) =>
        toPartialSchema(s),
      ),
      oneOf: schema.oneOf?.map((s: JSONSchemaType<unknown>) =>
        toPartialSchema(s),
      ),
    };
  }
  return <JSONSchemaType<Partial<T>, true>>{
    ...schema!,
    [SCHEMA_REF_NAME]: refName,
    required: [],
  };
}

export function addFieldsToSchema<
  T extends Record<string, unknown>,
  F extends Record<string, SomeJSONSchema>,
>(
  schema: JSONSchemaType<T>,
  newFields: F,
  refName?: string,
): JSONSchemaType<T & F> {
  return <JSONSchemaType<T & F>>{
    ...schema!,
    [SCHEMA_REF_NAME]: refName,
    properties: { ...schema.properties, ...newFields },
  };
}

export function composeSchemas<
  T extends Record<string, unknown>,
  U extends Record<string, unknown>,
>(
  schemaRefName: string | null,
  schema1: JSONSchemaType<T>,
  schema2: JSONSchemaType<U>,
): JSONSchemaType<T & U>;
export function composeSchemas<
  T extends Record<string, unknown>,
  U extends Record<string, unknown>,
  V extends Record<string, unknown>,
>(
  schemaRefName: string | null,
  schema1: JSONSchemaType<T>,
  schema2: JSONSchemaType<U>,
  schema3: JSONSchemaType<V>,
): JSONSchemaType<T & U & V>;
export function composeSchemas<
  T extends Record<string, unknown>,
  U extends Record<string, unknown>,
  V extends Record<string, unknown>,
  W extends Record<string, unknown>,
>(
  schemaRefName: string | null,
  schema1: JSONSchemaType<T>,
  schema2: JSONSchemaType<U>,
  schema3: JSONSchemaType<V>,
  schema4: JSONSchemaType<W>,
): JSONSchemaType<T & U & V & W>;
export function composeSchemas(
  schemaRefName: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...schemas: JSONSchemaType<any>[]
) {
  return {
    [SCHEMA_REF_NAME]: schemaRefName ?? undefined,
    type: 'object',
    required: [],
    unevaluatedProperties: false,
    allOf: schemas,
  };
}
