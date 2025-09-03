import { isEqual, isMatch } from 'es-toolkit/compat';
import type { Collection } from 'mongodb';
import type { IndexTuple, MongoIndex } from './types.js';

const {
  MONGO_URL = '',
  MONGODB_URL = '',
  SYNC_MONGO_INDEX,
  SYNC_INDEX_AUTO_CREATE,
  SYNC_INDEX_AUTO_DROP,
} = process.env;

export function getDefaultIndexName(key: Record<string, 1 | -1>): string {
  return Object.entries(key).flat(1).join('_');
}

export function isIndexNameEqual(dbIdx: MongoIndex, idx: IndexTuple): boolean {
  const [keys, opts] = idx;
  return dbIdx.name === (opts?.name || getDefaultIndexName(keys));
}

export function isIndexEqual(dbIdx: MongoIndex, idx: IndexTuple): boolean {
  const [keys, opts] = idx;

  // First check keys
  if (Object.keys(dbIdx.key).length !== Object.keys(keys).length) {
    return false;
  }

  if (Object.entries(dbIdx.key).some(([field, val]) => keys[field] !== val)) {
    return false;
  }

  // Mongo Indexes return the full collation object with defaults.
  // So we need to check if our collation partially match the db one.
  if (dbIdx.collation || opts?.collation) {
    if (!dbIdx.collation || !opts?.collation) {
      return false;
    }
    if (!isMatch(dbIdx.collation, opts.collation)) {
      return false;
    }
  }

  // Mongo sometimes set sparse field to false, even if it's not specified.
  if (Boolean(dbIdx.sparse) !== Boolean(opts?.sparse)) {
    return false;
  }

  // Now check options
  return (
    dbIdx.expireAfterSeconds === opts?.expireAfterSeconds &&
    dbIdx.unique === opts?.unique &&
    isEqual(dbIdx.partialFilterExpression, opts?.partialFilterExpression)
  );
}

export function isOnAtlas(): boolean {
  return (MONGO_URL || MONGODB_URL).includes('.mongodb.net');
}

/**
 * Rule for auto synchronise indexes is, in that order to not be hosted in MongoDB Atlas
 * 1. check for specific operation env variable
 * 2. check for force operation env variable
 * 3. check if we're hosted on MongoDB Atlas
 * or to force sync with the SYNC_MONGO_INDEX = 'yes'.
 */
export function shouldAutoCreateIndexes(): boolean {
  if (SYNC_INDEX_AUTO_CREATE) {
    return SYNC_INDEX_AUTO_CREATE === 'yes';
  }
  if (SYNC_MONGO_INDEX) {
    return SYNC_MONGO_INDEX === 'yes';
  }
  return !isOnAtlas();
}

export function shouldAutoDropIndexes(): boolean {
  if (SYNC_INDEX_AUTO_DROP) {
    return SYNC_INDEX_AUTO_DROP === 'yes';
  }
  if (SYNC_MONGO_INDEX) {
    return SYNC_MONGO_INDEX === 'yes';
  }
  return !isOnAtlas();
}

export async function getIndexesDifference({
  collection,
  declaredIdxs,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: Collection<any>;
  declaredIdxs: IndexTuple[];
}): Promise<{
  idxsToCreate: MongoIndex[];
  idxsToUpdate: MongoIndex[];
  idxsToDelete: Required<MongoIndex>[];
  synced: boolean;
}> {
  const dbIdxs = (await collection.indexes()) as Required<MongoIndex>[];

  const idxsToCreate = declaredIdxs
    .filter(idx => !dbIdxs.find(dbIdx => isIndexNameEqual(dbIdx, idx)))
    .map(([key, opts]) => ({ key, ...opts }));
  const idxsToUpdate = declaredIdxs
    .filter(idx =>
      dbIdxs.find(
        dbIdx => isIndexNameEqual(dbIdx, idx) && !isIndexEqual(dbIdx, idx),
      ),
    )
    .map(([key, opts]) => ({ key, ...opts }));
  const idxsToDelete = dbIdxs
    .filter(dbIdx => dbIdx.name !== '_id_')
    .filter(dbIdx => !declaredIdxs.find(idx => isIndexNameEqual(dbIdx, idx)));

  return {
    idxsToCreate,
    idxsToDelete,
    idxsToUpdate,
    synced: !(
      idxsToCreate.length ||
      idxsToUpdate.length ||
      idxsToDelete.length
    ),
  };
}
