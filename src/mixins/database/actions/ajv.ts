import { Document } from 'mongodb';
import {
  COERCE_ARRAY_ATTRIBUTE,
  JSONSchemaType,
  OBJECTID_TYPE,
  SCHEMA_REF_NAME,
} from '../../../json-schema/index.js';
import { ValidationSchema } from '../../../validator/types.js';
import { removeMongoId } from '../helpers.js';
import {
  ActionCountParamsOptions,
  ActionCreateParamsOptions,
  ActionGetParamsOptions,
  ActionListParamsOptions,
  ActionSchemaFactory,
  ActionSchemaFactoryOptions,
  QueryOp,
} from './shared.js';

export class AjvActionSchemaFactory<TSchema extends Document>
  implements ActionSchemaFactory<ValidationSchema>
{
  private readonly tenantFieldType: ValidationSchema | undefined;

  private readonly _idFieldType: ValidationSchema | undefined;

  constructor(
    private opts: ActionSchemaFactoryOptions<JSONSchemaType<TSchema>, TSchema>,
  ) {
    const { schema, tenantField } = opts;

    if (schema) {
      if (tenantField) {
        this.tenantFieldType = schema.properties[tenantField];
      }
      this._idFieldType = schema.properties._id;
    }
  }

  hasIdField(): boolean {
    return !!this._idFieldType;
  }

  hasTenantIdField(): boolean {
    return !!this.tenantFieldType;
  }

  createSchemaWithDbFields(): ValidationSchema {
    const { timestamps, schema, schemaName } = this.opts;
    if (!schema) {
      throw new Error('Schema is not defined');
    }

    const requiredSet = new Set(schema.required);

    requiredSet.add('_id');
    if (timestamps) {
      requiredSet.add('createdAt');
      requiredSet.add('updatedAt');
    }
    return {
      ...schema,
      [SCHEMA_REF_NAME]: schemaName ? `Full${schemaName}` : undefined,
      required: [...requiredSet.values()],
    };
  }

  createFindParams(): ValidationSchema {
    const { tenantField, softDelete } = this.opts;
    const { tenantFieldType } = this;

    const additionalProps: Record<string, unknown> = {};
    const required: string[] = [];
    if (tenantField && tenantFieldType) {
      required.push(tenantField);
      additionalProps[tenantField] = tenantFieldType;
    }
    if (softDelete) {
      additionalProps.scope = {
        type: 'string',
        enum: ['include-deleted', 'only-deleted', 'no-deleted'],
      };
    }

    return {
      type: 'object',
      additionalProperties: false,
      required,
      properties: {
        query: { type: 'object', additionalProperties: true, required: [] },
        fields: { type: 'array', items: { type: 'string' } },
        sort: { type: 'array', items: { type: 'string' } },
        limit: { type: 'integer', minimum: 0 },
        offset: { type: 'integer', minimum: 0 },
        collation: { type: 'object' },
        ...additionalProps,
      },
    };
  }

  createGetParams(params: ActionGetParamsOptions): ValidationSchema {
    const { _idFieldType, tenantFieldType } = this;
    const { tenantField, softDelete } = this.opts;
    const { allowFields } = params;

    const additionalProps: Record<string, unknown> = {};
    const required: string[] = ['_id'];
    if (tenantField && tenantFieldType) {
      required.push(tenantField);
      additionalProps[tenantField] = tenantFieldType;
    }
    if (softDelete) {
      additionalProps.scope = {
        type: 'string',
        enum: ['include-deleted', 'only-deleted', 'no-deleted'],
      };
    }

    if (allowFields) {
      additionalProps.fields = { type: 'array', items: { type: 'string' } };
    }

    return {
      type: 'object',
      additionalProperties: false,
      required,
      properties: {
        _id: _idFieldType || OBJECTID_TYPE,
        ...additionalProps,
      },
    };
  }

  createCountParams(params: ActionCountParamsOptions): ValidationSchema {
    const { tenantFieldType } = this;
    const { tenantField, softDelete } = this.opts;
    const { queryType } = params;

    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    if (tenantField && tenantFieldType) {
      required.push(tenantField);
      properties[tenantField] = tenantFieldType;
    }
    if (softDelete) {
      properties.scope = {
        type: 'string',
        enum: ['include-deleted', 'only-deleted', 'no-deleted'],
      };
    }

    if (queryType === 'stringified') {
      properties.sQuery = { type: 'string' };
    } else if (queryType === 'object') {
      properties.query = { type: 'object', additionalProperties: true };
    }

    return {
      type: 'object',
      additionalProperties: false,
      required,
      properties,
    };
  }

  createListParams(params: ActionListParamsOptions): ValidationSchema {
    const { tenantField, softDelete } = this.opts;
    const { tenantFieldType } = this;
    const { queryType, maxPageSize } = params;

    const additionalProperties: Record<string, unknown> = {};
    const required: string[] = [];
    if (tenantField && tenantFieldType) {
      required.push(tenantField);
      additionalProperties[tenantField] = tenantFieldType;
    }
    if (softDelete) {
      additionalProperties.scope = {
        type: 'string',
        enum: ['include-deleted', 'only-deleted', 'no-deleted'],
      };
    }

    if (queryType === 'stringified') {
      additionalProperties.sQuery = { type: 'string' };
    } else if (queryType === 'object') {
      additionalProperties.query = {
        type: 'object',
        additionalProperties: true,
      };
    }

    return {
      type: 'object',
      additionalProperties: false,
      required,
      properties: {
        page: { type: 'integer', minimum: 0 },
        pageSize: {
          type: 'integer',
          minimum: 1,
          maximum: maxPageSize || 100,
        },
        sort: {
          type: 'array',
          items: { type: 'string' },
          [COERCE_ARRAY_ATTRIBUTE]: true,
        },
        ...additionalProperties,
      },
    };
  }

  createListResponse(): ValidationSchema {
    return {
      type: 'object',
      required: ['rows', 'page', 'pageSize', 'total', 'totalPages'],
      additionalProperties: false,
      properties: {
        rows: { type: 'array', items: this.createSchemaWithDbFields() },
        page: { type: 'integer', minimum: 0 },
        pageSize: { type: 'integer', minimum: 1 },
        total: { type: 'integer', minimum: 0 },
        totalPages: { type: 'integer', minimum: 0 },
      },
    };
  }

  createCreateParams(params: ActionCreateParamsOptions): ValidationSchema {
    const { schema } = this.opts;
    const { allowClientId } = params;

    if (!schema) {
      throw new Error('Schema is not defined');
    }
    if (allowClientId) {
      return schema;
    }
    // @ts-expect-error _id is checked before
    return removeMongoId(schema);
  }

  createUpdateParams(): ValidationSchema {
    const { tenantField, schema } = this.opts;
    if (!schema) {
      throw new Error('Schema is not defined');
    }

    const required = ['_id'];
    if (tenantField) {
      required.push(tenantField);
    }
    return { ...schema, required };
  }

  createRemoveParams(): ValidationSchema {
    const { tenantFieldType, _idFieldType } = this;
    const { tenantField } = this.opts;

    const required = ['_id'];
    const additionalProps: Record<string, unknown> = {};
    if (tenantField && tenantFieldType) {
      required.push(tenantField);
      additionalProps[tenantField] = tenantFieldType;
    }

    return {
      type: 'object',
      additionalProperties: false,
      required,
      properties: {
        _id: _idFieldType || OBJECTID_TYPE,
        ...additionalProps,
      },
    };
  }
}

export function addQueryOps<T>(
  schema: JSONSchemaType<T>,
  queryOps: QueryOp[],
): JSONSchemaType<unknown> {
  const ops = Object.fromEntries(queryOps.map(op => [op, true]));
  return {
    oneOf: [
      schema,
      {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: {
          ...(ops[QueryOp.GT] ? { $gt: schema } : {}),
          ...(ops[QueryOp.GTE] ? { $gte: schema } : {}),
          ...(ops[QueryOp.LT] ? { $lt: schema } : {}),
          ...(ops[QueryOp.LTE] ? { $lte: schema } : {}),
          ...(ops[QueryOp.IN] ? { $in: { type: 'array', items: schema } } : {}),
          ...(ops[QueryOp.EQ] ? { $eq: schema } : {}),
          ...(ops[QueryOp.NE] ? { $ne: schema } : {}),
        },
      },
    ],
  } as JSONSchemaType<unknown>;
}
