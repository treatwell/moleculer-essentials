import { describe, expect, it } from 'vitest';
import { Ajv2019 as Ajv } from 'ajv/dist/2019.js';
import { AjvExtractor } from '../ajv-extractor.js';
import { JSONSchemaType, SCHEMA_REF_NAME } from '../../json-schema/index.js';

describe('Test ajv transformer', () => {
  it('should validate extracted schemas', async () => {
    const ajv = new Ajv();
    const extractor = new AjvExtractor(ajv);
    const schema: JSONSchemaType<{ a: string }> = {
      type: 'object',
      additionalProperties: false,
      required: [],
      properties: {
        a: { type: 'string', [SCHEMA_REF_NAME]: 'MyString', minLength: 5 },
      },
    };

    const res = extractor.extract(schema);
    const validate = ajv.compile(res);

    expect(validate({ a: 'hi' })).toBe(false);
    expect(validate({ a: 'hello' })).toBe(true);
  });

  it('should handle multiple deep refs', async () => {
    const ajv = new Ajv();
    const extractor = new AjvExtractor(ajv);
    const schema: JSONSchemaType<{ a: { b: { c: string } } }> = {
      type: 'object',
      additionalProperties: false,
      required: [],
      properties: {
        a: {
          type: 'object',
          additionalProperties: false,
          required: [],
          [SCHEMA_REF_NAME]: 'SchemaA',
          properties: {
            b: {
              type: 'object',
              additionalProperties: false,
              required: [],
              properties: {
                c: {
                  type: 'string',
                  [SCHEMA_REF_NAME]: 'SchemaC',
                  minLength: 5,
                },
              },
            },
          },
        },
      },
    };

    const res = extractor.extract(schema);
    const validate = ajv.compile(res);

    expect(validate({ a: { b: { c: 'hi' } } })).toBe(false);
    expect(validate({ a: { b: { c: 'hello' } } })).toBe(true);
  });

  it('should handle self-refs', async () => {
    const ajv = new Ajv();
    const extractor = new AjvExtractor(ajv);

    type A = { a?: A };
    const schema: JSONSchemaType<A> = {
      [SCHEMA_REF_NAME]: 'SchemaA',
      type: 'object',
      additionalProperties: false,
      required: [],
      properties: { a: { $ref: '#' } },
    };

    const res = extractor.extract(schema);
    const validate = ajv.compile(res);

    expect(validate({ a: { a: { a: 'not-a' } } })).toBe(false);
    expect(validate({ a: { a: { a: {} } } })).toBe(true);
  });

  it('should handle deep self-refs', async () => {
    const ajv = new Ajv();
    const extractor = new AjvExtractor(ajv);

    type A = { a: { b: { c?: A } } };
    const schema: JSONSchemaType<A> = {
      [SCHEMA_REF_NAME]: 'SchemaA',
      type: 'object',
      additionalProperties: false,
      required: ['a'],
      properties: {
        a: {
          type: 'object',
          additionalProperties: false,
          required: [],
          properties: {
            b: {
              type: 'object',
              additionalProperties: false,
              required: [],
              properties: { c: { $ref: '#' } },
            },
          },
        },
      },
    };

    const res = extractor.extract(schema);
    const validate = ajv.compile(res);

    expect(validate({ a: { b: { c: {} } } })).toBe(false);
    expect(validate({ a: { b: { c: { a: { b: {} } } } } })).toBe(true);
  });
});
