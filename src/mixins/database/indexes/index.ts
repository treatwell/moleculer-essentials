import { isEqual } from 'lodash-es';
import type { Collection } from 'mongodb';
import type { Context } from 'moleculer';
import { wrapMixin } from '../../../types/index.js';
import {
  isIndexEqual,
  isIndexNameEqual,
  shouldAutoCreateIndexes,
  shouldAutoDropIndexes,
} from './utils.js';
import {
  type IndexState,
  IndexStatus,
  type IndexTuple,
  type ListSearchIndex,
  type MongoIndex,
  type SearchIndexDefinition,
} from './types.js';

/**
 * Return the difference between the declared indexes and the ones in the database.
 */
async function getIndexesDifference(
  collection: Collection,
  declaredIndexes: IndexTuple[] = [],
  declaredSearchIndexes: Record<string, SearchIndexDefinition> = {},
): Promise<IndexState[]> {
  const states: IndexState[] = [];

  const dbIdxs = (await collection.listIndexes().toArray()) as MongoIndex[];

  // Sync classic indexes
  for (const idx of declaredIndexes) {
    const dbIdxPos = dbIdxs.findIndex(i => isIndexNameEqual(i, idx));
    if (dbIdxPos === -1) {
      states.push({
        type: 'index',
        status: IndexStatus.MISSING,
        declaredIndex: idx,
      });
    } else {
      const [dbIdx] = dbIdxs.splice(dbIdxPos, 1);

      if (!isIndexEqual(dbIdx, idx)) {
        states.push({
          type: 'index',
          status: IndexStatus.OUTDATED,
          index: dbIdx,
          declaredIndex: idx,
        });
      } else {
        states.push({
          type: 'index',
          status: IndexStatus.OK,
          index: dbIdx,
          declaredIndex: idx,
        });
      }
    }
  }

  // Remaining db indexes are not declared
  for (const index of dbIdxs) {
    if (index.name !== '_id_') {
      states.push({ type: 'index', status: IndexStatus.NOT_DECLARED, index });
    }
  }

  // Sync search indexes
  let searchIndexes: ListSearchIndex[];
  try {
    searchIndexes = (await collection
      .listSearchIndexes()
      .toArray()) as ListSearchIndex[];
  } catch {
    return states;
  }

  for (const [name, idx] of Object.entries(declaredSearchIndexes)) {
    const dbIdxPos = searchIndexes.findIndex(i => i.name === name);
    if (dbIdxPos === -1) {
      states.push({
        type: 'searchIndex',
        name,
        status: IndexStatus.MISSING,
        declaredSearchIndex: idx,
      });
    } else {
      const [dbIdx] = searchIndexes.splice(dbIdxPos, 1);

      if (!isEqual(dbIdx.latestDefinition, idx)) {
        states.push({
          type: 'searchIndex',
          name,
          status: IndexStatus.OUTDATED,
          searchIndex: dbIdx.latestDefinition,
          declaredSearchIndex: idx,
        });
      } else {
        states.push({
          type: 'searchIndex',
          name,
          status: IndexStatus.OK,
          searchIndex: dbIdx.latestDefinition,
          declaredSearchIndex: idx,
        });
      }
    }
  }

  // Remaining search indexes are not declared
  for (const index of searchIndexes) {
    states.push({
      type: 'searchIndex',
      name: index.name,
      status: IndexStatus.NOT_DECLARED,
      searchIndex: index.latestDefinition,
    });
  }

  return states;
}

export type DatabaseIndexesOptions = {
  indexes?: IndexTuple[];
  searchIndexes?: Record<string, SearchIndexDefinition>;
};

export type SyncIndexesOptions = {
  createIndexes: boolean;
  dropIndexes: boolean;
};

export const DATABASE_INDEXES_MIXIN_SYNC_EVENT = 'database-indexes-mixin.sync';

export function DatabaseIndexesMixin(opts: DatabaseIndexesOptions) {
  return wrapMixin({
    methods: {
      async _syncIndexes({
        dropIndexes,
        createIndexes,
      }: SyncIndexesOptions): Promise<void> {
        if (typeof this.getCollection !== 'function') {
          throw new Error(
            'getCollection method not found, did you add the DatabaseConnectionMixin?',
          );
        }
        const collection = this.getCollection() as Collection;

        const states = await getIndexesDifference(
          collection,
          opts.indexes,
          opts.searchIndexes,
        );

        const notOkStates = states.filter(s => s.status !== IndexStatus.OK);

        if (!notOkStates.length) {
          this.logger.info(
            `Collection ${collection.collectionName} is synced (${states.length} indexes)`,
          );
          return;
        }
        this.logger.info(
          `Collection ${collection.collectionName} is not synced (${notOkStates.length}/${states.length} indexes are not OK)`,
        );

        const syncableStates = notOkStates.filter(
          s =>
            (s.status === IndexStatus.NOT_DECLARED && dropIndexes) ||
            (s.status === IndexStatus.MISSING && createIndexes) ||
            (s.status === IndexStatus.OUTDATED && createIndexes),
        );

        for (const state of syncableStates) {
          try {
            await this._createIndexFromState(collection, state);
          } catch (err) {
            this.logger.warn('Error while syncing indexes', { err, state });
          }
        }
      },

      async _createIndexFromState(
        col: Collection,
        state: IndexState,
      ): Promise<void> {
        if (state.status === IndexStatus.MISSING) {
          this.logger.info(`Creating missing index`, { state });
          if (state.type === 'index') {
            const [definition, options] = state.declaredIndex;
            await col.createIndex(definition, options);
          } else {
            await col.createSearchIndex({
              name: state.name,
              definition: state.declaredSearchIndex,
            });
          }
        } else if (state.status === IndexStatus.NOT_DECLARED) {
          this.logger.info(`Index is not declared, dropping it`, { state });
          if (state.type === 'index') {
            if (!state.index.name || state.index.name === '_id_') {
              throw new Error(
                `Unable to delete index '${state.index.name}', invalid name`,
              );
            }
            await col.dropIndex(state.index.name);
          } else {
            await col.dropSearchIndex(state.name);
          }
        } else if (state.status === IndexStatus.OUTDATED) {
          this.logger.info(`Index is outdated, updating it`, { state });
          if (state.type === 'index') {
            this.logger.warn(
              'Updating indexes is not supported, it should be done manually',
            );
          } else {
            await col.updateSearchIndex(state.name, state.declaredSearchIndex);
          }
        } else {
          this.logger.info(`Index is OK, doing nothing`, { state });
        }
      },
    },

    events: {
      [DATABASE_INDEXES_MIXIN_SYNC_EVENT]: {
        async handler(ctx: Context): Promise<void> {
          ctx.logger.info(
            `Received sync indexes event for service ${this.name}`,
          );
          await this._syncIndexes({ createIndexes: true, dropIndexes: false });
        },
      },
      '$broker.started': {
        async handler(): Promise<void> {
          await this._syncIndexes({
            createIndexes: shouldAutoCreateIndexes(),
            dropIndexes: shouldAutoDropIndexes(),
          });
        },
      },
    },
  });
}
