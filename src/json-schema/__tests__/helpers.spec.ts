import { describe, expect, it } from 'vitest';
import {
  omitFields,
  optionalExceptFields,
  optionalFields,
  pickFields,
} from '../helpers.js';

describe('omitFields', () => {
  it('removes zero field', () => {
    const res = omitFields<{ _id: string; other: string }, never>(
      {
        type: 'object',
        required: ['_id', 'other'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
        },
      },
      [],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['_id', 'other'],
      additionalProperties: false,
      properties: {
        _id: { type: 'string' },
        other: { type: 'string' },
      },
    });
  });

  it('removes one field', () => {
    const res = omitFields<{ _id: string; other: string }, '_id'>(
      {
        type: 'object',
        required: ['_id', 'other'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
        },
      },
      ['_id'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['other'],
      additionalProperties: false,
      properties: {
        other: { type: 'string' },
      },
    });
  });

  it('removes two field', () => {
    const res = omitFields<
      { _id: string; other: string; another: string },
      '_id' | 'another'
    >(
      {
        type: 'object',
        required: ['_id', 'other', 'another'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
          another: { type: 'string' },
        },
      },
      ['_id', 'another'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['other'],
      additionalProperties: false,
      properties: {
        other: { type: 'string' },
      },
    });
  });

  it('leaves deep fields', () => {
    const res = omitFields<
      {
        _id: string;
        other: string;
        another: { other: string; other2: string };
      },
      'other'
    >(
      {
        type: 'object',
        required: ['_id', 'other', 'another'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
          another: {
            type: 'object',
            required: ['other', 'other2'],
            additionalProperties: false,
            properties: {
              other: { type: 'string' },
              other2: { type: 'string' },
            },
          },
        },
      },
      ['other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['_id', 'another'],
      additionalProperties: false,
      properties: {
        _id: { type: 'string' },
        another: {
          type: 'object',
          required: ['other', 'other2'],
          additionalProperties: false,
          properties: {
            other: { type: 'string' },
            other2: { type: 'string' },
          },
        },
      },
    });
  });

  it('works with oneOf', () => {
    const res = omitFields<
      { _id: string; other: string } | { _id: string; another: string },
      '_id'
    >(
      {
        oneOf: [
          {
            type: 'object',
            required: ['_id', 'other'],
            additionalProperties: false,
            properties: {
              _id: { type: 'string' },
              other: { type: 'string' },
            },
          },
          {
            type: 'object',
            required: ['_id', 'another'],
            additionalProperties: false,
            properties: {
              _id: { type: 'string' },
              another: { type: 'string' },
            },
          },
        ],
      },
      ['_id'],
    );
    expect(res).toEqual({
      oneOf: [
        {
          type: 'object',
          required: ['other'],
          additionalProperties: false,
          properties: {
            other: { type: 'string' },
          },
        },
        {
          type: 'object',
          required: ['another'],
          additionalProperties: false,
          properties: {
            another: { type: 'string' },
          },
        },
      ],
    });
  });
});

describe('pickFields', () => {
  it('picks all fields', () => {
    const res = pickFields<{ _id: string; other: string }, '_id' | 'other'>(
      {
        type: 'object',
        required: ['_id', 'other'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
        },
      },
      ['_id', 'other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['_id', 'other'],
      additionalProperties: false,
      properties: {
        _id: { type: 'string' },
        other: { type: 'string' },
      },
    });
  });

  it('picks one field', () => {
    const res = pickFields<{ _id: string; other: string }, '_id' | 'other'>(
      {
        type: 'object',
        required: ['_id', 'other'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
        },
      },
      ['other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['other'],
      additionalProperties: false,
      properties: {
        other: { type: 'string' },
      },
    });
  });

  it('picks one field (2)', () => {
    const res = pickFields<
      { _id: string; other: string; another: string },
      '_id' | 'other' | 'another'
    >(
      {
        type: 'object',
        required: ['_id', 'other', 'another'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
          another: { type: 'string' },
        },
      },
      ['other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['other'],
      additionalProperties: false,
      properties: {
        other: { type: 'string' },
      },
    });
  });

  it('leaves deep fields', () => {
    const res = pickFields<
      {
        _id: string;
        other: string;
        another: { other: string; other2: string };
      },
      '_id' | 'other' | 'another'
    >(
      {
        type: 'object',
        required: ['_id', 'other', 'another'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
          another: {
            type: 'object',
            required: ['other', 'other2'],
            additionalProperties: false,
            properties: {
              other: { type: 'string' },
              other2: { type: 'string' },
            },
          },
        },
      },
      ['other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['other'],
      additionalProperties: false,
      properties: {
        other: { type: 'string' },
      },
    });
  });

  it('works with oneOf', () => {
    const res = pickFields<
      { _id: string; other: string } | { _id: string; another: string },
      // @ts-expect-error not sure how to pass these kind of types...
      '_id' | 'other' | 'another'
    >(
      {
        oneOf: [
          {
            type: 'object',
            required: ['_id', 'other'],
            additionalProperties: false,
            properties: {
              _id: { type: 'string' },
              other: { type: 'string' },
            },
          },
          {
            type: 'object',
            required: ['_id', 'another'],
            additionalProperties: false,
            properties: {
              _id: { type: 'string' },
              another: { type: 'string' },
            },
          },
        ],
      },
      ['other', 'another'],
    );
    expect(res).toEqual({
      oneOf: [
        {
          type: 'object',
          required: ['other'],
          additionalProperties: false,
          properties: {
            other: { type: 'string' },
          },
        },
        {
          type: 'object',
          required: ['another'],
          additionalProperties: false,
          properties: {
            another: { type: 'string' },
          },
        },
      ],
    });
  });
});

describe('optionalExceptFields', () => {
  it('keep all fields', () => {
    const res = optionalExceptFields<
      { _id: string; other: string },
      '_id' | 'other'
    >(
      {
        type: 'object',
        required: ['_id', 'other'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
        },
      },
      ['_id', 'other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['_id', 'other'],
      additionalProperties: false,
      properties: {
        _id: { type: 'string' },
        other: { type: 'string' },
      },
    });
  });

  it('keep one field', () => {
    const res = optionalExceptFields<
      { _id: string; other: string },
      '_id' | 'other'
    >(
      {
        type: 'object',
        required: ['_id', 'other'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
        },
      },
      ['other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['other'],
      additionalProperties: false,
      properties: {
        _id: { type: 'string' },
        other: { type: 'string' },
      },
    });
  });

  it('keep one field (2)', () => {
    const res = optionalExceptFields<
      { _id: string; other: string; another: string },
      '_id' | 'other' | 'another'
    >(
      {
        type: 'object',
        required: ['_id', 'other', 'another'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
          another: { type: 'string' },
        },
      },
      ['other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['other'],
      additionalProperties: false,
      properties: {
        _id: { type: 'string' },
        other: { type: 'string' },
        another: { type: 'string' },
      },
    });
  });

  it('leaves deep fields', () => {
    const res = optionalExceptFields<
      {
        _id: string;
        other: string;
        another: { other: string; other2: string };
      },
      '_id' | 'other' | 'another'
    >(
      {
        type: 'object',
        required: ['_id', 'other', 'another'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
          another: {
            type: 'object',
            required: ['other', 'other2'],
            additionalProperties: false,
            properties: {
              other: { type: 'string' },
              other2: { type: 'string' },
            },
          },
        },
      },
      ['other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['other'],
      additionalProperties: false,
      properties: {
        _id: { type: 'string' },
        other: { type: 'string' },
        another: {
          type: 'object',
          required: ['other', 'other2'],
          additionalProperties: false,
          properties: {
            other: { type: 'string' },
            other2: { type: 'string' },
          },
        },
      },
    });
  });

  it('works with oneOf', () => {
    const res = optionalExceptFields<
      { _id: string; other: string } | { _id: string; another: string },
      '_id'
    >(
      {
        oneOf: [
          {
            type: 'object',
            required: ['_id', 'other'],
            additionalProperties: false,
            properties: {
              _id: { type: 'string' },
              other: { type: 'string' },
            },
          },
          {
            type: 'object',
            required: ['_id', 'another'],
            additionalProperties: false,
            properties: {
              _id: { type: 'string' },
              another: { type: 'string' },
            },
          },
        ],
      },
      ['_id'],
    );
    expect(res).toEqual({
      oneOf: [
        {
          type: 'object',
          required: ['_id'],
          additionalProperties: false,
          properties: {
            _id: { type: 'string' },
            other: { type: 'string' },
          },
        },
        {
          type: 'object',
          required: ['_id'],
          additionalProperties: false,
          properties: {
            _id: { type: 'string' },
            another: { type: 'string' },
          },
        },
      ],
    });
  });
});

describe('optionalFields', () => {
  it('omit all fields', () => {
    const res = optionalFields<{ _id: string; other: string }, '_id' | 'other'>(
      {
        type: 'object',
        required: ['_id', 'other'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
        },
      },
      ['_id', 'other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        _id: { type: 'string' },
        other: { type: 'string' },
      },
    });
  });

  it('omit one field', () => {
    const res = optionalFields<{ _id: string; other: string }, '_id' | 'other'>(
      {
        type: 'object',
        required: ['_id', 'other'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
        },
      },
      ['other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['_id'],
      additionalProperties: false,
      properties: {
        _id: { type: 'string' },
        other: { type: 'string' },
      },
    });
  });

  it('omit one field (2)', () => {
    const res = optionalFields<
      { _id: string; other: string; another: string },
      '_id' | 'other' | 'another'
    >(
      {
        type: 'object',
        required: ['_id', 'other', 'another'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
          another: { type: 'string' },
        },
      },
      ['other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['_id', 'another'],
      additionalProperties: false,
      properties: {
        _id: { type: 'string' },
        other: { type: 'string' },
        another: { type: 'string' },
      },
    });
  });

  it('leaves deep fields', () => {
    const res = optionalFields<
      {
        _id: string;
        other: string;
        another: { other: string; other2: string };
      },
      '_id' | 'other' | 'another'
    >(
      {
        type: 'object',
        required: ['_id', 'other', 'another'],
        additionalProperties: false,
        properties: {
          _id: { type: 'string' },
          other: { type: 'string' },
          another: {
            type: 'object',
            required: ['other', 'other2'],
            additionalProperties: false,
            properties: {
              other: { type: 'string' },
              other2: { type: 'string' },
            },
          },
        },
      },
      ['other'],
    );
    expect(res).toEqual({
      type: 'object',
      required: ['_id', 'another'],
      additionalProperties: false,
      properties: {
        _id: { type: 'string' },
        other: { type: 'string' },
        another: {
          type: 'object',
          required: ['other', 'other2'],
          additionalProperties: false,
          properties: {
            other: { type: 'string' },
            other2: { type: 'string' },
          },
        },
      },
    });
  });

  it('works with oneOf', () => {
    const res = optionalFields<
      { _id: string; other: string } | { _id: string; another: string },
      '_id'
    >(
      {
        oneOf: [
          {
            type: 'object',
            required: ['_id', 'other'],
            additionalProperties: false,
            properties: {
              _id: { type: 'string' },
              other: { type: 'string' },
            },
          },
          {
            type: 'object',
            required: ['_id', 'another'],
            additionalProperties: false,
            properties: {
              _id: { type: 'string' },
              another: { type: 'string' },
            },
          },
        ],
      },
      ['_id'],
    );
    expect(res).toEqual({
      oneOf: [
        {
          type: 'object',
          required: ['other'],
          additionalProperties: false,
          properties: {
            _id: { type: 'string' },
            other: { type: 'string' },
          },
        },
        {
          type: 'object',
          required: ['another'],
          additionalProperties: false,
          properties: {
            _id: { type: 'string' },
            another: { type: 'string' },
          },
        },
      ],
    });
  });
});
