import type { JSONSchemaType } from '../json-schema/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValidationSchema = JSONSchemaType<any>;

export type Transform<T, U> = (val: T) => U;
export type TransformLevel =
  | { type: 'access'; key: string }
  | { type: 'this' }
  | { type: 'loop' }
  | { type: 'select'; subTransforms: TransformField[] };
export type TransformField = TransformLevel[];
export type TransformMap = WeakMap<ValidationSchema, TransformField[]>;

export interface Transformer<T, U> {
  transformMap: TransformMap;
  beforeTransformer: Transform<unknown | T, unknown | U>;
  afterTransformer: Transform<unknown | U, unknown | T>;
  findTransforms: (schema: ValidationSchema) => TransformField[];
}
