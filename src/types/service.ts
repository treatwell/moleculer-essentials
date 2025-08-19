import { ServiceDependency, ServiceHooks, Service } from 'moleculer';
import { CustomActionSchema } from './actions.js';
import { OptionallyArray, UnionToIntersection, Unpacked } from './utils.js';
import { ServiceEventSchema } from './events.js';

/**
 * This type represent what is accessible from the `this` in a service file.
 */
type ServiceThis<Settings, Methods, Mixins, AdditionalProperties> = {
  // Disable this.actions calls as it isn't typed correctly
  actions: never;
  settings: Settings;
} & Methods &
  AdditionalProperties &
  Service &
  // @ts-expect-error TS is not able to find 'methods' in the mixins type
  UnionToIntersection<Unpacked<Mixins>>['methods'] &
  Record<string | symbol, unknown>;

/**
 * Type used for injecting `this` in an object.
 */
type ObjectServiceThis<T, Settings, Methods, Mixins, AdditionalProperties> = T &
  ThisType<ServiceThis<Settings, Methods, Mixins, AdditionalProperties>>;

/**
 * Type used for injecting `this` in a simple function.
 */
type CallbackServiceThis<
  Return,
  Settings,
  Methods,
  Mixins,
  AdditionalProperties,
  Parameters extends unknown[] = [],
> = (
  this: ServiceThis<Settings, Methods, Mixins, AdditionalProperties>,
  ...params: Parameters
) => Return;

export interface CustomServiceSchema<
  Settings,
  Methods,
  Mixins,
  AdditionalProperties,
> {
  // Static fields
  name: string;
  version?: string | number;
  dependencies?: OptionallyArray<string | ServiceDependency>;
  metadata?: Record<string, unknown>;
  settings?: Settings;
  hooks?: ServiceHooks;

  mixins?: Mixins;

  // Main Application logic
  methods?: ObjectServiceThis<
    Methods,
    Settings,
    Methods,
    Mixins,
    AdditionalProperties
  >;
  actions?: Record<
    string,
    ObjectServiceThis<
      CustomActionSchema,
      Settings,
      Methods,
      Mixins,
      AdditionalProperties
    >
  >;
  events?: Record<
    string,
    ObjectServiceThis<
      ServiceEventSchema,
      Settings,
      Methods,
      Mixins,
      AdditionalProperties
    >
  >;

  // Lifecycle methods
  created?: OptionallyArray<
    CallbackServiceThis<void, Settings, Methods, Mixins, AdditionalProperties>
  >;
  started?: OptionallyArray<
    CallbackServiceThis<
      Promise<void> | void,
      Settings,
      Methods,
      Mixins,
      AdditionalProperties
    >
  >;
  stopped?: OptionallyArray<
    CallbackServiceThis<
      Promise<void> | void,
      Settings,
      Methods,
      Mixins,
      AdditionalProperties
    >
  >;
  merged?: OptionallyArray<
    CallbackServiceThis<
      Promise<void> | void,
      Settings,
      Methods,
      Mixins,
      AdditionalProperties,
      [CustomServiceSchema<Settings, Methods, Mixins, AdditionalProperties>]
    >
  >;
}
