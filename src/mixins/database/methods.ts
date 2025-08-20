import type {
  Collection,
  CollectionOptions,
  Filter,
  FindCursor,
  UpdateFilter,
  UpdateResult,
  Document,
  ObjectId,
  OptionalId,
} from 'mongodb';
import type { Readable } from 'stream';
import type { Context } from 'moleculer';
import { optimizeQuery } from './helpers.js';
import type {
  DatabaseCountOptions,
  DatabaseDeleteManyOptions,
  DatabaseDeleteOneOptions,
  DatabaseInsertManyOptions,
  DatabaseInsertOneOptions,
  DatabaseFindOptions,
  DatabaseReplaceOneOptions,
  DatabaseUpdateManyOptions,
  DatabaseUpdateOneOptions,
  WithDbFields,
  DatabaseEventInsert,
  DatabaseEventUpdate,
  DatabaseEventDelete,
  DatabaseSoftDeleteScope,
} from './types.js';
import type {
  DatabaseMethodsOptions,
  KeyString,
  TenantParams,
} from './mixin-types.js';
import { createActions } from './actions/index.js';
import { wrapMixin } from '../../types/index.js';
import { getQueryFromList } from './restricted-fields.js';

export function DatabaseMethodsMixin<
  TSchema extends Document & { _id: ObjectId | string },
  TenantField extends KeyString<TSchema> | false = false,
>(opts: DatabaseMethodsOptions<TSchema, TenantField>) {
  return wrapMixin({
    methods: {
      /**
       * Helper function that clean an update aggregation pipeline from createdAt changes.
       * Note: This method mutate the array.
       */
      _removeCreatedAtFromUpdateAggregationPipeline(
        changes: UpdateFilter<TSchema>,
      ): void {
        if (!Array.isArray(changes)) {
          return;
        }

        // Possible stages:
        // $addFields / $set
        // $project / $unset
        for (const change of changes) {
          if (change.$addFields?.createdAt !== undefined) {
            delete change.$addFields.createdAt;
          }
          if (change.$set?.createdAt !== undefined) {
            delete change.$set.createdAt;
          }
          if (typeof change.$unset === 'string') {
            change.$unset = [change.$unset];
          }
          if (
            Array.isArray(change.$unset) &&
            change.$unset.includes('createdAt')
          ) {
            change.$unset.splice(change.$unset.indexOf('createdAt'), 1);
            if (change.$unset.length === 0) {
              changes.splice(changes.indexOf(change), 1);
            }
          }
          if (change.$project) {
            let isExcludeMode = false;
            for (const [key, val] of Object.entries(change.$project)) {
              if (key !== '_id' && (val === false || val === 0)) {
                isExcludeMode = true;
                break;
              }
            }
            if (isExcludeMode) {
              delete change.$project.createdAt;
            } else {
              change.$project.createdAt = true;
            }
            if (Object.keys(change.$project).length === 0) {
              changes.splice(changes.indexOf(change), 1);
            }
          }
        }
      },

      /**
       * This method will automatically set the needed operators for our features (timestamps).
       *
       * Limitations of this method:
       * - Dates are generated on the mongo server, except for `update` type with upsert.
       * - It doesn't support $replaceWith/$replaceRoot in an aggregation pipeline except when using type `replace`.
       * - Replaces (`replace` type) can only be done with an aggregation pipeline with a single $replaceWith stage.
       * - Update aggregation pipelines will be modified to let the createdAt field stay the same.
       */
      _prepareUpdateFilter(
        changes: UpdateFilter<TSchema>,
        type: 'create' | 'update' | 'replace',
      ): UpdateFilter<TSchema> {
        if (!opts.timestamps) {
          return changes;
        }

        // Replace operations are kind hard to handle with timestamps
        // The $replaceWith stage will remove all fields so we need to change it a bit to keep our createdAt
        if (type === 'replace') {
          if (
            !Array.isArray(changes) ||
            changes.length !== 1 ||
            !changes[0].$replaceWith
          ) {
            throw new Error(
              'Replace with timestamps can only go through an aggregation pipeline with a single $replaceWith stage',
            );
          }
          return [
            {
              $replaceWith: {
                $mergeObjects: [
                  changes[0].$replaceWith,
                  {
                    createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
                    updatedAt: '$$NOW',
                  },
                ],
              },
            },
          ];
        }

        if (Array.isArray(changes)) {
          // Replace with will remove our timestamp, so we have a fail-safe to prevent this.
          if (
            changes.some(change => change.$replaceWith || change.$replaceRoot)
          ) {
            throw new Error(
              "$replaceWith/$replaceRoot can't be used in an update aggregation pipeline.",
            );
          }

          this._removeCreatedAtFromUpdateAggregationPipeline(changes);

          return [
            ...changes,
            {
              $set: {
                createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
                updatedAt: '$$NOW',
              },
            },
          ];
        }

        // If the changes is a classic update operator,
        // delete from query every update operator that touch to createdAt or updatedAt
        // before adding our own operators.
        for (const operator of Object.values(changes)) {
          for (const key of Object.keys(operator)) {
            if (key === 'createdAt' || key === 'updatedAt') {
              delete operator[key];
            }
          }
        }
        const $currentDate: Record<string, unknown> =
          changes.$currentDate || {};
        const $setOnInsert: Record<string, unknown> =
          changes.$setOnInsert || {};

        $currentDate.updatedAt = true;
        if (type === 'create') {
          $currentDate.createdAt = true;
        } else {
          // If we are updating, we need to be sure that createdAt is created on upsert
          $setOnInsert.createdAt = new Date();
        }

        return {
          ...changes,
          // @ts-expect-error $currentDate is not always here for TS
          $currentDate,
          // @ts-expect-error $setOnInsert is not always here for TS
          $setOnInsert,
        };
      },

      /**
       * Will get the tenant filter from params.
       * This filter should be used in all read queries to ensure that the user
       * can only access documents that belong to the same tenant.
       */
      _getTenantFilter(
        params: TenantParams<TSchema, TenantField>,
        strict: boolean = true,
      ): Filter<TSchema> {
        const { tenantField } = opts;
        if (!tenantField) {
          return {};
        }
        // @ts-expect-error tenantField is not always here for TS
        if (!params?.[tenantField]) {
          if (!strict) {
            return {};
          }
          throw new Error(`Missing tenant field "${tenantField}" in params`);
        }
        // @ts-expect-error tenantField is not always here for TS
        return { [tenantField]: params[tenantField] };
      },

      /**
       * Will get the soft delete filter from params.
       * This filter should be used in all read queries.
       *
       * Indexes should also index the deleted field to ensure optimal performance.
       * Note that in order to support partial indexes, a non deleted field is checked
       * for `false` and `null` values.
       */
      _getSoftDeleteFilter(scope?: DatabaseSoftDeleteScope): Filter<TSchema> {
        if (!opts.softDelete) {
          return {};
        }

        switch (scope) {
          case 'only-deleted':
            // @ts-expect-error deletedAt is not always here for TS
            return { deletedAt: { $gte: 0 } };
          case 'no-deleted':
          case undefined:
            // @ts-expect-error deletedAt is not always here for TS
            return { deletedAt: null };
          case 'include-deleted':
            return {};
          default:
            throw new Error(`Unknown soft delete scope ${scope}`);
        }
      },

      /**
       * Get a query filter optimized ($or problem) with additional filters applied:
       * - Tenant filter
       * - Soft delete filter
       */
      _getQueryFilter(
        query: Filter<TSchema>,
        params: TenantParams<TSchema, TenantField>,
        scope?: DatabaseSoftDeleteScope,
        strictTenantFilter: boolean = true,
      ): Filter<TSchema> {
        return optimizeQuery({
          ...query,
          ...this._getTenantFilter(params, strictTenantFilter),
          ...this._getSoftDeleteFilter(scope),
        });
      },

      /**
       * INTERNAL, DO NOT USE.
       * Simple wrapper around the DatabaseConnectionMixin.getCollection method to have typed collection.
       */
      _getDatabaseMixinCollection(
        options?: CollectionOptions,
      ): Collection<TSchema> {
        return this.getCollection(options);
      },

      /**
       * Create a find cursor with database mixin options applied.
       */
      _createFindCursor(
        query: Filter<TSchema>,
        params: TenantParams<TSchema, TenantField>,
        options: DatabaseFindOptions = {},
      ): FindCursor<WithDbFields<TSchema>> {
        const {
          sort,
          fields,
          scope,
          strictTenantFilter = true,
          ...driverOptions
        } = options;

        return this._getDatabaseMixinCollection().find(
          this._getQueryFilter(query, params, scope, strictTenantFilter),
          {
            ...driverOptions,
            sort: getQueryFromList('sort', sort),
            projection: getQueryFromList('projection', fields),
          },
        ) as FindCursor<WithDbFields<TSchema>>;
      },

      async _findOne(
        query: Filter<TSchema>,
        params: TenantParams<TSchema, TenantField>,
        options?: Omit<DatabaseFindOptions, 'limit' | 'batchSize'>,
      ): Promise<WithDbFields<TSchema> | null> {
        // Use batch size 1 and limit -1 same as https://github.com/mongodb/node-mongodb-native/blob/v6.3.0/src/collection.ts#L487-L495
        const cursor = this._createFindCursor(query, params, {
          ...options,
          limit: -1,
          batchSize: 1,
        });
        const res = await cursor.next();
        await cursor.close();
        return res;
      },

      _find(
        query: Filter<TSchema>,
        params: TenantParams<TSchema, TenantField>,
        options?: DatabaseFindOptions,
      ): Promise<WithDbFields<TSchema>[]> {
        return this._createFindCursor(query, params, options).toArray();
      },

      _findStream(
        query: Filter<TSchema>,
        params: TenantParams<TSchema, TenantField>,
        options?: DatabaseFindOptions,
      ): Readable {
        return this._createFindCursor(query, params, options).stream();
      },

      _countDocuments(
        query: Filter<TSchema>,
        params: TenantParams<TSchema, TenantField>,
        options: DatabaseCountOptions = {},
      ): Promise<number> {
        const { scope, strictTenantFilter = true, ...driverOptions } = options;
        return this._getDatabaseMixinCollection().countDocuments(
          this._getQueryFilter(query, params, scope, strictTenantFilter),
          driverOptions,
        );
      },

      /**
       * Insert one document and return it.
       *
       * It differs from the driver's insertOne as it returns the inserted document and
       * send an event with the new document.
       */
      async _insertOne(
        ctx: Context,
        doc: OptionalId<TSchema>,
        options: DatabaseInsertOneOptions = {},
      ): Promise<WithDbFields<TSchema>> {
        const { fields, skipCreateEvent, ...driverOptions } = options;

        if (opts.idGenerator && !doc._id) {
          doc._id = opts.idGenerator(doc);
        }

        const res = await this._getDatabaseMixinCollection().findOneAndUpdate(
          { _id: { $exists: false } },
          this._prepareUpdateFilter(
            { $setOnInsert: doc as Partial<TSchema> },
            'create',
          ),
          {
            ...driverOptions,
            includeResultMetadata: false, // Document says it's true by default and will be false in a next major
            upsert: true,
            returnDocument: 'after',
            projection: getQueryFromList('projection', fields),
          },
        );
        if (!res) {
          throw new Error("Insert one didn't upsert any document");
        }

        if (opts.eventPrefix && !skipCreateEvent) {
          ctx.emit<DatabaseEventInsert<TSchema>>(
            `${opts.eventPrefix}.created`,
            { type: 'insert', document: res as WithDbFields<TSchema> },
          );
        }

        return res as WithDbFields<TSchema>;
      },

      /**
       * Insert many documents and return the list of inserted ids in the same order.
       */
      async _insertMany(
        ctx: Context,
        docs: OptionalId<TSchema>[],
        options: DatabaseInsertManyOptions = {},
      ): Promise<TSchema['_id'][]> {
        const { skipCreateEvent, ...driverOptions } = options;
        const res = await this._getDatabaseMixinCollection().bulkWrite(
          docs.map(doc => {
            if (opts.idGenerator && !doc._id) {
              doc._id = opts.idGenerator(doc);
            }
            return {
              updateOne: {
                upsert: true,
                filter: { _id: { $exists: false } },
                update: this._prepareUpdateFilter(
                  { $setOnInsert: doc as Partial<TSchema> },
                  'create',
                ),
              },
            };
          }),
          driverOptions,
        );

        if (opts.eventPrefix && !skipCreateEvent) {
          docs.forEach((doc, i) =>
            ctx.emit<DatabaseEventInsert<TSchema>>(
              `${opts.eventPrefix}.created`,
              {
                type: 'insert',
                document: {
                  _id: doc._id || res.upsertedIds[i],
                  ...doc,
                } as WithDbFields<TSchema>,
              },
            ),
          );
        }
        return docs.map((doc, i) => res.upsertedIds[i]);
      },

      /**
       * Update one document and return the after version by default.
       * To have the before version, use the `returnDocument` option.
       *
       * WARNING: Only send an event if returnDocument is 'after'.If returnDocument is 'before',
       * you MUST pass skipUpdateEvent: true and optionally send the event yourself.
       */
      async _updateOne(
        ctx: Context,
        query: Filter<TSchema>,
        params: TenantParams<TSchema, TenantField>,
        changes: UpdateFilter<TSchema>,
        options: DatabaseUpdateOneOptions = {},
      ): Promise<WithDbFields<TSchema> | null> {
        const {
          fields,
          sort,
          strictTenantFilter = true,
          returnDocument = 'after',
          skipUpdateEvent,
          ...driverOptions
        } = options;

        if (
          returnDocument === 'before' &&
          opts.eventPrefix &&
          !skipUpdateEvent
        ) {
          throw new Error(
            'Cannot send update event with returnDocument: before option',
          );
        }

        const res = await this._getDatabaseMixinCollection().findOneAndUpdate(
          this._getQueryFilter(query, params, 'no-deleted', strictTenantFilter),
          this._prepareUpdateFilter(changes, 'update'),
          {
            ...driverOptions,
            returnDocument,
            includeResultMetadata: false, // Document says it's true by default and will be false in a next major
            sort: getQueryFromList('sort', sort),
            projection: getQueryFromList('projection', fields),
          },
        );

        if (res && opts.eventPrefix && !skipUpdateEvent) {
          ctx.emit<DatabaseEventUpdate<TSchema>>(
            `${opts.eventPrefix}.updated`,
            { type: 'update', document: res as WithDbFields<TSchema> },
          );
        }
        return res as WithDbFields<TSchema> | null;
      },

      /**
       * Update many documents and return the number of updated documents.
       *
       * WARNING: Do not send any events. You'll have to send an event yourself.
       */
      async _updateMany(
        query: Filter<TSchema>,
        params: TenantParams<TSchema, TenantField>,
        changes: UpdateFilter<TSchema>,
        options: DatabaseUpdateManyOptions = {},
      ): Promise<UpdateResult<TSchema>> {
        const { strictTenantFilter = true, ...driverOptions } = options;
        return this._getDatabaseMixinCollection().updateMany(
          this._getQueryFilter(query, params, 'no-deleted', strictTenantFilter),
          this._prepareUpdateFilter(changes, 'update'),
          driverOptions,
        );
      },

      /**
       * Replace one document and return the after version by default.
       * To have the before version, use the `returnDocument` option.
       *
       * WARNING: Only send an event if returnDocument is 'after'.If returnDocument is 'before',
       * you MUST pass skipUpdateEvent: true and optionally send the event yourself.
       */
      async _replaceOne(
        ctx: Context,
        query: Filter<TSchema>,
        params: TenantParams<TSchema, TenantField>,
        doc: TSchema,
        options: DatabaseReplaceOneOptions = {},
      ): Promise<WithDbFields<TSchema> | null> {
        const {
          fields,
          sort,
          strictTenantFilter = true,
          returnDocument = 'after',
          skipUpdateEvent,
          ...driverOptions
        } = options;

        if (
          returnDocument === 'before' &&
          opts.eventPrefix &&
          !skipUpdateEvent
        ) {
          throw new Error(
            'Cannot send update event with returnDocument: before option',
          );
        }

        const res = await this._getDatabaseMixinCollection().findOneAndUpdate(
          this._getQueryFilter(query, params, 'no-deleted', strictTenantFilter),
          this._prepareUpdateFilter(
            [{ $replaceWith: { $literal: doc } }],
            'replace',
          ),
          {
            ...driverOptions,
            returnDocument,
            includeResultMetadata: false, // Document says it's true by default and will be false in a next major
            sort: getQueryFromList('sort', sort),
            projection: getQueryFromList('projection', fields),
          },
        );

        if (res && opts.eventPrefix && !skipUpdateEvent) {
          ctx.emit<DatabaseEventUpdate<TSchema>>(
            `${opts.eventPrefix}.updated`,
            { type: 'replace', document: res as WithDbFields<TSchema> },
          );
        }
        return res as WithDbFields<TSchema> | null;
      },

      /**
       * Delete one document and return it.
       * If soft delete is enabled, it will only set the deleted field to true (hiding it from future requests).
       */
      async _deleteOne(
        ctx: Context,
        query: Filter<TSchema>,
        params: TenantParams<TSchema, TenantField>,
        options?: DatabaseDeleteOneOptions,
      ): Promise<WithDbFields<TSchema> | null> {
        const {
          sort,
          fields,
          strictTenantFilter = true,
          skipDeleteEvent,
          ...driverOptions
        } = options || {};

        let res;

        if (opts.softDelete) {
          res = await this._getDatabaseMixinCollection().findOneAndUpdate(
            this._getQueryFilter(
              query,
              params,
              'no-deleted',
              strictTenantFilter,
            ),
            this._prepareUpdateFilter(
              // @ts-expect-error deletedAt is not always here for TS
              { $currentDate: { deletedAt: true } },
              'update',
            ),
            {
              ...driverOptions,
              includeResultMetadata: false, // Document says it's true by default and will be false in a next major
              sort: getQueryFromList('sort', sort),
              projection: getQueryFromList('projection', fields),
              returnDocument: 'before',
            },
          );
        } else {
          res = await this._getDatabaseMixinCollection().findOneAndDelete(
            this._getQueryFilter(
              query,
              params,
              'no-deleted',
              strictTenantFilter,
            ),
            {
              ...driverOptions,
              sort: getQueryFromList('sort', sort),
              projection: getQueryFromList('projection', fields),
            },
          );
        }

        if (res && opts.eventPrefix && !skipDeleteEvent) {
          ctx.emit<DatabaseEventDelete<TSchema>>(
            `${opts.eventPrefix}.deleted`,
            { type: 'delete', document: res as WithDbFields<TSchema> },
          );
        }
        return res as WithDbFields<TSchema> | null;
      },

      /**
       * Delete many documents and return the number of deleted documents.
       * If soft delete is enabled, it will only set the deleted field to true (hiding it from future requests).
       *
       * WARNING: Do not send any events. You'll have to send an event yourself.
       */
      async _deleteMany(
        query: Filter<TSchema>,
        params: TenantParams<TSchema, TenantField>,
        options?: DatabaseDeleteManyOptions,
      ): Promise<number> {
        const { strictTenantFilter = true, ...driverOptions } = options || {};

        if (opts.softDelete) {
          const res = await this._getDatabaseMixinCollection().updateMany(
            this._getQueryFilter(
              query,
              params,
              'no-deleted',
              strictTenantFilter,
            ),
            this._prepareUpdateFilter(
              // @ts-expect-error deletedAt is not always here for TS
              { $currentDate: { deletedAt: true } },
              'update',
            ),
            driverOptions,
          );
          return res.modifiedCount;
        }
        const res = await this._getDatabaseMixinCollection().deleteMany(
          this._getQueryFilter(query, params, 'no-deleted', strictTenantFilter),
          driverOptions,
        );
        return res.deletedCount;
      },
    },

    actions: createActions(opts),

    created() {
      // Simple sanity check to have the required mixin setup
      if (!('getMongoClient' in this)) {
        throw new Error(
          'DatabaseConnectionMixin is required to use DatabaseMethodsMixin',
        );
      }
    },
  });
}
