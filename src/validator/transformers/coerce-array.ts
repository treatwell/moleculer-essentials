import { isArray } from 'lodash-es';
import type { Transformer, ValidationSchema } from '../types.js';
import { LeafTransformerBase } from './leaf-transformer-base.js';
import { COERCE_ARRAY_ATTRIBUTE } from '../../json-schema/index.js';

// This will not work in oneOf/anyOf/allOf
// This will not work with nested arrays, unless this is done on the lowest level
export class CoerceArrayTransformer
  extends LeafTransformerBase
  implements Transformer<unknown[], unknown>
{
  beforeTransformer = (val: unknown | unknown[]): unknown[] | null => {
    if (isArray(val) || val === null) {
      return val;
    }
    return [val];
  };

  afterTransformer = (val: unknown): unknown => val;

  isTransformableLeaf = (schema: ValidationSchema): boolean =>
    schema.type === 'array' && schema[COERCE_ARRAY_ATTRIBUTE];
}
