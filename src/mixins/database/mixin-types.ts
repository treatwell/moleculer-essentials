import type { Document, InferIdType, ObjectId, WithoutId } from 'mongodb';
import type { ActionVisibility } from 'moleculer';
import { ZodObject, ZodType } from 'zod/v4';
import type { JSONSchemaType } from '../../json-schema/index.js';
import type { ValidationSchema } from '../../validator/types.js';
import type { ActionSchemaFactory } from './actions/shared.js';

/**
 * Utility type to extract the string keys of a type.
 */
export type KeyString<T> = Extract<keyof T, string>;

export type TenantParams<
  TSchema extends Document,
  TenantField extends KeyString<TSchema> | false,
> =
  | (TenantField extends KeyString<TSchema> ? Pick<TSchema, TenantField> : null)
  | null;

export type DatabaseMethodsOptions<
  TSchema extends Document,
  TenantField extends KeyString<TSchema> | false,
> = {
  /**
   * Name of the field that will be required to be present in all documents.
   * This will be used in read queries as a filter to ensure that the user
   * can only access documents that belong to the same tenant.
   *
   * This field can only be top-level and should probably be indexed.
   */
  tenantField: TenantField;

  /**
   * Enable soft-delete for the model.
   * The remove method will only set the deletedAt field to NOW.
   * And a new `scope` field will be read to be able to read deleted documents.
   *
   * Note that if schema has a deletedAt field, you are required to set this option to true.
   */
  softDelete: TSchema extends { deletedAt?: Date } ? true : false;

  /**
   * Enable timestamps for the model.
   * Will automatically set the createdAt and updatedAt fields on write operations.
   *
   * Note that if schema has both createdAt and updatedAt field, you are required to set this option to true.
   */
  timestamps: TSchema extends { createdAt?: Date }
    ? TSchema extends { updatedAt?: Date }
      ? true
      : false
    : false;

  /**
   * Note that this function will be applied ONLY on insert operations.
   */
  idGenerator?: (doc: WithoutId<TSchema>) => InferIdType<TSchema>;

  /**
   * Prefix used for events.
   * If not specified, will disable events.
   *
   * Here is the list of events:
   * - `${eventPrefix}.created`: Sent on insertOne and insertMany
   * - `${eventPrefix}.updated`: Sent on updateOne and replaceOne
   * - `${eventPrefix}.deleted`: Sent on deleteOne
   */
  eventPrefix?: string;

  /**
   * The sQuerySchema variable is an optional parameter used for validation.
   * This is used to parse the sQuery parameter on list and count actions.
   * If omitted, sQuery will be silently discarded.
   * It uses the same validator than on actions.
   * The schema will not be published on the openAPI.
   * See addQueryOps for easy support of some mongo operators.
   */
  sQuerySchema?: ValidationSchema | ZodType;

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
  actions?: DatabaseActionOptions<TSchema>;
};

type DatabaseActionVisibility<T extends DatabaseActionNames> =
  T extends DatabaseActionInternalNames
    ? Exclude<ActionVisibility, 'published'>
    : ActionVisibility;

export type DatabaseActionOptions<
  TSchema extends Document & { _id?: ObjectId | string },
> = {
  [key in DatabaseActionNames]?: {
    visibility: DatabaseActionVisibility<key>;
  } & (key extends 'list'
    ? { maxPageSize?: number; defaultPageSize?: number; defaultSort?: string[] }
    : NonNullable<unknown>) &
    (key extends 'create' ? { allowClientId?: boolean } : NonNullable<unknown>);
} & {
  schema?: JSONSchemaType<TSchema> | ZodObject;
  schemaFactory?: ActionSchemaFactory;
  schemaName?: string;
};

export type DatabaseActionInternalNames =
  | 'find'
  | 'findStream'
  | 'getInternal'
  | 'countInternal';

export type DatabaseActionPublishedNames =
  | 'count'
  | 'list'
  | 'get'
  | 'create'
  | 'update'
  | 'remove';

export type DatabaseActionNames =
  | DatabaseActionInternalNames
  | DatabaseActionPublishedNames;
