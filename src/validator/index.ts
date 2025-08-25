import { z, ZodType } from 'zod/v4';
import { Ajv2019 as Ajv, ErrorObject, Options } from 'ajv/dist/2019.js';
import {
  ActionHandler,
  ActionSchema,
  Context,
  Errors,
  ServiceBroker,
  ServiceEventHandler,
  Validators,
} from 'moleculer';
import addFormats from 'ajv-formats';
import addKeywords from 'ajv-keywords';
import { constant } from 'lodash-es';
import {
  loadTransforms,
  applyBeforeTransforms,
  applyAfterTransforms,
} from './transformers.js';
import { AjvExtractor } from './ajv-extractor.js';
import type { ValidationSchema } from './types.js';
import {
  COERCE_ARRAY_ATTRIBUTE,
  SCHEMA_REF_NAME,
} from '../json-schema/index.js';
import { getSchemaFromMoleculer } from './utils.js';
import { ZodActionOrEventSchema, ZodValidator } from './zod-validator.js';

type ActionOrEventValidatorSchema<Mode extends string> = {
  params?: ValidationSchema | ZodType;
  validatorMode?: Mode;
};

type ValidatorFixedMiddleware = {
  name: string;
  localAction: (handler: ActionHandler, action: ZodActionOrEventSchema) => void;
  localEvent: (
    handler: ServiceEventHandler,
    event: ZodActionOrEventSchema,
  ) => void;
};

/**
 * Moleculer validator using Ajv/zod for schema validation.
 *
 * It also supports some additional features:
 * - Property transformations depending on the schema (Dates, ObjectIds, array coercion)
 * - Ref extractor, used to optimize schema compilation, and generate better OpenAPI specs
 *
 * Some config can be done at the action level:
 * - disableTransforms: Disable all transformations for this action
 * - validatorMode: Use a different validator mode for this action
 */
export class AjvValidator<Mode extends string> extends Validators.Base {
  private readonly modes: Map<
    Mode,
    { validator: Ajv; extractor: AjvExtractor }
  >;

  private readonly defaultMode: Mode;

  // broker is a property of the base class
  private readonly broker!: ServiceBroker;

  public readonly zodValidator?: ZodValidator;

  /**
   * Cache of compiled validation functions.
   * This is because compiling a schema is quite expensive for Ajv.
   */
  private compiledFns: WeakMap<
    ValidationSchema,
    (params: unknown, ctx?: Context) => boolean
  > = new WeakMap();

  constructor(
    opts: Record<Mode, Options>,
    defaultMode: Mode,
    zodValidator?: ZodValidator,
  ) {
    super();

    this.defaultMode = defaultMode;
    this.zodValidator = zodValidator;
    this.modes = new Map();
    for (const [mode, ajvOpts] of Object.entries(opts)) {
      const validator = new Ajv(ajvOpts!);
      this.modes.set(mode as Mode, {
        validator,
        extractor: new AjvExtractor(validator),
      });

      // @ts-expect-error Ajv doesn't like ESM modules
      addFormats(validator);
      // @ts-expect-error Ajv doesn't like ESM modules
      addKeywords(validator);

      // AJV will ignore this keyword, but it will be used by the transformers
      validator.addKeyword({
        keyword: COERCE_ARRAY_ATTRIBUTE,
        valid: true,
      });

      // The object-id format should never be used directly, but through OBJECTID_TYPE
      // which already includes the pattern.
      validator.addFormat('object-id', {
        type: 'string',
        validate: constant(true),
      });
    }
  }

  /**
   * Validate a set of parameters against a schema.
   *
   * May have a small performance hit on the first call for a specific schema,
   * as it will compile the schema.
   */
  override validate(params: unknown, schema: ValidationSchema): true;
  override validate<S extends ZodType>(params: unknown, schema: S): z.output<S>;
  override validate<S extends ZodType>(
    params: unknown,
    schema: ValidationSchema | S,
  ): boolean | z.output<S> {
    if (schema instanceof ZodType) {
      if (!this.zodValidator) {
        throw new Error('No validator to handle zod schemas');
      }
      return this.zodValidator.validate(params, schema);
    }
    return this.compile(schema)(params);
  }

  /**
   * This method compiles a schema into a validation function.
   *
   * Compiling a schema is quite expensive, so it will only be done once per schema.
   */
  compile(schema: ValidationSchema, mode: Mode = this.defaultMode) {
    if (this.compiledFns.has(schema)) {
      return this.compiledFns.get(schema)!;
    }

    // Find validator that will handle this schema
    const validatorMode = this.modes.get(mode);
    if (!validatorMode) {
      throw new Error(`Validator mode ${mode} doesn't exist.`);
    }

    try {
      loadTransforms(schema);
    } catch (err) {
      const strSchema = JSON.stringify(schema, undefined, 2);
      this.broker.logger.error(
        'Error loading transforms for schema',
        strSchema,
      );
      throw err;
    }

    const { validator, extractor } = validatorMode;
    const refSchema = extractor.extract(schema);

    const fn = (params: unknown, ctx?: Context) => {
      if (!ctx?.action?.disableTransforms) {
        applyBeforeTransforms(schema, params as Record<string, unknown>);
      }
      // AJV use cache for compilation so no perf hit here.
      // Compiling schemas on demand allow 30% faster startups
      const validate = validator.compile(refSchema);
      const res = validate(params);
      if (res !== true) {
        const name = ctx?.action?.name || ctx?.eventName || 'unknown';
        this.logError(name, schema, validate.errors);
        throw new Errors.ValidationError(
          `Parameters validation error on ${name}: ${validator.errorsText(
            validate.errors,
          )}`,
          'VALIDATION_ERROR',
          validate.errors || [],
        );
      }
      if (!ctx?.action?.disableTransforms) {
        applyAfterTransforms(schema, params as Record<string, unknown>);
      }
      return true;
    };
    this.compiledFns.set(schema, fn);
    return fn;
  }

  /**
   * For debugging purposes, log the validation errors.
   * This is only enabled if the DETAILED_AJV_VALIDATION_ERRORS env var is set to 'yes'.
   */
  logError(
    name: string,
    schema: ValidationSchema,
    errors?: null | ErrorObject[],
  ) {
    if (process.env.DETAILED_AJV_VALIDATION_ERRORS !== 'yes') {
      return;
    }

    const errorLogMessage = `Validation of parameters given to ${name} against schema ${
      schema[SCHEMA_REF_NAME]
    } gave the following errors:\n${(errors || [])
      .map(
        ({ message, params: errorParameters, instancePath, schemaPath }) =>
          `- ${message} ${JSON.stringify(
            errorParameters,
          )} @${instancePath} in ${schemaPath}`,
      )
      .join('\n')}`;
    this.broker.logger.error(errorLogMessage);
  }

  /**
   * We wrap the localAction and localEvent methods to add validation to the actions and events handlers.
   * Note that we lazy compile schemas in order to avoid a performance hit on startup.
   */
  middleware() {
    let zodMiddleware =
      this.zodValidator?.middleware() as unknown as ValidatorFixedMiddleware;
    if (!zodMiddleware) {
      zodMiddleware = {
        name: 'Validator',
        localAction() {
          throw new Error('No validator to handle zod schemas');
        },
        localEvent() {
          throw new Error('No validator to handle zod schemas');
        },
      };
    }

    return {
      name: 'Validator',
      localAction: (
        handler: ActionHandler,
        action: ActionOrEventValidatorSchema<Mode>,
      ) => {
        const schema = getSchemaFromMoleculer(action.params);
        if (!schema) {
          return handler;
        }

        if (schema instanceof ZodType) {
          return zodMiddleware.localAction(
            handler,
            action as ZodActionOrEventSchema,
          );
        }

        const validate = this.compile(schema, action.validatorMode);
        return async (ctx: Context) => {
          // Will throw if validation fails
          validate(ctx.params != null ? ctx.params : {}, ctx);
          return handler(ctx);
        };
      },
      localEvent: (
        handler: ServiceEventHandler,
        event: ActionOrEventValidatorSchema<Mode>,
      ) => {
        const schema = getSchemaFromMoleculer(event.params);
        if (!schema) {
          return handler;
        }

        if (schema instanceof ZodType) {
          return zodMiddleware.localEvent(
            handler,
            event as ZodActionOrEventSchema,
          );
        }

        const validate = this.compile(schema, event.validatorMode);
        return async (ctx: Context) => {
          // Will throw if validation fails
          validate(ctx.params != null ? ctx.params : {}, ctx);
          return handler(ctx);
        };
      },
    } as unknown as (handler: ActionHandler, action: ActionSchema) => unknown;
  }
}

declare module 'moleculer' {
  interface BaseValidator {
    validate(params: unknown, schema: ValidationSchema): true;
  }
}
