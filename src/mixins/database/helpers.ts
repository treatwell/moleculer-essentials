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
