import {
  type ActionHandler,
  type Context,
  Errors,
  Validators,
  type ServiceEventHandler,
  type ActionSchema,
} from 'moleculer';
import { z, ZodType } from 'zod/v4';
import { getSchemaFromMoleculer } from './utils.js';

export type ZodActionOrEventSchema = { params?: ZodType };

/**
 * Use zod for schema validation.
 * DO NOT support Async refinements/transforms yet.
 *
 * Transforms MUST BE handled by the consumer directly.
 */
export class ZodValidator extends Validators.Base {
  override compile(): () => void {
    throw new Error('compile should not be used, use validate instead');
  }

  override validate<S extends ZodType>(
    params: unknown,
    schema: S,
    ctx?: Context,
  ): z.output<S> {
    const res = schema.safeParse(params);
    if (res.success) {
      return res.data;
    }

    const name = ctx?.action?.name || ctx?.eventName || 'unknown';
    throw new Errors.ValidationError(
      `Parameters validation error on ${name}:\n${z.prettifyError(res.error)}`,
      'VALIDATION_ERROR',
      res.error.issues,
    );
  }

  /**
   * Override BaseValidator middleware to handle our custom compile function.
   */
  override middleware() {
    return {
      name: 'Validator',
      localAction: (handler: ActionHandler, action: ZodActionOrEventSchema) => {
        const schema = getSchemaFromMoleculer(action.params);
        if (!schema) {
          return handler;
        }
        return async (ctx: Context) => {
          // Will throw if validation fails
          ctx.params = this.validate(ctx.params, schema, ctx);
          return handler(ctx);
        };
      },
      localEvent: (
        handler: ServiceEventHandler,
        event: ZodActionOrEventSchema,
      ) => {
        const schema = getSchemaFromMoleculer(event.params);
        if (!schema) {
          return handler;
        }
        return async (ctx: Context) => {
          // Will throw if validation fails
          ctx.params = this.validate(ctx.params, schema, ctx);
          return handler(ctx);
        };
      },
    } as unknown as (handler: ActionHandler, action: ActionSchema) => unknown;
  }
}

declare module 'moleculer' {
  interface BaseValidator {
    validate<S extends ZodType>(params: unknown, schema: S): z.output<S>;
  }
}
