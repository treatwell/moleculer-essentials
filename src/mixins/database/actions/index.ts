import type { Document, ObjectId } from 'mongodb';
import type { Context, Service } from 'moleculer';
import type { Readable } from 'stream';
import { ZodType } from 'zod/v4';
import { createOpenAPIResponses } from '../../../openapi/index.js';
import type {
  DatabaseActionNames,
  DatabaseActionPublishedNames,
  DatabaseMethodsOptions,
  KeyString,
  TenantParams,
} from '../mixin-types.js';
import type {
  DatabaseActionCountInternalParams,
  DatabaseActionCountParams,
  DatabaseActionCreateParams,
  DatabaseActionFindParams,
  DatabaseActionFindResult,
  DatabaseActionGetInternalParams,
  DatabaseActionGetParams,
  DatabaseActionEntityResult,
  DatabaseActionListParams,
  DatabaseActionListResult,
  DatabaseActionRemoveParams,
  DatabaseActionUpdateParams,
} from './types.js';
import { DatabaseMethodsMixin } from '../methods.js';
import { EntityNotFoundError } from '../errors.js';
import type { CustomActionSchema } from '../../../types/actions.js';
import { AjvActionSchemaFactory } from './ajv.js';
import { parseAndValidateQuery } from './helpers.js';
import { ActionSchemaFactory } from './shared.js';
import { ZodActionSchemaFactory } from './zod.js';

type DatabaseActionThis<
  TSchema extends Document & { _id: ObjectId | string },
  TenantField extends KeyString<TSchema> | false = false,
> = Service &
  ReturnType<typeof DatabaseMethodsMixin<TSchema, TenantField>>['methods'];

const PUBLISHABLE_ACTIONS: DatabaseActionPublishedNames[] = [
  'get',
  'count',
  'list',
  'create',
  'update',
  'remove',
];

/**
 * Create the actions for the database mixin.
 * Read operations:
 * - find (max public)
 * - findStream (max public)
 * - getInternal (max public)
 * - get
 * - countInternal (max public)
 * - count
 * - list
 *
 * Write operations:
 * - create
 * - update
 * - remove
 *
 * If some actions are not provided here, it probably means that they are not necessary.
 * For example, there is no `findAllStream` or `updateMany` actions. This is because they are not used
 * often and is quite specific to the related service.
 */
export function createActions<
  TSchema extends Document & { _id: ObjectId | string },
  TenantField extends KeyString<TSchema> | false = false,
>(
  opts: DatabaseMethodsOptions<TSchema, TenantField>,
): Partial<Record<DatabaseActionNames, CustomActionSchema>> {
  const actions: Partial<Record<DatabaseActionNames, CustomActionSchema>> = {};

  const factory: ActionSchemaFactory =
    opts.actions?.schemaFactory ||
    (opts.actions?.schema instanceof ZodType
      ? new ZodActionSchemaFactory({
          schemaName: opts.actions.schemaName,
          schema: opts.actions.schema,
          timestamps: opts.timestamps,
          softDelete: opts.softDelete,
          tenantField: opts.tenantField,
        })
      : new AjvActionSchemaFactory<TSchema>({
          schemaName: opts.actions?.schemaName,
          schema: opts.actions?.schema,
          timestamps: opts.timestamps,
          softDelete: opts.softDelete,
          tenantField: opts.tenantField,
        }));

  // Check that we have what we need in options
  for (const action of PUBLISHABLE_ACTIONS) {
    if (opts.actions?.[action]) {
      if (!opts.actions.schema) {
        throw new Error(`Missing schema for action ${action}`);
      }
      if (!factory.hasIdField()) {
        throw new Error(`Missing _id for action ${action}`);
      }
      if (opts.tenantField && !factory.hasTenantIdField()) {
        throw new Error(`Missing ${opts.tenantField} for action ${action}`);
      }
    }
  }

  const schemaName = opts.actions?.schemaName;

  if (opts.actions?.find) {
    actions.find = {
      visibility: opts.actions.find.visibility,
      params: factory.createFindParams(),
      async handler(
        this: DatabaseActionThis<TSchema, TenantField>,
        ctx: Context<DatabaseActionFindParams<TSchema, TenantField>>,
      ): Promise<DatabaseActionFindResult<TSchema>> {
        const { query, fields, offset, sort, limit, collation } = ctx.params;

        let params: TenantParams<TSchema, TenantField> = null;
        if (opts.tenantField) {
          // @ts-expect-error TenantField is not always here and TS doesn't like it
          params = { [opts.tenantField]: ctx.params[opts.tenantField] };
        }

        return this._find(query || {}, params, {
          fields,
          sort,
          limit,
          skip: offset,
          collation,
          // @ts-expect-error Scope is not always here and TS doesn't like it
          scope: ctx.params.scope,
        });
      },
    };
  }

  if (opts.actions?.findStream) {
    actions.findStream = {
      visibility: opts.actions.findStream.visibility,
      params: factory.createFindParams(),
      async handler(
        this: DatabaseActionThis<TSchema, TenantField>,
        ctx: Context<DatabaseActionFindParams<TSchema, TenantField>>,
      ): Promise<Readable> {
        const { query, fields, offset, sort, limit, collation } = ctx.params;

        let params: TenantParams<TSchema, TenantField> = null;
        if (opts.tenantField) {
          // @ts-expect-error TenantField is not always here and TS doesn't like it
          params = { [opts.tenantField]: ctx.params[opts.tenantField] };
        }

        return this._findStream(query || {}, params, {
          fields,
          sort,
          limit,
          skip: offset,
          collation,
          // @ts-expect-error Scope is not always here and TS doesn't like it
          scope: ctx.params.scope,
        });
      },
    };
  }

  if (opts.actions?.getInternal) {
    actions.getInternal = {
      visibility: opts.actions.getInternal.visibility,
      params: factory.createGetParams({ allowFields: true }),
      async handler(
        this: DatabaseActionThis<TSchema, TenantField>,
        ctx: Context<DatabaseActionGetInternalParams<TSchema, TenantField>>,
      ): Promise<DatabaseActionEntityResult<TSchema>> {
        const { fields, _id } = ctx.params;

        let params: TenantParams<TSchema, TenantField> = null;
        if (opts.tenantField) {
          // @ts-expect-error TenantField is not always here and TS doesn't like it
          params = { [opts.tenantField]: ctx.params[opts.tenantField] };
        }

        // @ts-expect-error mongo require weird typing for _id making it fail
        const res = await this._findOne({ _id }, params, {
          fields,
          // @ts-expect-error Scope is not always here and TS doesn't like it
          scope: ctx.params.scope,
        });

        if (!res) {
          throw new EntityNotFoundError(_id.toString());
        }
        return res;
      },
    };
  }

  if (opts.actions?.get) {
    actions.get = {
      rest: 'GET /:_id',
      openapi: createOpenAPIResponses(factory.createSchemaWithDbFields()),
      visibility: opts.actions.get.visibility,
      params: factory.createGetParams({ allowFields: false }),
      async handler(
        this: DatabaseActionThis<TSchema, TenantField>,
        ctx: Context<DatabaseActionGetParams<TSchema, TenantField>>,
      ): Promise<DatabaseActionEntityResult<TSchema>> {
        const { _id } = ctx.params;

        let params: TenantParams<TSchema, TenantField> = null;
        if (opts.tenantField) {
          // @ts-expect-error TenantField is not always here and TS doesn't like it
          params = { [opts.tenantField]: ctx.params[opts.tenantField] };
        }

        // @ts-expect-error mongo require weird typing for _id making it fail
        const res = await this._findOne({ _id }, params, {
          // @ts-expect-error Scope is not always here and TS doesn't like it
          scope: ctx.params.scope,
        });

        if (!res) {
          throw new EntityNotFoundError(_id.toString());
        }
        return res;
      },
    };
  }

  if (opts.actions?.countInternal) {
    actions.countInternal = {
      visibility: opts.actions.countInternal.visibility,
      params: factory.createCountParams({ queryType: 'object' }),
      async handler(
        this: DatabaseActionThis<TSchema, TenantField>,
        ctx: Context<DatabaseActionCountInternalParams<TSchema, TenantField>>,
      ): Promise<number> {
        const { query } = ctx.params;

        let params: TenantParams<TSchema, TenantField> = null;
        if (opts.tenantField) {
          // @ts-expect-error TenantField is not always here and TS doesn't like it
          params = { [opts.tenantField]: ctx.params[opts.tenantField] };
        }
        return this._countDocuments(query || {}, params, {
          // @ts-expect-error Scope is not always here and TS doesn't like it
          scope: ctx.params.scope,
        });
      },
    };
  }

  if (opts.actions?.count) {
    actions.count = {
      rest: 'GET /count',
      openapi: createOpenAPIResponses({ type: 'integer' }),
      visibility: opts.actions.count.visibility,
      params: factory.createCountParams({ queryType: 'stringified' }),
      async handler(
        this: DatabaseActionThis<TSchema, TenantField>,
        ctx: Context<DatabaseActionCountParams<TSchema, TenantField>>,
      ): Promise<number> {
        const { sQuery } = ctx.params;

        const query = parseAndValidateQuery(
          this.broker.validator!,
          opts.sQuerySchema,
          sQuery,
        );

        let params: TenantParams<TSchema, TenantField> = null;
        if (opts.tenantField) {
          // @ts-expect-error TenantField is not always here and TS doesn't like it
          params = { [opts.tenantField]: ctx.params[opts.tenantField] };
        }
        return this._countDocuments(query, params, {
          // @ts-expect-error Scope is not always here and TS doesn't like it
          scope: ctx.params.scope,
        });
      },
    };
  }

  if (opts.actions?.list) {
    actions.list = {
      rest: 'GET /',
      openapi: createOpenAPIResponses(factory.createListResponse()),
      visibility: opts.actions.list.visibility,
      params: factory.createListParams({
        queryType: 'stringified',
        maxPageSize: opts.actions.list.maxPageSize,
      }),
      async handler(
        this: DatabaseActionThis<TSchema, TenantField>,
        ctx: Context<DatabaseActionListParams<TSchema, TenantField>>,
      ): Promise<DatabaseActionListResult<TSchema>> {
        const {
          sQuery,
          sort = opts.actions?.list?.defaultSort,
          collation,
        } = ctx.params;

        const query = parseAndValidateQuery(
          this.broker.validator!,
          opts.sQuerySchema,
          sQuery,
        );

        let params: TenantParams<TSchema, TenantField> = null;
        if (opts.tenantField) {
          // @ts-expect-error TenantField is not always here and TS doesn't like it
          params = { [opts.tenantField]: ctx.params[opts.tenantField] };
        }
        const page = ctx.params.page || 0;
        const pageSize =
          ctx.params.pageSize || opts.actions?.list?.defaultPageSize || 10;

        const [rows, total] = await Promise.all([
          this._find(query, params, {
            limit: pageSize,
            skip: page * pageSize,
            sort,
            // @ts-expect-error Scope is not always here and TS doesn't like it
            scope: ctx.params.scope,
            collation,
          }),
          this._countDocuments(query, params, {
            // @ts-expect-error Scope is not always here and TS doesn't like it
            scope: ctx.params.scope,
            collation,
          }),
        ]);

        return {
          rows,
          page,
          pageSize,
          total,
          totalPages: Math.floor((total + pageSize - 1) / pageSize),
        };
      },
    };
  }

  if (opts.actions?.create) {
    actions.create = {
      rest: 'POST /',
      openapi: createOpenAPIResponses(factory.createSchemaWithDbFields()),
      visibility: opts.actions.create.visibility,
      bodySchemaRefName: schemaName && `Create${schemaName}`,
      params: factory.createCreateParams({
        allowClientId: opts.actions.create.allowClientId,
      }),
      handler(
        this: DatabaseActionThis<TSchema, TenantField>,
        ctx: Context<DatabaseActionCreateParams<TSchema>>,
      ): Promise<DatabaseActionEntityResult<TSchema>> {
        return this._insertOne(ctx, ctx.params);
      },
    };
  }

  if (opts.actions?.update) {
    actions.update = {
      rest: 'PATCH /:_id',
      openapi: createOpenAPIResponses(factory.createSchemaWithDbFields()),
      visibility: opts.actions.update.visibility,
      params: factory.createUpdateParams(),
      handler(
        this: DatabaseActionThis<TSchema, TenantField>,
        ctx: Context<DatabaseActionUpdateParams<TSchema, TenantField>>,
      ): Promise<DatabaseActionEntityResult<TSchema>> {
        let params: TenantParams<TSchema, TenantField> = null;
        if (opts.tenantField) {
          // @ts-expect-error TenantField is not always here and TS doesn't like it
          params = { [opts.tenantField]: ctx.params[opts.tenantField] };
        }

        // @ts-expect-error TenantField is not always here and TS doesn't like it
        return this._updateOne(ctx, { _id: ctx.params._id }, params, {
          $set: ctx.params,
        });
      },
    };
  }

  if (opts.actions?.remove) {
    actions.remove = {
      rest: 'DELETE /:_id',
      openapi: createOpenAPIResponses(factory.createSchemaWithDbFields()),
      visibility: opts.actions.remove.visibility,
      params: factory.createRemoveParams(),
      handler(
        this: DatabaseActionThis<TSchema, TenantField>,
        ctx: Context<DatabaseActionRemoveParams<TSchema>>,
      ): Promise<DatabaseActionEntityResult<TSchema>> {
        let params: TenantParams<TSchema, TenantField> = null;
        if (opts.tenantField) {
          // @ts-expect-error TenantField is not always here and TS doesn't like it
          params = { [opts.tenantField]: ctx.params[opts.tenantField] };
        }

        // @ts-expect-error For some reason, _id is not correctly typed by mongo in some cases
        return this._deleteOne(ctx, { _id: ctx.params._id }, params);
      },
    };
  }
  return actions;
}
