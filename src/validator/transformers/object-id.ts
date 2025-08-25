/* eslint-disable @typescript-eslint/no-explicit-any */
import { isString } from 'lodash-es';
import { ObjectId } from 'bson';
import { LeafTransformerBase } from './leaf-transformer-base.js';
import type { ValidationSchema, Transformer } from '../types.js';

export class ObjectIdTransformer
  extends LeafTransformerBase
  implements Transformer<ObjectId, string>
{
  beforeTransformer = (val: unknown | ObjectId): unknown | string => {
    if (
      (val as any)?._bsontype?.toLowerCase() === 'objectid' &&
      ObjectId.isValid(val as any)
    ) {
      return (val as ObjectId).toString();
    }
    return val;
  };

  afterTransformer = (val: string | unknown): ObjectId | unknown => {
    /*
      Better use a regex since ObjectId.isValid isn't 100% reliablke to test if a string is an object id
      example: ObjectId('babyliss-pro') = true
    */
    if (isString(val) && /^[a-f\d]{24}$/i.test(val)) {
      return new ObjectId(val);
    }
    return val;
  };

  isTransformableLeaf = (schema: ValidationSchema): boolean =>
    schema.type === 'string' && schema.format === 'object-id';
}
