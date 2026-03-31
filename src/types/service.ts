import type { ServiceHooks, Service } from 'moleculer';
import type { CustomActionSchema } from './actions.js';
import type {
  OptionallyArray,
  UnionToIntersection,
  Unpacked,
} from './utils.js';
import type { ServiceEventSchema } from './events.js';

/**
 * This type represent what is accessible from the `this` in a service file.
 */
type ServiceThis<Settings, Methods, Mixins> = {
  // Disable this.actions calls as it isn't typed correctly
  actions: never;
  settings: Settings;
} & Methods &
  Service &
  // @ts-expect-error TS is not able to find 'methods' in the mixins type
  UnionToIntersection<Unpacked<Mixins>>['methods'] &
  Record<string | symbol, unknown>;

/**
 * Type used for injecting `this` in an object.
 */
type ObjectServiceThis<T, Settings, Methods, Mixins> = T &
  ThisType<ServiceThis<Settings, Methods, Mixins>>;

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
  this: ServiceThis<Settings, Methods, Mixins>,
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

export interface CustomServiceSchema<Settings, Methods, Mixins> {
  // Static fields
  name: string;
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
      [CustomServiceSchema<Settings, Methods, Mixins>]
    >
  >;
}
