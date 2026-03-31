import {
  Context,
  type ServiceBroker,
  type ActionEndpoint,
  type EventEndpoint,
  type Span,
  type Logger,
} from 'moleculer';

/**
 * This class replace the default Context class in Moleculer to:
 * - Add a ctx.logger instance with the trace.id and span.id in the bindings
 */
export class ContextFactory<
  P = unknown,
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  M extends object = {},
  L = Record<string, unknown>,
  H = Record<string, unknown>,
> extends Context<P, M, L, H> {
  constructor(broker: ServiceBroker, endpoint: ActionEndpoint | EventEndpoint) {
    super(broker, endpoint);
    this.setLogger();
  }

  override startSpan(name: string, opts?: Record<string, unknown>): Span {
    const span = super.startSpan(name, opts);
    this.setLogger();
    return span;
  }

  /**
   * Get a logger for this specific span of the context.
   */
  setLogger() {
    const bindings = {
      traceID: this.requestID,
      spanID: this.span ? this.span.id : undefined,
    };

    if (this.service) {
      Object.assign(bindings, {
        svc: this.service.name,
        ver: this.service.version,
      });
    }

    this.logger = this.broker.getLogger(
      this.service ? this.service.fullName : 'context',
      bindings,
    );
  }
}

declare module 'moleculer' {
  interface Context {
    logger: Logger;
  }
}
