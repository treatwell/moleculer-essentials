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
