import type { Document } from 'mongodb';
import { ZodType } from 'zod/v4';
import type { ValidationSchema } from '../../../validator/types.js';
import type { KeyString } from '../mixin-types.js';

export enum QueryOp {
  GT = '$gt',
  GTE = '$gte',
  LT = '$lt',
  LTE = '$lte',
  IN = '$in',
  EQ = '$eq',
  NE = '$ne',
}

export type ActionGetParamsOptions = { allowFields?: boolean };

export type ActionCountParamsOptions = { queryType: 'object' | 'stringified' };

export type ActionListParamsOptions = {
  queryType: 'object' | 'stringified';
  maxPageSize?: number;
};

export type ActionCreateParamsOptions = { allowClientId?: boolean };

export type ActionSchemaFactoryOptions<S, TSchema extends Document> = {
  schemaName?: string;
  schema?: S;
  timestamps: boolean;
  softDelete: boolean;
  tenantField: KeyString<TSchema> | false;
};

export interface ActionSchemaFactory<
  S extends ValidationSchema | ZodType = ValidationSchema | ZodType,
> {
  hasIdField(): boolean;
  hasTenantIdField(): boolean;

  /**
   * Function that make auto generated fields mandatory.
   */
  createSchemaWithDbFields(): S;

  /**
   * Create the params for the find action.
   */
  createFindParams(): S;

  /**
   * Create get AND getInternal action params.
   */
  createGetParams(params: ActionGetParamsOptions): S;

  /**
   * Create count AND countInternal action params.
   */
  createCountParams(params: ActionCountParamsOptions): S;

  /**
   * Create list action params.
   */
  createListParams(params: ActionListParamsOptions): S;

  /**
   * Create list action result JSON schema.
   */
  createListResponse(): S;

  /**
   * Create 'create' action params.
   */
  createCreateParams(params: ActionCreateParamsOptions): S;

  /**
   * Create 'update' action params.
   */
  createUpdateParams(): S;

  /**
   * Create 'remove' action params.
   */
  createRemoveParams(): S;
}
