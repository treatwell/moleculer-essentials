import { isEqual, omit } from 'lodash';
import {
  JSONSchemaType,
  SCHEMA_REF_NAME,
  SomeJSONSchema,
} from '../json-schema/index.js';

/**
 * This class walks through a JSON schema and extracts all the refs.
 * When a ref is found, it calls the onNewRef child method, and replace the schema with the ref.
 */
export abstract class RefExtractor {
  private refs = new Map<string, unknown>();

  protected meta: Record<string, unknown> = {};

  /**
   * Allows to translate the ref name to a new ref name.
   * The walk method will use the response to decide if a ref was already extracted or not.
   */
  protected abstract refReplacer(ref: string): string;

  /**
   * Called when a new ref is found. Allows to store the ref in a map or do something else.
   */
  protected abstract onNewRef(
    originalRef: string,
    schema: SomeJSONSchema,
  ): unknown;

  protected onError(
    message: string,
    other: Record<string, unknown> = {},
  ): void {
    console.log('Error while extracting refs', message, {
      ...this.meta,
      ...other,
    });
    throw new Error(message);
  }

  setMeta(meta: Record<string, unknown>): void {
    this.meta = meta;
  }

  extract(
    schemaToExtract: SomeJSONSchema,
    initialRef: string | undefined = undefined,
    skipRoot = false,
  ): SomeJSONSchema {
    const walk = (
      curr: SomeJSONSchema,
      currentRef?: string,
      root = false,
    ): SomeJSONSchema => {
      if (curr.$ref) {
        if (curr.$ref === '#') {
          if (!currentRef) {
            throw new Error(
              'Recursive refs MUST have at least one parent with a SCHEMA_REF_NAME defined',
            );
          }
          return <JSONSchemaType<never>>{ $ref: currentRef };
        }
        return curr;
      }

      const schemaRefName = curr[SCHEMA_REF_NAME];
      if (schemaRefName) {
        const ref = this.refReplacer(schemaRefName);
        if (!this.refs.has(schemaRefName)) {
          this.refs.set(schemaRefName, null);
        }
        const newSchema = walk(omit(curr, [SCHEMA_REF_NAME, 'nullable']), ref);
        const registeredSchema = this.refs.get(schemaRefName);

        if (registeredSchema === null) {
          this.refs.set(schemaRefName, newSchema);
          this.onNewRef(schemaRefName, newSchema);
        } else if (!isEqual(newSchema, registeredSchema)) {
          this.onError(
            `Schema ${schemaRefName} is already defined with different content`,
            { registeredSchema, newSchema },
          );
        }

        if (skipRoot && root) {
          return this.refs.get(schemaRefName) as SomeJSONSchema;
        }

        // Transform nullable to oneOf with null type.
        // This allows to use the same schema for both nullable and non-nullable.
        if (curr.nullable) {
          // @ts-expect-error type: null is not supported in JSONSchemaType
          return <JSONSchemaType<never>>{
            oneOf: [{ $ref: ref }, { type: 'null' }],
          };
        }
        return <JSONSchemaType<never>>{ $ref: ref };
      }

      if (['integer', 'number', 'string', 'boolean'].includes(curr.type)) {
        return curr;
      }

      const newSchema = { ...curr };

      if (newSchema.type === 'array' && newSchema.items) {
        newSchema.items = walk(newSchema.items, currentRef);
      } else if (newSchema.type === 'object') {
        if (newSchema.properties) {
          newSchema.properties = { ...newSchema.properties };
          Object.entries(newSchema.properties).forEach(([key, val]) => {
            newSchema.properties[key] = walk(val as SomeJSONSchema, currentRef);
          });
        }
        if (
          newSchema.additionalProperties &&
          newSchema.additionalProperties !== true
        ) {
          newSchema.additionalProperties = walk(
            newSchema.additionalProperties,
            currentRef,
          );
        }
      }

      if (Array.isArray(newSchema.oneOf)) {
        newSchema.oneOf = newSchema.oneOf.map(s => walk(s, currentRef));
      }
      if (Array.isArray(newSchema.allOf)) {
        newSchema.allOf = newSchema.allOf.map(s => walk(s, currentRef));
      }
      if (Array.isArray(newSchema.anyOf)) {
        newSchema.anyOf = newSchema.anyOf.map(s => walk(s, currentRef));
      }
      return newSchema;
    };

    return walk(schemaToExtract, initialRef, true);
  }
}
