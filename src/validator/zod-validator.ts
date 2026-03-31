import { type Context, Errors, Validators } from 'moleculer';
import { z, type ZodType } from 'zod/v4';
import { getSchemaFromMoleculer } from './utils.js';

export type ZodActionOrEventSchema = { params?: ZodType };

/**
 * Use zod for schema validation.
 * DO NOT support Async refinements/transforms yet.
 *
 * Transforms MUST BE handled by the consumer directly.
 */
export class ZodValidator extends Validators.Base {
  constructor() {
    super({});
  }

  override compile(): Validators.Base.CheckerFunction {
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
      // @ts-expect-error Moleculer wants action.params to be an object
      localAction: (handler, action: ZodActionOrEventSchema) => {
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
      // @ts-expect-error Moleculer wants action.params to be an object
      localEvent: (handler, event: ZodActionOrEventSchema) => {
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
    };
  }

  override convertSchemaToMoleculer(): Record<string, unknown> {
    throw new Error('Not implemented');
  }
}

declare module 'moleculer' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Validators {
    export interface Base {
      // @ts-expect-error TS2512 validate is abstract but can't be defined on interfaces
      validate<S extends ZodType>(params: unknown, schema: S): z.output<S>;
    }
  }
}
