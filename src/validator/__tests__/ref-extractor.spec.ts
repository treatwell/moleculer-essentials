import { describe, expect, it } from 'vitest';
import { RefExtractor } from '../ref-extractor.js';
import {
  JSONSchemaType,
  SCHEMA_REF_NAME,
  SomeJSONSchema,
} from '../../json-schema/index.js';

describe('Test ref transformer', () => {
  describe('extractDeepSchemas', () => {
    const INITIAL_REF = 'my-test/MySchema';

    class TestExtractor extends RefExtractor {
      registered: Map<string, SomeJSONSchema> = new Map();

      protected onNewRef(originalRef: string, schema: SomeJSONSchema): void {
        this.registered.set(originalRef, schema);
      }

      protected refReplacer(ref: string): string {
        return `my-test/${ref}`;
      }

      get(name: string): SomeJSONSchema | undefined {
        return this.registered.get(name);
      }
    }

    it('should extract a simple schema', async () => {
      const extractor = new TestExtractor();
      const schema: JSONSchemaType<{ a: string }> = {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          a: { type: 'string', [SCHEMA_REF_NAME]: 'MyString', minLength: 5 },
        },
      };

      const res = extractor.extract(schema, INITIAL_REF);

      expect(res).toHaveProperty('properties.a.$ref', 'my-test/MyString');
      expect(extractor.get('MyString')).toEqual({
        type: 'string',
        minLength: 5,
      });
    });

    it('should extract a simple schema (nullable)', async () => {
      const extractor = new TestExtractor();
      const schema: JSONSchemaType<{ a: string | null }> = {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          a: {
            type: 'string',
            [SCHEMA_REF_NAME]: 'MyString',
            minLength: 5,
            nullable: true,
          },
        },
      };
      const res = extractor.extract(schema, INITIAL_REF);

      expect(res).toHaveProperty('properties.a.oneOf', [
        { $ref: 'my-test/MyString' },
        { type: 'null' },
      ]);
      expect(extractor.get('MyString')).toEqual({
        type: 'string',
        minLength: 5,
      });
    });

    it('should not mutate the schema', async () => {
      const extractor = new TestExtractor();
      const schema: JSONSchemaType<{ a: string }> = {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          a: { type: 'string', [SCHEMA_REF_NAME]: 'MyString', minLength: 5 },
        },
      };

      extractor.extract(schema, INITIAL_REF);

      expect(schema.properties?.a).toEqual({
        type: 'string',
        [SCHEMA_REF_NAME]: 'MyString',
        minLength: 5,
      });
    });

    it('should not mutate the schema (nullable)', async () => {
      const extractor = new TestExtractor();
      const schema: JSONSchemaType<{ a: string }> = {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          a: {
            type: 'string',
            [SCHEMA_REF_NAME]: 'MyString',
            minLength: 5,
            nullable: true,
          },
        },
      };

      extractor.extract(schema, INITIAL_REF);
      expect(schema.properties?.a).toEqual({
        type: 'string',
        [SCHEMA_REF_NAME]: 'MyString',
        minLength: 5,
        nullable: true,
      });
    });

    it('should handle multiple deep refs', async () => {
      const extractor = new TestExtractor();
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

      const res = extractor.extract(schema, INITIAL_REF);
      expect(res?.properties.a.$ref).toEqual('my-test/SchemaA');
      expect(res?.properties.a.properties).toBeUndefined();
      expect(extractor.get('SchemaA')).toEqual({
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          b: {
            type: 'object',
            additionalProperties: false,
            required: [],
            properties: { c: { $ref: 'my-test/SchemaC' } },
          },
        },
      });
      expect(extractor.get('SchemaC')).toEqual({
        type: 'string',
        minLength: 5,
      });
    });

    it('should handle multiple deep refs (nullable)', async () => {
      const extractor = new TestExtractor();

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
            nullable: true,
            properties: {
              b: {
                type: 'object',
                additionalProperties: false,
                required: [],
                nullable: true,
                properties: {
                  c: {
                    type: 'string',
                    [SCHEMA_REF_NAME]: 'SchemaC',
                    minLength: 5,
                    nullable: true,
                  },
                },
              },
            },
          },
        },
      };

      const res = extractor.extract(schema, INITIAL_REF);
      expect(res?.properties.a.oneOf).toEqual([
        { $ref: 'my-test/SchemaA' },
        { type: 'null' },
      ]);
      expect(extractor.get('SchemaA')).toEqual({
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          b: {
            type: 'object',
            additionalProperties: false,
            required: [],
            nullable: true,
            properties: {
              c: {
                oneOf: [{ $ref: 'my-test/SchemaC' }, { type: 'null' }],
              },
            },
          },
        },
      });
      expect(extractor.get('SchemaC')).toEqual({
        type: 'string',
        minLength: 5,
      });
    });

    it('should handle self-refs', async () => {
      const extractor = new TestExtractor();

      type A = { a?: A };
      const schema: JSONSchemaType<A> = {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: { a: { $ref: '#' } },
      };

      const res = extractor.extract(schema, INITIAL_REF);

      expect(res?.properties.a.$ref).toEqual(INITIAL_REF);
    });

    it('should handle self-refs (nullable)', async () => {
      const extractor = new TestExtractor();
      type A = { a?: A | null };
      const schema: JSONSchemaType<A> = {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: { a: { oneOf: [{ $ref: '#' }, { type: 'null' }] } },
      };

      const res = extractor.extract(schema, INITIAL_REF);

      expect(res?.properties.a.oneOf).toEqual([
        { $ref: INITIAL_REF },
        { type: 'null' },
      ]);
    });

    it('should throw if self-ref is not contained in a schema', async () => {
      const extractor = new TestExtractor();

      type A = { a?: A };
      const schema: JSONSchemaType<A> = {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: { a: { $ref: '#' } },
      };

      expect(() => extractor.extract(schema, '')).toThrowError(
        /Recursive refs MUST have at least one parent with a SCHEMA_REF_NAME defined/,
      );
    });

    it('should handle deep self-refs', async () => {
      const extractor = new TestExtractor();

      type A = { a: { b: { c?: A } } };
      const schema: JSONSchemaType<A> = {
        type: 'object',
        additionalProperties: false,
        required: [],
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

      const res = extractor.extract(schema, INITIAL_REF);

      expect(res?.properties.a.properties.b.properties.c.$ref).toEqual(
        INITIAL_REF,
      );
    });

    it('should handle deep self-refs (nullable)', async () => {
      const extractor = new TestExtractor();

      type A = { a: { b: { c?: A | null } } };
      const schema: JSONSchemaType<A> = {
        type: 'object',
        additionalProperties: false,
        required: [],
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
                properties: { c: { oneOf: [{ $ref: '#' }, { type: 'null' }] } },
              },
            },
          },
        },
      };

      const res = extractor.extract(schema, INITIAL_REF);

      expect(res?.properties.a.properties.b.properties.c.oneOf).toEqual([
        { $ref: INITIAL_REF },
        { type: 'null' },
      ]);
    });

    it('should handle multi-level self-refs', async () => {
      const extractor = new TestExtractor();

      type A = { child: B };
      type B = { b: B };

      const schema: JSONSchemaType<A> = {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          child: {
            [SCHEMA_REF_NAME]: 'SchemaB',
            type: 'object',
            additionalProperties: false,
            required: [],
            properties: { b: { $ref: '#' } },
          },
        },
      };

      const res = extractor.extract(schema, INITIAL_REF);
      expect(res?.properties.child.$ref).toEqual('my-test/SchemaB');
      expect(extractor.get('SchemaB')).toHaveProperty(
        'properties.b.$ref',
        'my-test/SchemaB',
      );
    });

    it('should handle multi-level self-refs (nullable)', async () => {
      const extractor = new TestExtractor();

      type A = { child: B | null };
      type B = { b: B | null };

      const schema: JSONSchemaType<A> = {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          child: {
            [SCHEMA_REF_NAME]: 'SchemaB',
            type: 'object',
            additionalProperties: false,
            required: [],
            nullable: true,
            properties: { b: { oneOf: [{ $ref: '#' }, { type: 'null' }] } },
          },
        },
      };

      const res = extractor.extract(schema, INITIAL_REF);
      expect(res?.properties.child.oneOf).toEqual([
        { $ref: 'my-test/SchemaB' },
        { type: 'null' },
      ]);
      expect(extractor.get('SchemaB')).toHaveProperty('properties.b.oneOf', [
        { $ref: 'my-test/SchemaB' },
        { type: 'null' },
      ]);
    });

    it('should extract schema from additionalProperties', async () => {
      const extractor = new TestExtractor();
      const schema: JSONSchemaType<Record<string, string>> = {
        type: 'object',
        additionalProperties: {
          type: 'string',
          [SCHEMA_REF_NAME]: 'MyString',
          minLength: 5,
        },
        required: [],
        properties: {},
      };

      const res = extractor.extract(schema, INITIAL_REF);

      expect(res).toHaveProperty(
        'additionalProperties.$ref',
        'my-test/MyString',
      );
      expect(extractor.get('MyString')).toEqual({
        type: 'string',
        minLength: 5,
      });
    });

    it('should extract schema from additionalProperties (nullable)', async () => {
      const extractor = new TestExtractor();
      const schema: JSONSchemaType<Record<string, string>> = {
        type: 'object',
        additionalProperties: {
          type: 'string',
          [SCHEMA_REF_NAME]: 'MyString',
          minLength: 5,
          nullable: true,
        },
        required: [],
        properties: {},
      };

      const res = extractor.extract(schema, INITIAL_REF);
      expect(res).toHaveProperty('additionalProperties.oneOf', [
        { $ref: 'my-test/MyString' },
        { type: 'null' },
      ]);
      expect(extractor.get('MyString')).toEqual({
        type: 'string',
        minLength: 5,
      });
    });

    it('should extract schema from array', async () => {
      const extractor = new TestExtractor();
      const schema: JSONSchemaType<{ a: string[] }> = {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          a: {
            type: 'array',
            items: {
              type: 'string',
              [SCHEMA_REF_NAME]: 'MyString',
              minLength: 5,
            },
          },
        },
      };

      const res = extractor.extract(schema, INITIAL_REF);

      expect(res).toHaveProperty('properties.a.items.$ref', 'my-test/MyString');
      expect(extractor.get('MyString')).toEqual({
        type: 'string',
        minLength: 5,
      });
    });

    it('should extract schema from array (nullable)', async () => {
      const extractor = new TestExtractor();
      const schema: JSONSchemaType<{ a: string[] }> = {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          a: {
            type: 'array',
            items: {
              nullable: true,
              type: 'string',
              [SCHEMA_REF_NAME]: 'MyString',
              minLength: 5,
            },
          },
        },
      };

      const res = extractor.extract(schema, INITIAL_REF);
      expect(res).toHaveProperty('properties.a.items.oneOf', [
        { $ref: 'my-test/MyString' },
        { type: 'null' },
      ]);
      expect(extractor.get('MyString')).toEqual({
        type: 'string',
        minLength: 5,
      });
    });

    describe('oneOf/allOf/anyOf', () => {
      const getSchema = (
        type: 'oneOf' | 'allOf' | 'anyOf',
      ): JSONSchemaType<{ a: (string | number)[] }> =>
        ({
          type: 'object',
          additionalProperties: false,
          required: [],
          properties: {
            a: {
              type: 'array',
              items: {
                [type]: [
                  {
                    type: 'string',
                    [SCHEMA_REF_NAME]: 'MyString',
                    minLength: 5,
                  },
                  {
                    type: 'number',
                    maximum: 5,
                  },
                ],
              },
            },
          },
        }) as unknown as JSONSchemaType<{ a: (string | number)[] }>;

      it('should extract schema from oneOf', async () => {
        const extractor = new TestExtractor();
        const res = extractor.extract(getSchema('oneOf'), INITIAL_REF);

        expect(res?.properties.a.items.oneOf[0].$ref).toEqual(
          'my-test/MyString',
        );
        expect(res?.properties.a.items.oneOf[1].$ref).toBeUndefined();
        expect(extractor.get('MyString')).toEqual({
          type: 'string',
          minLength: 5,
        });
      });

      it('should extract schema from anyOf', async () => {
        const extractor = new TestExtractor();
        const res = extractor.extract(getSchema('anyOf'), INITIAL_REF);

        expect(res?.properties.a.items.anyOf[0].$ref).toEqual(
          'my-test/MyString',
        );
        expect(res?.properties.a.items.anyOf[1].$ref).toBeUndefined();
        expect(extractor.get('MyString')).toEqual({
          type: 'string',
          minLength: 5,
        });
      });

      it('should extract schema from allOf', async () => {
        const extractor = new TestExtractor();
        const res = extractor.extract(getSchema('allOf'), INITIAL_REF);

        expect(res?.properties.a.items.allOf[0].$ref).toEqual(
          'my-test/MyString',
        );
        expect(res?.properties.a.items.allOf[1].$ref).toBeUndefined();
        expect(extractor.get('MyString')).toEqual({
          type: 'string',
          minLength: 5,
        });
      });
    });
  });
});
