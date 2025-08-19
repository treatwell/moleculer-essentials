import { ServiceSchema } from 'moleculer';
import { CustomServiceSchema } from './service.js';
import { CustomActionSchema, Alias } from './actions.js';

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
export function wrapMixin<Settings, Methods, Mixins, AdditionalProperties>(
  svc: Partial<
    CustomServiceSchema<Settings, Methods, Mixins, AdditionalProperties>
  >,
): typeof svc {
  return svc;
}

/**
 * This function is a NO-OP and is only useful for Typescript types.
 * Using Generic arguments allows TS to infer types directly from the object
 * passed as input.
 *
 * For the wrapService fn, it will return a moleculer ServiceSchema that will stripe
 * out every smart typing of methods. This should never be used inside a mixin.
 */
export function wrapService<Settings, Methods, Mixins, AdditionalProperties>(
  svc: CustomServiceSchema<Settings, Methods, Mixins, AdditionalProperties>,
): ServiceSchema {
  return svc as ServiceSchema;
}

export type { Alias, CustomServiceSchema, CustomActionSchema };
