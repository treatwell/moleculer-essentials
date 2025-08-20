import type { TransformField, ValidationSchema } from '../types.js';

export abstract class LeafTransformerBase {
  transformMap = new WeakMap();

  abstract isTransformableLeaf(schema: ValidationSchema): boolean;

  findTransformsInternal(
    schema: ValidationSchema,
    currentField: TransformField,
  ): TransformField[] {
    if (this.isTransformableLeaf(schema)) {
      currentField.push({ type: 'this' });
      return [currentField];
    }

    if (schema.type === 'object' && schema.properties) {
      return Object.entries(schema.properties).flatMap(([key, subSchema]) => {
        const currentFieldCopy = [...currentField];
        currentFieldCopy.push({ type: 'access', key });
        return this.findTransformsInternal(
          <ValidationSchema>subSchema,
          currentFieldCopy,
        );
      });
    }

    if (schema.type === 'array' && schema.items) {
      currentField.push({ type: 'loop' });
      return this.findTransformsInternal(
        <ValidationSchema>schema.items,
        currentField,
      );
    }

    if (schema.oneOf || schema.anyOf || schema.allOf) {
      const arr = schema.oneOf || schema.anyOf || schema.allOf;
      const subTransforms = arr.flatMap((subSchema: ValidationSchema) =>
        this.findTransformsInternal(<ValidationSchema>subSchema, []),
      );
      currentField.push({ type: 'select', subTransforms });
      return [currentField];
    }

    return [];
  }

  findTransforms(schema: ValidationSchema): TransformField[] {
    return this.findTransformsInternal(schema, []);
  }
}
