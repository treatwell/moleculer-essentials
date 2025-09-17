import type { Filter, WithId } from 'mongodb';
import {
  type JSONSchemaType,
  omitFields,
  optionalFields,
} from '../../json-schema/index.js';
import type { WithOptionalId } from './types.js';

export function removeMongoId<T>(
  schema: JSONSchemaType<WithId<T>>,
  refName?: string,
): JSONSchemaType<Omit<T, '_id'>> {
  return omitFields(schema, ['_id'], refName) as JSONSchemaType<Omit<T, '_id'>>;
}

export function optionalMongoId<T>(
  schema: JSONSchemaType<WithId<T>>,
  refName?: string,
): JSONSchemaType<WithOptionalId<T>> {
  return optionalFields(schema, ['_id'], refName) as JSONSchemaType<
    WithOptionalId<T>
  >;
}

/**
 * Optimize query index usage for $or queries.
 * This is particularly useful in case of partial indexes.
 * This distributes the original condition in all $or conditions.
 * @param query the query to optimize
 */
export function optimizeQuery<T extends Record<string, unknown>>(
  query: Filter<T>,
): Filter<T> {
  const { $or, ...rest } = query;
  if (!Array.isArray($or) || $or.length === 0) {
    return query;
  }
  return {
    $or: $or.map(predicate => ({ ...predicate, ...rest })),
  };
}

/**
 * Return an object with each list item as key and 1/0/-1 as value
 * to be used in mongo projection or sort.
 */
export function getQueryFromList<
  T extends 'sort' | 'projection',
  NotOp extends T extends 'sort' ? -1 : 0,
>(type: T, list?: string[]): Record<string, 1 | NotOp> | undefined {
  if (!list?.length) {
    return undefined;
  }
  const res: Record<string, 1 | NotOp> = {};
  list.forEach(el => {
    if (el.startsWith('-')) {
      const p = el.slice(1);
      res[p] = (type === 'sort' ? -1 : 0) as NotOp;
    } else {
      res[el] = 1;
    }
  });
  return res;
}
