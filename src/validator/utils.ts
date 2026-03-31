import type { Context } from 'moleculer';

export function getSchemaFromMoleculer<T>(schema: T): undefined | T {
  if (!schema) {
    return undefined;
  }
  if (typeof schema === 'object' && !Array.isArray(schema)) {
    return schema;
  }
  if (typeof schema === 'function') {
    // If the schema is a function, we assume it's from our lockAllParams hack
    const res = schema();
    if (typeof res === 'object' && !Array.isArray(res)) {
      return res;
    }
  }
  return undefined;
}

/**
 * Will check for action or event's schema prop and return it.
 * Return undefined if no action or event is linked to ctx.
 */
export function getContextSchemaField(
  ctx: Context | undefined,
  prop: string,
): unknown {
  if (!ctx) {
    return;
  }
  const schema = ctx.action ?? ctx.event;
  if (!schema) {
    return;
  }
  return (schema as Record<string, unknown>)[prop];
}
