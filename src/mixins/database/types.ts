import type {
  BulkWriteOptions,
  CountDocumentsOptions,
  DeleteOptions,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  FindOptions,
  UpdateOptions,
  Document,
  WithId,
  OptionalId,
} from 'mongodb';

export type DatabaseSoftDeleteScope =
  | 'include-deleted'
  | 'only-deleted'
  | 'no-deleted';

/**
 * Options used on read only operations on the database mixin.
 * Wrapper around mongodb's FindOptions that is easier for us to use.
 */
export type DatabaseFindOptions = Omit<FindOptions, 'projection' | 'sort'> & {
  // Replace projection with fields that is similar to the sort option.
  fields?: string[];
  // Force sort option to be an array. This array is different from the driver's one.
  // It is a list of fields to sort on, with a - prefix to sort in descending order.
  sort?: string[];
  // Scope used for soft delete. (no-deleted by default)
  scope?: DatabaseSoftDeleteScope;
  // If false, will allow to query documents without tenant field (default: true).
  strictTenantFilter?: boolean;
};

/**
 * Options used on count operations on the database mixin.
 */
export type DatabaseCountOptions = CountDocumentsOptions & {
  // Scope used for soft delete. (no-deleted by default)
  scope?: DatabaseSoftDeleteScope;
  // If false, will allow to count documents without tenant field (default: true).
  strictTenantFilter?: boolean;
};

/**
 * Options used on insertOne operations.
 * Wrapper around findOneAndUpdate options as we don't use insertOne directly but findOneAndUpdate with upsert.
 */
export type DatabaseInsertOneOptions = Omit<
  FindOneAndUpdateOptions,
  // Remove arrayFilters as we use an aggregation update pipeline (see https://www.mongodb.com/docs/manual/reference/method/db.collection.findOneAndUpdate/#array-update-operations-with-arrayfilters).
  'upsert' | 'returnDocument' | 'sort' | 'hint' | 'projection' | 'arrayFilters'
> & {
  // Replace projection with fields that is similar to the sort option.
  fields?: string[];
  // Allow caller to skip create event (default: false).
  skipCreateEvent?: boolean;
};

/**
 * Options used on insertMany operations.
 */
export type DatabaseInsertManyOptions = BulkWriteOptions & {
  // Allow caller to skip create event (default: false).
  skipCreateEvent?: boolean;
};

/**
 * Options used on updateOne operations.
 */
export type DatabaseUpdateOneOptions = Omit<
  FindOneAndUpdateOptions,
  'sort' | 'projection'
> & {
  // Replace projection with fields that is similar to the sort option.
  fields?: string[];
  // Force sort option to be an array. This array is different from the driver's one.
  // It is a list of fields to sort on, with a - prefix to sort in descending order.
  sort?: string[];
  // If false, will allow to update documents without tenant field in query (default: true).
  strictTenantFilter?: boolean;
  // Allow caller to skip update event (default: false).
  skipUpdateEvent?: boolean;
};

/**
 * Options used on updateMany operations.
 */
export type DatabaseUpdateManyOptions = UpdateOptions & {
  // If false, will allow to update documents without tenant field in query (default: true).
  strictTenantFilter?: boolean;
};

/**
 * Options used on deleteOne operations.
 * If soft delete is enabled, the document will be updated with a deletedAt field.
 */
export type DatabaseReplaceOneOptions = Omit<
  FindOneAndReplaceOptions,
  'projection' | 'sort'
> & {
  // Replace projection with fields that is similar to the sort option.
  fields?: string[];
  // Force sort option to be an array. This array is different from the driver's one.
  // It is a list of fields to sort on, with a - prefix to sort in descending order.
  sort?: string[];
  // If false, will allow to delete documents without tenant field (default: true).
  strictTenantFilter?: boolean;
  // Allow caller to skip update event (default: false).
  skipUpdateEvent?: boolean;
};

/**
 * Options used on deleteOne operations.
 * If soft delete is enabled, the document will be updated with a deletedAt field.
 */
export type DatabaseDeleteOneOptions = Omit<
  FindOneAndDeleteOptions,
  'projection' | 'sort'
> & {
  // Replace projection with fields that is similar to the sort option.
  fields?: string[];
  // Force sort option to be an array. This array is different from the driver's one.
  // It is a list of fields to sort on, with a - prefix to sort in descending order.
  sort?: string[];
  // If false, will allow to delete documents without tenant field (default: true).
  strictTenantFilter?: boolean;
  // Allow caller to skip delete event (default: false).
  skipDeleteEvent?: boolean;
};

/**
 * Options used on deleteMany operations.
 * If soft delete is enabled, the document will be updated with a deletedAt field.
 */
export type DatabaseDeleteManyOptions = DeleteOptions & {
  // If false, will allow to delete documents without tenant field (default: true).
  strictTenantFilter?: boolean;
};

/**
 * Type of the event sent by the database mixin on insert.
 * For insertMany, it will be sent once per document.
 */
export type DatabaseEventInsert<TSchema extends Document> = {
  type: 'insert';
  // Inserted document.
  document: WithDbFields<TSchema>;
};

/**
 * Type of the event sent by the database mixin on update.
 * No event is sent on updateMany.
 */
export type DatabaseEventUpdate<TSchema extends Document> = {
  type: 'update' | 'replace';
  // The document AFTER the update.
  document: WithDbFields<TSchema>;
};
/**
 * Type of the event sent by the database mixin on update.
 * No event is sent on deleteMany.
 */
export type DatabaseEventDelete<TSchema extends Document> = {
  type: 'delete';
  // The deleted document.
  document: WithDbFields<TSchema>;
};

/**
 * Helper function that gives the type of document returned from the database.
 * It will add _id, createdAt and updatedAt fields if they are not already present.
 */
export type WithDbFields<TSchema extends Document> = TSchema &
  WithId<TSchema> &
  (TSchema extends { createdAt?: Date }
    ? TSchema extends { updatedAt?: Date }
      ? { createdAt: Date; updatedAt: Date }
      : NonNullable<unknown>
    : NonNullable<unknown>);

export type WithOptionalId<T> = OptionalId<T>;
