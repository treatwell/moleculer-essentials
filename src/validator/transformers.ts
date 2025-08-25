import { isPlainObject, isArray } from 'lodash-es';
import { CoerceArrayTransformer } from './transformers/coerce-array.js';
import { DateTransformer } from './transformers/date.js';
import { ObjectIdTransformer } from './transformers/object-id.js';
import type {
  ValidationSchema,
  Transformer,
  Transform,
  TransformField,
  TransformMap,
} from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformers: Transformer<any, any>[] = [
  new DateTransformer(),
  new ObjectIdTransformer(),
  new CoerceArrayTransformer(),
];

function applyTransform<T, U>(
  parent: Record<string | number, unknown>,
  dataKey: string | number,
  transformer: Transform<T, U>,
  transformField: TransformField,
  index: number,
): void {
  const transformLevel = transformField[index];

  switch (transformLevel.type) {
    case 'this': {
      if (!isPlainObject(parent) && !isArray(parent)) {
        return;
      }

      // eslint-disable-next-line no-prototype-builtins
      if (parent.hasOwnProperty(dataKey)) {
        parent[dataKey] = transformer(parent[dataKey] as T);
      }

      break;
    }
    case 'access':
      if (!isPlainObject(parent[dataKey])) {
        return;
      }

      applyTransform(
        parent[dataKey] as Record<string, unknown>,
        transformLevel.key,
        transformer,
        transformField,
        index + 1,
      );

      break;
    case 'select':
      for (const localTransformField of transformLevel.subTransforms) {
        applyTransform(parent, dataKey, transformer, localTransformField, 0);
      }
      break;
    case 'loop': {
      if (!isArray(parent[dataKey])) {
        return;
      }

      const cast = parent[dataKey] as unknown[];
      for (let i = 0; i < cast.length; i += 1) {
        applyTransform(
          cast as Record<number, unknown>,
          i,
          transformer,
          transformField,
          index + 1,
        );
      }
      break;
    }
    default:
      throw new Error(
        `Unknown transformLevel type '${
          (transformLevel as { type: string }).type
        }'`,
      );
  }
}

function applyTransforms<T, U>(
  schema: ValidationSchema,
  data: Record<string, unknown>,
  transformMap: TransformMap,
  transformer: Transform<T, U>,
): void {
  if (transformMap.has(schema)) {
    const transformFields = transformMap.get(schema)!;
    transformFields.forEach(transformField => {
      applyTransform({ data }, 'data', transformer, transformField, 0);
    });
  }
}

export function applyBeforeTransforms(
  schema: ValidationSchema,
  data: Record<string, unknown>,
): void {
  transformers.forEach(transformer => {
    applyTransforms(
      schema,
      data,
      transformer.transformMap,
      transformer.beforeTransformer,
    );
  });
}

export function applyAfterTransforms(
  schema: ValidationSchema,
  data: Record<string, unknown>,
): void {
  transformers.forEach(transformer => {
    applyTransforms(
      schema,
      data,
      transformer.transformMap,
      transformer.afterTransformer,
    );
  });
}

export function loadTransforms(schema: ValidationSchema): void {
  transformers.forEach(transformer => {
    if (!transformer.transformMap.has(schema)) {
      const transforms = transformer.findTransforms(schema);
      if (transforms.some(t => t.length === 0)) {
        const strSchema = JSON.stringify(schema, undefined, 2);
        throw new Error(`Unsupported transforms found for Schema ${strSchema}`);
      }
      transformer.transformMap.set(schema, transforms);
    }
  });
}
