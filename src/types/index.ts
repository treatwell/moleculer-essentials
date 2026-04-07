import type { ServiceSchema, ServiceSettingSchema } from 'moleculer';
import type {
  CustomServiceSchema,
  PartialCustomServiceSchema,
  InternalObjectServiceThis,
  InternalCallbackServiceThis,
} from './service.js';
import type { CustomActionSchema, Alias } from './actions.js';

/**
 * This function is a NO-OP and is only useful for Typescript types.
 * Using Generic arguments allows TS to infer types directly from the object
 * passed as input.
 *
 * For the wrapMixin fn, it will return the exact type of the object passed
 * in order to generate smart typings for services using the mixin.
 *
 * In case of a mixin using options (a function that will return the mixin),
 * for types to work, you must NOT specify the return type and let TS infer
 * the return type.
 *
 * For now, only methods are typed.
 */
export function wrapMixin<Settings, Methods, Mixins>(
  svc: PartialCustomServiceSchema<Settings, Methods, Mixins>,
): typeof svc {
  return svc;
}

/**
 * In order to let TS emit types for inferred services, we return our own
 * type that extend the original one.
 * More on why: https://github.com/microsoft/TypeScript/pull/58176#issuecomment-2052698294
 */
export type _InferredServiceSchema<TSettings = ServiceSettingSchema> =
  ServiceSchema<TSettings>;

/**
 * This function is a NO-OP and is only useful for Typescript types.
 * Using Generic arguments allows TS to infer types directly from the object
 * passed as input.
 *
 * For the wrapService fn, it will return a moleculer ServiceSchema that will stripe
 * out every smart typing of methods. This should never be used inside a mixin.
 */
export function wrapService<Settings, Methods, Mixins>(
  svc: CustomServiceSchema<Settings, Methods, Mixins>,
): _InferredServiceSchema<Settings> {
  return svc as _InferredServiceSchema<Settings>;
}

export type {
  Alias,
  CustomServiceSchema,
  PartialCustomServiceSchema,
  CustomActionSchema,
  InternalObjectServiceThis,
  InternalCallbackServiceThis,
};
