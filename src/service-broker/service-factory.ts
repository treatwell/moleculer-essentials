import {
  Service,
  ServiceSchema,
  ServiceBroker,
  ServiceSettingSchema,
} from 'moleculer';

/**
 * To prevent moleculer from modifying the params of actions & events,
 * we transform them to functions that return the params.
 *
 * It has 2 side effects:
 * - Local action definitions will have a function instead of the original object
 * - Remote action definitions will not have the params field
 */
function lockAllParams<S>(schema?: Partial<ServiceSchema<S>>): void {
  if (schema?.mixins) {
    for (const mixin of schema.mixins) {
      lockAllParams(mixin);
    }
  }
  if (schema?.actions) {
    for (const action of Object.values(schema.actions)) {
      if (
        action &&
        typeof action === 'object' &&
        'params' in action &&
        typeof action.params === 'object'
      ) {
        const rawParams = action.params;
        // @ts-expect-error We know that we are cheating here
        action.params = () => rawParams;
      }
    }
  }
  if (schema?.events) {
    for (const event of Object.values(schema.events)) {
      if (
        event &&
        typeof event === 'object' &&
        'params' in event &&
        typeof event.params === 'object'
      ) {
        const rawParams = event.params;
        // @ts-expect-error We know that we are cheating here
        event.params = () => rawParams;
      }
    }
  }
}

/**
 * This class replace the default Service class in Moleculer to:
 * - Replace the params of actions with functions that return the params in
 *   order to prevent moleculer from merging them.
 */
export class ServiceFactory<S = ServiceSettingSchema> extends Service<S> {
  constructor(broker: ServiceBroker, schema?: ServiceSchema<S>) {
    lockAllParams(schema);
    super(broker, schema);
  }
}
