import type { ServiceHooks, Service } from 'moleculer';
import type { CustomActionSchema } from './actions.js';
import type { OptionallyArray, UnionToIntersection } from './utils.js';
import type { ServiceEventSchema } from './events.js';

/**
 * For ONE particular mixin, return methods and settings.
 * Will recursively check mixins.
 */
type InjectedByMixin<Mixin> = (Mixin extends { mixins?: infer NestedMixin }
  ? InjectMixins<NonNullable<NestedMixin>>
  : object) &
  // Recursive is done, now inject what we want
  (Mixin extends { methods?: infer Methods } ? Methods : object) &
  (Mixin extends { settings?: infer Settings }
    ? { settings: Settings }
    : object);

/**
 * For a list of mixins, get the merged resulting object to be injected
 */
type InjectMixins<Mixins> = Mixins extends readonly unknown[]
  ? UnionToIntersection<InjectedByMixin<Mixins[number]>>
  : object;

/**
 * Outside injected props, we have some basic props.
 * We also allow any "other" props as unknown to give back some freedom.
 *
 */
interface BaseService<Settings> {
  // Disable this.actions calls as it isn't typed correctly
  actions: never;
  settings: Settings;
  [key: string | symbol]: unknown;
}

/**
 * This type represent what is accessible from the `this` in a service file.
 * It tries to infer from generics:
 * - Direct methods
 * - Recursive mixins methods
 *
 * @internal Exported only for testing
 */
export type ServiceWithInference<Settings, Methods, Mixins> = Service &
  Methods &
  InjectMixins<Mixins> &
  BaseService<Settings>;

/**
 * Type used for injecting `this` in an object.
 */
type ObjectServiceThis<T, Settings, Methods, Mixins> = T &
  ThisType<ServiceWithInference<Settings, Methods, Mixins>>;

/**
 * Type used for injecting `this` in a simple function.
 */
type CallbackServiceThis<
  Return,
  Settings,
  Methods,
  Mixins,
  Parameters extends unknown[] = [],
> = (
  this: ServiceWithInference<Settings, Methods, Mixins>,
  ...params: Parameters
) => Return;

/**
 * Export those internal helpers to allow consumers to add
 * custom behavior
 */
export {
  ObjectServiceThis as InternalObjectServiceThis,
  CallbackServiceThis as InternalCallbackServiceThis,
};

export interface PartialCustomServiceSchema<Settings, Methods, Mixins> {
  // Static fields
  name?: string;
  version?: string | number;
  dependencies?: OptionallyArray<string | Service.ServiceDependency>;
  metadata?: Record<string, unknown>;
  settings?: Settings;
  hooks?: ServiceHooks;

  mixins?: Mixins;

  // Main Application logic
  methods?: ObjectServiceThis<Methods, Settings, Methods, Mixins>;
  actions?: Record<
    string,
    ObjectServiceThis<CustomActionSchema, Settings, Methods, Mixins>
  >;
  events?: Record<
    string,
    ObjectServiceThis<ServiceEventSchema, Settings, Methods, Mixins>
  >;

  // Lifecycle methods
  created?: OptionallyArray<
    CallbackServiceThis<void, Settings, Methods, Mixins>
  >;
  started?: OptionallyArray<
    CallbackServiceThis<Promise<void> | void, Settings, Methods, Mixins>
  >;
  stopped?: OptionallyArray<
    CallbackServiceThis<Promise<void> | void, Settings, Methods, Mixins>
  >;
  merged?: OptionallyArray<
    CallbackServiceThis<
      Promise<void> | void,
      Settings,
      Methods,
      Mixins,
      [PartialCustomServiceSchema<Settings, Methods, Mixins>]
    >
  >;
}

export interface CustomServiceSchema<
  Settings,
  Methods,
  Mixins,
> extends PartialCustomServiceSchema<Settings, Methods, Mixins> {
  name: string;
}
