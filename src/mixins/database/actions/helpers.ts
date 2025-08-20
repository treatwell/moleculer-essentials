import { type BaseValidator, Errors } from 'moleculer';
import type { Filter, Document } from 'mongodb';
import { ZodType } from 'zod/v4';
import type { ValidationSchema } from '../../../validator/types.js';

export function parseStringifiedQuery<TSchema extends Document>(
  sQuery?: string,
): Filter<TSchema> {
  if (!sQuery) {
    return {};
  }

  let query = {};
  try {
    query = JSON.parse(sQuery || '{}');
  } catch {
    throw new Errors.ValidationError('Invalid query format');
  }

  return query;
}

export function parseAndValidateQuery<TSchema extends Document>(
  validator: BaseValidator,
  schema: ValidationSchema | ZodType | undefined,
  sQuery: string | undefined,
): Filter<TSchema> {
  if (!schema) {
    return {};
  }

  let query = parseStringifiedQuery<TSchema>(sQuery);
  if (schema instanceof ZodType) {
    query = validator.validate(query, schema) as Filter<TSchema>;
  } else {
    validator.validate(query, schema);
  }

  return query;
}
