import type { Document } from 'mongodb';
import { z, ZodObject, ZodType } from 'zod/v4';
import { zodCoerceArray, zodObjectId } from '../../../zod/zod-helpers.js';
import {
  type ActionCountParamsOptions,
  type ActionCreateParamsOptions,
  type ActionGetParamsOptions,
  type ActionListParamsOptions,
  type ActionSchemaFactory,
  type ActionSchemaFactoryOptions,
  QueryOp,
} from './shared.js';

const ScopeSchema = z.enum(['include-deleted', 'only-deleted', 'no-deleted']);

export class ZodActionSchemaFactory<TSchema extends Document>
  implements ActionSchemaFactory<ZodType>
{
  private readonly tenantFieldType: ZodType | undefined;

  private readonly _idFieldType: ZodType | undefined;

  private schemaWithDbFields: ZodType | undefined;

  constructor(private opts: ActionSchemaFactoryOptions<ZodType, TSchema>) {
    const { schema, tenantField } = opts;
    if (schema) {
      if (!(schema instanceof ZodObject)) {
        throw new Error('Schema must be a ZodObject');
      }
      if (tenantField) {
        this.tenantFieldType = schema.shape[tenantField];
      }
      this._idFieldType = schema.shape._id;
    }
  }

  hasIdField(): boolean {
    return !!this._idFieldType;
  }

  hasTenantIdField(): boolean {
    return !!this.tenantFieldType;
  }

  createSchemaWithDbFields(): ZodType {
    if (this.schemaWithDbFields) {
      return this.schemaWithDbFields;
    }
    const { timestamps, schema, schemaName } = this.opts;
    if (!schema || !(schema instanceof ZodObject)) {
      throw new Error('Schema is not a ZodObject');
    }
    let res = schema.required({ _id: true });
    if (timestamps) {
      res = res.required({ createdAt: true, updatedAt: true });
    }
    if (schemaName) {
      res = res.meta({ id: `Full${schemaName}` });
    }
    this.schemaWithDbFields = res;
    return res;
  }

  createFindParams(): ZodType {
    const { tenantField, softDelete } = this.opts;
    const { tenantFieldType } = this;

    const shape: Record<string, ZodType> = {
      query: z.looseObject({}).optional(),
      fields: z.array(z.string()).optional(),
      sort: z.array(z.string()).optional(),
      limit: z.uint32().optional(),
      offset: z.uint32().optional(),
      collation: z.looseObject({}).optional(),
    };

    if (tenantField && tenantFieldType) {
      shape[tenantField] = tenantFieldType;
    }
    if (softDelete) {
      shape.scope = ScopeSchema.optional();
    }

    return z.object(shape);
  }

  createGetParams(params: ActionGetParamsOptions): ZodType {
    const { _idFieldType, tenantFieldType } = this;
    const { tenantField, softDelete } = this.opts;
    const { allowFields } = params;

    const shape: Record<string, ZodType> = {
      _id: _idFieldType || zodObjectId,
    };

    if (tenantField && tenantFieldType) {
      shape[tenantField] = tenantFieldType;
    }
    if (softDelete) {
      shape.scope = ScopeSchema.optional();
    }
    if (allowFields) {
      shape.fields = z.array(z.string()).optional();
    }

    return z.object(shape);
  }

  createCountParams(params: ActionCountParamsOptions): ZodType {
    const { tenantFieldType } = this;
    const { tenantField, softDelete } = this.opts;
    const { queryType } = params;

    const shape: Record<string, ZodType> = {};

    if (queryType === 'stringified') {
      shape.sQuery = z.string().optional();
    } else if (queryType === 'object') {
      shape.query = z.looseObject({}).optional();
    }

    if (tenantField && tenantFieldType) {
      shape[tenantField] = tenantFieldType;
    }
    if (softDelete) {
      shape.scope = ScopeSchema.optional();
    }

    return z.object(shape);
  }

  createListParams(params: ActionListParamsOptions): ZodType {
    const { tenantField, softDelete } = this.opts;
    const { tenantFieldType } = this;
    const { queryType, maxPageSize } = params;

    const shape: Record<string, ZodType> = {
      page: z.coerce.number().int().min(0).optional(),
      pageSize: z.coerce
        .number()
        .int()
        .min(1)
        .max(maxPageSize || 100)
        .optional(),
      sort: zodCoerceArray(z.string()).optional(),
    };

    if (queryType === 'stringified') {
      shape.sQuery = z.string().optional();
    } else if (queryType === 'object') {
      shape.query = z.looseObject({}).optional();
    }

    if (tenantField && tenantFieldType) {
      shape[tenantField] = tenantFieldType;
    }
    if (softDelete) {
      shape.scope = ScopeSchema.optional();
    }

    return z.object(shape);
  }

  createListResponse(): ZodType {
    return z.strictObject({
      rows: z.array(this.createSchemaWithDbFields()),
      page: z.uint32(),
      pageSize: z.int().min(1),
      total: z.uint32(),
      totalPages: z.uint32(),
    });
  }

  createCreateParams(params: ActionCreateParamsOptions): ZodType {
    const { schema } = this.opts;
    const { allowClientId } = params;

    if (!schema || !(schema instanceof ZodObject)) {
      throw new Error('Schema is not a ZodObject');
    }
    if (allowClientId) {
      return schema;
    }
    return schema.omit({ _id: true });
  }

  createUpdateParams(): ZodType {
    const { tenantField, schema } = this.opts;
    if (!schema || !(schema instanceof ZodObject)) {
      throw new Error('Schema is not a ZodObject');
    }

    const mask: Record<string, true> = { _id: true };
    if (tenantField) {
      mask[tenantField] = true;
    }
    return schema.partial().required(mask);
  }

  createRemoveParams(): ZodType {
    const { tenantFieldType, _idFieldType } = this;
    const { tenantField } = this.opts;

    const shape: Record<string, ZodType> = {
      _id: _idFieldType || zodObjectId,
    };
    if (tenantField && tenantFieldType) {
      shape[tenantField] = tenantFieldType;
    }

    return z.object(shape);
  }
}

export function addZodQueryOps(
  fieldValue: ZodType,
  queryOps: QueryOp[],
): ZodType {
  const shape: Partial<Record<QueryOp, ZodType>> = {};
  for (const op of queryOps) {
    if (op === QueryOp.IN) {
      shape.$in = z.array(fieldValue).optional();
    } else {
      shape[op] = fieldValue.optional();
    }
  }

  return z.union([fieldValue, z.object(shape)]);
}
