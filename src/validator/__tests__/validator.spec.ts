import { describe, expect, it } from 'vitest';
import { ObjectId } from 'bson';
import { BaseValidator } from 'moleculer';
import { z } from 'zod/v4';
import {
  COERCE_ARRAY_ATTRIBUTE,
  JSONSchemaType,
  OBJECTID_TYPE,
} from '../../json-schema/index.js';
import { AjvValidator } from '../index.js';
import { ZodValidator } from '../zod-validator.js';

function createValidator() {
  return new AjvValidator<'default'>(
    {
      default: {
        useDefaults: true,
        coerceTypes: true,
        allErrors: true,
        removeAdditional: false,
        discriminator: true,
      },
    },
    'default',
    new ZodValidator(),
  );
}

describe('validator zod fallback', () => {
  it('should allow using the validate function', () => {
    const validator = createValidator();

    const schema: JSONSchemaType<{ a: ObjectId }> = {
      type: 'object',
      required: ['a'],
      properties: { a: OBJECTID_TYPE },
    };

    // Also check typing
    const a: boolean = validator.validate({ a: new ObjectId() }, schema);
    expect(a).toEqual(true);

    const date = new Date();
    // Also check typing
    const b: Date = validator.validate(date.getTime(), z.coerce.date());
    expect(b).toEqual(date);
  });

  it('should correctly type validate fn as BaseValidator', () => {
    const validator = createValidator() as BaseValidator;

    const schema: JSONSchemaType<{ a: ObjectId }> = {
      type: 'object',
      required: ['a'],
      properties: { a: OBJECTID_TYPE },
    };

    // Also check typing
    const a: boolean = validator.validate({ a: new ObjectId() }, schema);
    expect(a).toEqual(true);

    const date = new Date();
    // Also check typing
    const b: Date = validator.validate(date.getTime(), z.coerce.date());
    expect(b).toEqual(date);
  });
});

describe('ajv date conversion', () => {
  it('should convert string to date', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        date: { type: 'string', format: 'date-time', nullable: true },
      },
    });

    const date = new Date();
    const data = { date: date.toISOString() };

    expect(() => validate(data)).not.toThrow();
    expect(data.date).toBeInstanceOf(Date);
    expect(data.date).toEqual(date);
  });

  it('should accept date when format is date-time', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        date: { type: 'string', format: 'date-time', nullable: true },
      },
    });

    const date = new Date();
    const data = { date };

    expect(() => validate(data)).not.toThrow();
    expect(data.date).toEqual(date);
  });

  it('should not convert if format is not date related', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        url: { type: 'string', format: 'url', nullable: true },
      },
    });

    const data = { url: 'https://google.com' };

    expect(() => validate(data)).not.toThrow();

    expect(data.url).toBe('https://google.com');
  });

  it('should throw if a simple string is passed', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        date: { type: 'string', format: 'date-time', nullable: true },
      },
    });

    const data = { date: 'not-a-date-time' };

    expect(() => validate(data)).toThrow();
  });

  it('should throw if a class other than the native Date is passed', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        date: { type: 'string', format: 'date-time', nullable: true },
      },
    });

    class Date {}

    const data = { date: new Date() };

    expect(() => validate(data)).toThrow();
  });

  it('should work with array of dates', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        dates: {
          type: 'array',
          items: { type: 'string', format: 'date-time', nullable: true },
          nullable: true,
        },
      },
    });

    const date1 = new Date();
    const date2 = new Date();
    const data = { dates: [date1, date2] };

    expect(() => validate(data)).not.toThrow();
    expect(data.dates).toEqual([date1, date2]);
  });

  it('should work with array of objects', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        dates: {
          type: 'array',
          nullable: true,
          items: {
            type: 'object',
            nullable: true,
            properties: {
              date: { type: 'string', format: 'date-time', nullable: true },
            },
          },
        },
      },
    });

    const date1 = new Date();
    const date2 = new Date();
    const data = { dates: [{ date: date1 }, { date: date2 }] };

    expect(() => validate(data)).not.toThrow();
    expect(data.dates).toEqual([{ date: date1 }, { date: date2 }]);
  });

  it('should work handle oneOf', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        dates: {
          type: 'array',
          nullable: true,
          items: {
            oneOf: [
              { type: 'array', items: { type: 'string', format: 'date-time' } },
              {
                type: 'object',
                required: [],
                additionalProperties: false,
                properties: { a: { type: 'string', format: 'date-time' } },
              },
            ],
          },
        },
      },
    });

    const date1 = new Date('2021-05-06T08:33:20.377Z');
    const date2 = new Date('2021-05-06T08:33:21.377Z');
    const data = {
      dates: [[date2.toISOString()], { a: date1.toISOString() }],
    };

    expect(() => validate(data)).not.toThrow();
    expect(data).toEqual({ dates: [[date2], { a: date1 }] });
  });

  it('should handle anyOf with primitive select', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        dates: {
          type: 'array',
          nullable: true,
          items: {
            anyOf: [
              { type: 'string', format: 'date-time' },
              { type: 'string' },
              { type: 'array', items: { type: 'string', format: 'date-time' } },
              {
                type: 'object',
                required: [],
                additionalProperties: false,
                properties: { a: { type: 'string', format: 'date-time' } },
              },
            ],
          },
        },
      },
    });

    const date1 = new Date('2021-05-06T08:33:20.377Z');
    const date2 = new Date('2021-05-06T08:33:21.377Z');
    const date3 = new Date('2021-05-06T08:33:22.377Z');
    const data = {
      dates: [
        'toto',
        date1.toISOString(),
        [date2.toISOString()],
        { a: date3.toISOString() },
      ],
    };

    expect(() => validate(data)).not.toThrow();
    expect(data).toEqual({ dates: ['toto', date1, [date2], { a: date3 }] });
  });

  it('should not create empty objects', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        value: { type: 'number', nullable: true },
        appointment: {
          type: 'object',
          nullable: true,
          properties: {
            staffID: { type: 'string', nullable: true },
            date: { type: 'string', format: 'date-time', nullable: true },
          },
        },
      },
    });

    const data = { value: 25 };

    expect(() => validate(data)).not.toThrow();
    expect(data).toEqual({ value: 25 });
  });
});

describe('ajv coerce-array conversion', () => {
  it('should convert string to string[]', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          [COERCE_ARRAY_ATTRIBUTE]: true,
        },
      },
    });

    const data = { ids: '22' };
    expect(() => validate(data)).not.toThrow();
    expect(data.ids).toBeInstanceOf(Array);
    expect(data.ids[0]).toEqual('22');
  });

  it('should accept array', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          [COERCE_ARRAY_ATTRIBUTE]: true,
        },
      },
    });

    const data = { ids: ['22'] };
    expect(() => validate(data)).not.toThrow();
    expect(data.ids).toBeInstanceOf(Array);
    expect(data.ids[0]).toEqual('22');
  });

  it('should work with array of dates', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        dates: {
          type: 'array',
          [COERCE_ARRAY_ATTRIBUTE]: true,
          items: { type: 'string', format: 'date-time' },
        },
      },
    });

    const date1 = new Date();
    const data = { dates: date1.toISOString() };

    expect(() => validate(data)).not.toThrow();
    expect(data.dates).toEqual([date1]);
  });

  it('should work with array of objects', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        dates: {
          type: 'array',
          nullable: true,
          [COERCE_ARRAY_ATTRIBUTE]: true,
          items: {
            type: 'object',
            nullable: true,
            properties: {
              date: { type: 'string', format: 'date-time', nullable: true },
            },
          },
        },
      },
    });

    const date1 = new Date();
    const data = { dates: { date: date1.toISOString() } };

    expect(() => validate(data)).not.toThrow();
    expect(data.dates).toEqual([{ date: date1 }]);
  });

  it('should not create empty arrays', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        values: {
          type: 'array',
          items: { type: 'number' },
          [COERCE_ARRAY_ATTRIBUTE]: true,
          nullable: true,
        },
      },
    });

    const data = { values: null };
    expect(() => validate(data)).not.toThrow();
    expect(data).toEqual({ values: null });
  });

  it('should work with nested arrays', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        values: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'string' },
            [COERCE_ARRAY_ATTRIBUTE]: true,
          },
        },
      },
    });

    const data = { values: ['a', 'b'] };
    expect(() => validate(data)).not.toThrow();
    expect(data).toEqual({ values: [['a'], ['b']] });
  });

  it('known issue with nested arrays', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        values: {
          type: 'array',
          [COERCE_ARRAY_ATTRIBUTE]: true,
          items: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    });

    const data = { values: ['a', 'b'] };
    expect(() => validate(data)).toThrow();
  });

  it('known issue with oneOf', () => {
    const validator = createValidator();

    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        dates: {
          oneOf: [
            {
              type: 'array',
              [COERCE_ARRAY_ATTRIBUTE]: true,
              items: { type: 'string' },
            },
            {
              type: 'object',
              required: [],
              additionalProperties: false,
              properties: { a: { type: 'string' } },
            },
          ],
        },
      },
    });

    const date = new Date('2021-05-06T08:33:21.377Z').toISOString();
    const data = {
      dates: { a: date },
    };

    expect(() => validate(data)).toThrow();
  });
});

describe('helpers schemas', () => {
  const validator = createValidator();

  it('should correctly validate objectIds', () => {
    const validate = validator.compile({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: { id: OBJECTID_TYPE },
    } as JSONSchemaType<{ id?: string }>);

    const test = (str: string) => validate({ id: str });

    expect(() => test('c3e1dab7-5b69-4378-a384-229192fce2e7')).toThrow();
    expect(() => test('c3e1dab7-5b69-a384-229192fce2e7')).toThrow();
    expect(() => test('5d9322f2312617000060f')).toThrow();
    expect(() => test('5d9322f2312617000060c3cf')).not.toThrow();
  });
});

describe('discriminator', () => {
  const validator = createValidator();
  it('should fail, missing required key in sub schema', () => {
    const validate = validator.compile({
      type: 'object',
      discriminator: {
        propertyName: 'kind',
      },
      required: ['kind'],
      oneOf: [
        {
          required: ['foo'],
          properties: { foo: { type: 'string' } },
        },
        {
          required: ['bar', 'kind'],
          properties: { kind: { const: 'bar' }, bar: { type: 'string' } },
        },
        {
          required: ['baz', 'kind'],
          properties: { kind: { const: 'baz' }, baz: { type: 'string' } },
        },
      ],
    });

    const errorPattern =
      /^discriminator: oneOf subschemas \(or referenced schemas\) must have "properties\/kind"$/;

    expect(() => validate({ anything: 'foo' })).toThrow(errorPattern);
  });

  it('should correctly handle discriminator', () => {
    const validate = validator.compile({
      type: 'object',
      discriminator: {
        propertyName: 'kind',
      },
      required: ['kind'],
      oneOf: [
        {
          required: ['foo', 'kind'],
          properties: { kind: { const: 'foo' }, foo: { type: 'string' } },
        },
        {
          required: ['bar', 'kind'],
          properties: { kind: { const: 'bar' }, bar: { type: 'string' } },
        },
        {
          required: ['baz', 'kind'],
          properties: { kind: { const: 'baz' }, baz: { type: 'string' } },
        },
      ],
    });

    expect(() => validate({ kind: 'foo', bar: 's' })).toThrow();
    expect(() => validate({ kind: 'bar', bar: 's' })).not.toThrow();
    expect(() => validate({ kind: 'baz', bar: 's' })).toThrow();
    expect(() => validate({ kind: 'foo', foo: 's' })).not.toThrow();
  });
});
