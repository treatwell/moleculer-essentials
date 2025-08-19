import { parseISO } from 'date-fns';
import { isNaN, isString } from 'lodash';
import { LeafTransformerBase } from './leaf-transformer-base.js';
import { ValidationSchema, Transformer } from '../types.js';

export class DateTransformer
  extends LeafTransformerBase
  implements Transformer<Date, string>
{
  transformFormats = ['date-time'];

  beforeTransformer = (val: unknown | Date): unknown | string => {
    if (val instanceof Date) {
      return val.toISOString();
    }
    return val;
  };

  afterTransformer = (val: string | unknown): Date | unknown => {
    if (!isString(val)) {
      return val;
    }
    const date = parseISO(val);
    if (isNaN(date.getTime())) {
      return val;
    }
    return date;
  };

  isTransformableLeaf(schema: ValidationSchema): boolean {
    return (
      schema.type === 'string' && this.transformFormats.includes(schema.format)
    );
  }
}
