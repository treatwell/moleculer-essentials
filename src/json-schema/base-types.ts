/* eslint-disable @typescript-eslint/no-explicit-any */
// This file is a direct copy of json-schema.ts of ajv.
// Here is a list of the changes from the original Ajv one:
// - Add Date type detection
// - Add Buffer type detection
// - Add ObjectId type detection
// - Make additionalProperties required
// - Remove StrictNullChecksWrapper check
// - Add back old allOf type union
// - Always require the `required` property (old behavior) instead of letting it be skipped when no property is required

import type { ObjectId } from 'bson';

type UnionToIntersection<U> = (U extends any ? (_: U) => void : never) extends (
  _: infer I,
) => void
  ? I
  : never;

export type SomeJSONSchema = JSONSchemaType<Known, true>;

type PartialSchema<T> = Partial<JSONSchemaType<T, true>>;

type JSONType<
  T extends string,
  IsPartial extends boolean,
> = IsPartial extends true ? T | undefined : T;

interface NumberKeywords {
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  format?: string;
}

interface StringKeywords {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

export type JSONSchemaType<T, IsPartial extends boolean = false> = (
  | // these two unions allow arbitrary unions of types
  {
      anyOf: readonly JSONSchemaType<T, IsPartial>[];
    }
  | {
      oneOf: readonly JSONSchemaType<T, IsPartial>[];
    }
  | {
      allOf: readonly JSONSchemaType<T, true>[];
    }
  // this union allows for { type: (primitive)[] } style schemas
  | ({
      type: readonly (T extends number
        ? JSONType<'number' | 'integer', IsPartial>
        : T extends string
          ? JSONType<'string', IsPartial>
          : T extends boolean
            ? JSONType<'boolean', IsPartial>
            : never)[];
    } & UnionToIntersection<
      T extends number
        ? NumberKeywords
        : T extends string
          ? StringKeywords
          : T extends boolean
            ? // eslint-disable-next-line @typescript-eslint/no-empty-object-type
              {}
            : never
    >)
  // this covers "normal" types; it's last so typescript looks to it first for errors
  | ((T extends number
      ? {
          type: JSONType<'number' | 'integer', IsPartial>;
        } & NumberKeywords
      : T extends string
        ? {
            type: JSONType<'string', IsPartial>;
          } & StringKeywords
        : T extends boolean
          ? {
              type: JSONType<'boolean', IsPartial>;
            }
          : T extends Date
            ? {
                type: JSONType<'string', IsPartial>;
                format: 'date-time' | 'date';
              }
            : T extends Buffer
              ? {
                  instanceof: 'Buffer';
                }
              : T extends null
                ?
                    | {
                        type: JSONType<'null', IsPartial>;
                      }
                    | { nullable?: true }
                : T extends ObjectId
                  ? {
                      type: JSONType<'string', IsPartial>;
                      format: 'object-id';
                    }
                  : T extends [any, ...any[]]
                    ? {
                        // JSON AnySchema for tuple
                        type: JSONType<'array', IsPartial>;
                        items: {
                          readonly [K in keyof T]-?: JSONSchemaType<T[K]> &
                            Nullable<T[K]>;
                        } & { length: T['length'] };
                        minItems: T['length'];
                      } & (
                        | { maxItems: T['length'] }
                        | { additionalItems: false }
                      )
                    : T extends readonly any[]
                      ? {
                          type: JSONType<'array', IsPartial>;
                          items: JSONSchemaType<T[0]>;
                          contains?: PartialSchema<T[0]>;
                          minItems?: number;
                          maxItems?: number;
                          minContains?: number;
                          maxContains?: number;
                          uniqueItems?: true;
                          additionalItems?: never;
                        }
                      : T extends Record<string, any>
                        ? {
                            // JSON AnySchema for records and dictionaries
                            // "required" is not optional because it is often forgotten
                            // "properties" are optional for more concise dictionary schemas
                            // "patternProperties" and can be only used with interfaces that have string index
                            type: JSONType<'object', IsPartial>;
                            // "required" type does not guarantee that all required properties are listed
                            // it only asserts that optional cannot be listed
                            required: IsPartial extends true
                              ? Readonly<(keyof T)[]>
                              : Readonly<RequiredMembers<T>[]>;
                            additionalProperties?:
                              | boolean
                              | JSONSchemaType<T[string]>;
                            unevaluatedProperties?:
                              | boolean
                              | JSONSchemaType<T[string]>;
                            discriminator?: {
                              propertyName: keyof T;
                            };
                            properties?: IsPartial extends true
                              ? Partial<PropertiesSchema<T>>
                              : PropertiesSchema<T>;
                            patternProperties?: Record<
                              string,
                              JSONSchemaType<T[string]>
                            >;
                            propertyNames?: Omit<
                              JSONSchemaType<string>,
                              'type'
                            > & {
                              type?: 'string';
                            };
                            dependencies?: {
                              [K in keyof T]?:
                                | Readonly<(keyof T)[]>
                                | PartialSchema<T>;
                            };
                            dependentRequired?: {
                              [K in keyof T]?: Readonly<(keyof T)[]>;
                            };
                            dependentSchemas?: {
                              [K in keyof T]?: PartialSchema<T>;
                            };
                            minProperties?: number;
                            maxProperties?: number;
                          }
                        : T extends null
                          ? {
                              type: JSONType<'null', IsPartial>;
                              nullable: true;
                            }
                          : never) & {
      allOf?: Readonly<PartialSchema<T>[]>;
      anyOf?: Readonly<PartialSchema<T>[]>;
      oneOf?: Readonly<PartialSchema<T>[]>;
      if?: PartialSchema<T>;
      then?: PartialSchema<T>;
      else?: PartialSchema<T>;
      not?: PartialSchema<T>;
    })
) & {
  [keyword: string]: any;
  $id?: string;
  $ref?: string;
  $defs?: Record<string, JSONSchemaType<Known, true>>;
  definitions?: Record<string, JSONSchemaType<Known, true>>;
};

type Known =
  | { [key: string]: Known }
  | [Known, ...Known[]]
  | Known[]
  | number
  | string
  | boolean
  | null;

export type PropertiesSchema<T> = {
  [K in keyof T]-?: (JSONSchemaType<T[K]> & Nullable<T[K]>) | { $ref: string };
};

export type RequiredMembers<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K;
}[keyof T];

type Nullable<T> = undefined extends T
  ? {
      nullable?: true;
      const?: never; // any non-null value would fail `const: null`, `null` would fail any other value in const
      enum?: Readonly<(T | null)[]>; // `null` must be explicitly included in "enum" for `null` to pass
      default?: T | null;
    }
  : {
      const?: T;
      enum?: Readonly<T[]>;
      default?: T;
    };
