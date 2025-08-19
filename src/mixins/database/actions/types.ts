import {
  CollationOptions,
  Document,
  Filter,
  InferIdType,
  ObjectId,
} from 'mongodb';
import { KeyString } from '../mixin-types.js';
import {
  DatabaseSoftDeleteScope,
  WithDbFields,
  WithOptionalId,
} from '../types.js';

export type DatabaseActionFindParams<
  TSchema extends Document & { _id: ObjectId | string },
  TenantField extends KeyString<TSchema> | false = false,
> = {
  // MongoDB Query
  query?: Filter<TSchema>;
  // Fields projection
  fields?: string[];
  // Sort option
  sort?: string[];
  // Pagination
  limit?: number;
  offset?: number;
  // Collation
  collation?: CollationOptions;
} & (TSchema extends { deletedAt?: Date }
  ? { scope?: DatabaseSoftDeleteScope }
  : NonNullable<unknown>) &
  (TenantField extends KeyString<TSchema>
    ? { [key in TenantField]: TSchema[TenantField] }
    : NonNullable<unknown>);

export type DatabaseActionFindResult<TSchema extends Document> = Array<
  WithDbFields<TSchema>
>;

export type DatabaseActionGetInternalParams<
  TSchema extends Document & { _id: ObjectId | string },
  TenantField extends KeyString<TSchema> | false = false,
> = {
  _id: InferIdType<TSchema>;
  // Fields projection
  fields?: string[];
} & (TSchema extends { deletedAt?: Date }
  ? { scope?: DatabaseSoftDeleteScope }
  : NonNullable<unknown>) &
  (TenantField extends KeyString<TSchema>
    ? { [key in TenantField]: TSchema[TenantField] }
    : NonNullable<unknown>);

export type DatabaseActionEntityResult<TSchema extends Document> =
  WithDbFields<TSchema>;

export type DatabaseActionGetParams<
  TSchema extends Document & { _id: ObjectId | string },
  TenantField extends KeyString<TSchema> | false = false,
> = {
  _id: InferIdType<TSchema>;
} & (TSchema extends { deletedAt?: Date }
  ? { scope?: DatabaseSoftDeleteScope }
  : NonNullable<unknown>) &
  (TenantField extends KeyString<TSchema>
    ? { [key in TenantField]: TSchema[TenantField] }
    : NonNullable<unknown>);

export type DatabaseActionCountInternalParams<
  TSchema extends Document & { _id: ObjectId | string },
  TenantField extends KeyString<TSchema> | false = false,
> = {
  // MongoDB Query
  query?: Filter<TSchema>;
} & (TSchema extends { deletedAt?: Date }
  ? { scope?: DatabaseSoftDeleteScope }
  : NonNullable<unknown>) &
  (TenantField extends KeyString<TSchema>
    ? { [key in TenantField]: TSchema[TenantField] }
    : NonNullable<unknown>);

export type DatabaseActionCountParams<
  TSchema extends Document & { _id: ObjectId | string },
  TenantField extends KeyString<TSchema> | false = false,
> = {
  // Stringified MongoDB Query
  sQuery?: string;
} & (TSchema extends { deletedAt?: Date }
  ? { scope?: DatabaseSoftDeleteScope }
  : NonNullable<unknown>) &
  (TenantField extends KeyString<TSchema>
    ? { [key in TenantField]: TSchema[TenantField] }
    : NonNullable<unknown>);

export type DatabaseActionListParams<
  TSchema extends Document & { _id: ObjectId | string },
  TenantField extends KeyString<TSchema> | false = false,
> = {
  // Stringified MongoDB Query
  sQuery?: string;
  // Sort option
  sort?: string[];
  // Pagination
  page?: number;
  pageSize?: number;
  // Collation
  collation?: CollationOptions;
} & (TSchema extends { deletedAt?: Date }
  ? { scope?: DatabaseSoftDeleteScope }
  : NonNullable<unknown>) &
  (TenantField extends KeyString<TSchema>
    ? { [key in TenantField]: TSchema[TenantField] }
    : NonNullable<unknown>);

export type DatabaseActionListResult<TSchema extends Document> = {
  rows: Array<TSchema>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DatabaseActionCreateParams<
  TSchema extends Document & { _id: ObjectId | string },
> = WithOptionalId<TSchema>;

export type DatabaseActionUpdateParams<
  TSchema extends Document & { _id: ObjectId | string },
  TenantField extends KeyString<TSchema> | false = false,
> = Partial<TSchema> &
  (TenantField extends KeyString<TSchema>
    ? { [key in TenantField]: TSchema[TenantField] }
    : NonNullable<unknown>);

export type DatabaseActionRemoveParams<
  TSchema extends Document & { _id: ObjectId | string },
  TenantField extends KeyString<TSchema> | false = false,
> = { _id: InferIdType<TSchema> } & (TenantField extends KeyString<TSchema>
  ? { [key in TenantField]: TSchema[TenantField] }
  : NonNullable<unknown>);
