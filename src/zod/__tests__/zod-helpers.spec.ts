import { describe, expect, it } from 'vitest';
import { ObjectId } from 'bson';
import { z } from 'zod/v4';
import { OpenAPIExtractor } from '../../openapi/index.js';
import { Document } from '../../openapi/types.js';
import {
  zodCoerceArray,
  zodDate,
  zodObjectId,
  zodToOpenAPISchema,
} from '../zod-helpers.js';

describe('zodToOpenAPISchema', () => {
  it('should handle deep refs', () => {
    const doc: Document = {
      openapi: '',
      info: { title: 'Test', version: '0' },
      paths: {},
    };
    const extractor = new OpenAPIExtractor(doc);

    const res = zodToOpenAPISchema(
      z.object({
        a: z.string(),
        b: zodDate,
        c: z.object({ d: zodObjectId }).meta({ id: 'CObject' }),
      }),
      extractor,
    );

    expect(res).toEqual({
      type: 'object',
      required: ['a', 'b', 'c'],
      properties: {
        a: { type: 'string' },
        b: { type: 'string', format: 'date-time' },
        c: { $ref: '#/components/schemas/CObject' },
      },
    });
    expect(doc.components?.schemas).toEqual({
      ObjectId: {
        $id: 'ObjectId',
        type: 'string',
        format: 'object-id',
        pattern: '^[0-9A-Fa-f]{24}$',
      },
      CObject: {
        $id: 'CObject',
        type: 'object',
        required: ['d'],
        properties: { d: { $ref: '#/components/schemas/ObjectId' } },
      },
    });
  });

  it('should handle self refs', () => {
    const doc: Document = {
      openapi: '',
      info: { title: 'Test', version: '0' },
      paths: {},
    };
    const extractor = new OpenAPIExtractor(doc);

    const schema = z
      .object({
        get me() {
          return schema;
        },
      })
      .meta({ id: 'Me' });

    const res = zodToOpenAPISchema(schema, extractor);

    expect(res).toEqual({ $ref: '#/components/schemas/Me' });
    expect(doc.components?.schemas).toEqual({
      Me: {
        $id: 'Me',
        type: 'object',
        required: ['me'],
        properties: { me: { $ref: '#/components/schemas/Me' } },
      },
    });
  });

  it('should rename refs', () => {
    const doc: Document = {
      openapi: '',
      info: { title: 'Test', version: '0' },
      paths: {},
    };
    const extractor = new OpenAPIExtractor(doc);

    const res = zodToOpenAPISchema(zodObjectId, extractor);
    expect(res).toEqual({ $ref: '#/components/schemas/ObjectId' });
    expect(doc.components?.schemas).toEqual({
      ObjectId: {
        $id: 'ObjectId',
        type: 'string',
        format: 'object-id',
        pattern: '^[0-9A-Fa-f]{24}$',
      },
    });
  });

  it('should correctly transform dates', () => {
    const doc: Document = {
      openapi: '',
      info: { title: 'Test', version: '0' },
      paths: {},
    };
    const extractor = new OpenAPIExtractor(doc);

    const res = zodToOpenAPISchema(zodDate, extractor);
    expect(res).toEqual({ type: 'string', format: 'date-time' });
  });

  it('should correctly transform coerced arrays', () => {
    const doc: Document = {
      openapi: '',
      info: { title: 'Test', version: '0' },
      paths: {},
    };
    const extractor = new OpenAPIExtractor(doc);

    const res = zodToOpenAPISchema(zodCoerceArray(z.int()), extractor);
    expect(res).toEqual({
      type: 'array',
      items: {
        maximum: 9007199254740991,
        minimum: -9007199254740991,
        type: 'integer',
      },
    });
  });
});

describe('zodObjectId', () => {
  it('should support object id strings', () => {
    const id = new ObjectId();

    expect(zodObjectId.parse(id.toHexString())).toEqual(id);
  });
  it('should support object id instances', () => {
    const id = new ObjectId();

    expect(zodObjectId.parse(id)).toEqual(id);
  });

  it('should reject non object id strings', () => {
    expect(zodObjectId.safeParse('baby-liss').success).toBe(false);
  });
});

describe('zodDate', () => {
  it('should support instance dates', () => {
    const date = new Date();

    expect(zodDate.parse(date)).toEqual(date);
  });

  it('should support ISO string dates', () => {
    const date = new Date();

    expect(zodDate.parse(date.toISOString())).toEqual(date);
  });

  it('should reject non ISO dates strings', () => {
    const date = new Date();

    expect(zodDate.safeParse(date.toDateString()).success).toBe(false);
  });
});

describe('zodCoerceArray', () => {
  it('should coerce to array', () => {
    const date = new Date();

    expect(zodCoerceArray(z.date()).parse(date)).toEqual([date]);
  });

  it('should not coerce undefined values', () => {
    expect(zodCoerceArray(z.date()).optional().parse(undefined)).toEqual(
      undefined,
    );
  });

  it('should coerce falsy values', () => {
    expect(zodCoerceArray(z.boolean()).parse(false)).toEqual([false]);
    expect(zodCoerceArray(z.int()).parse(0)).toEqual([0]);
  });

  it('should keep arrays', () => {
    const schema = zodCoerceArray(z.int());
    const a: z.infer<typeof schema> = [1, 2, 3];

    expect(schema.parse(a)).toEqual([1, 2, 3]);
  });

  it('should fail on wrongly typed arrays', () => {
    const schema = zodCoerceArray(z.int());

    // @ts-expect-error Test typing here
    const a: z.infer<typeof schema> = ['a', 'b', 'c'];

    expect(schema.safeParse(a).success).toBe(false);
  });

  it('should support params', () => {
    const schema = zodCoerceArray(z.int(), { error: 'MyError' });

    expect(schema.safeParse(undefined).error?.issues[0].message).toBe(
      'MyError',
    );
  });
});
