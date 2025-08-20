import { Errors } from 'moleculer';
import type { JSONSchemaType } from '../json-schema/index.js';

export const ServerErrorSchema: JSONSchemaType<
  Omit<Errors.MoleculerServerError, 'cause'>
> = {
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    name: { type: 'string' },
    stack: { type: 'string', nullable: true },
    type: { type: 'string' },
    data: { type: 'object', nullable: true },
    message: { type: 'string' },
    code: { type: 'integer' },
    retryable: { type: 'boolean' },
  },
  example: {
    name: 'MoleculerServerError',
    message: 'Internal Server Error',
    code: 500,
  },
};

export const UnauthorizedErrorSchema: JSONSchemaType<Record<string, unknown>> =
  {
    type: 'object',
    additionalProperties: false,
    required: [],
    properties: {},
    example: {
      name: 'UnAuthorizedError',
      message: 'Unauthorized',
      code: 401,
      type: 'NO_TOKEN',
      data: null,
    },
  };

export const FileNotExistSchema: JSONSchemaType<Record<string, unknown>> = {
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {},
  example: {
    name: 'MoleculerClientError',
    message: 'File missing in the request',
    code: 400,
  },
};

export const FileTooBigSchema: JSONSchemaType<Record<string, unknown>> = {
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {},
  example: {
    name: 'PayloadTooLarge',
    message: 'Payload too large',
    code: 413,
    type: 'PAYLOAD_TOO_LARGE',
    data: {
      fieldname: 'file',
      filename: '4b2005c0b8.png',
      encoding: '7bit',
      mimetype: 'image/png',
    },
  },
};

export const ValidationErrorSchema: JSONSchemaType<
  Omit<Errors.ValidationError, 'cause'>
> = {
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: ServerErrorSchema.properties,
  example: {
    code: 422,
    type: 'VALIDATION_ERROR',
    data: [
      {
        keyword: 'additionalProperties',
        dataPath: '',
        schemaPath: '#/additionalProperties',
        params: {
          additionalProperty: 'originalDate',
        },
        message: 'should NOT have additional properties',
      },
    ],
  },
};

export type GetOpenApiParams = { kind?: string };

export const GetOpenApiParamsSchema: JSONSchemaType<GetOpenApiParams> = {
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: { kind: { type: 'string' } },
};
