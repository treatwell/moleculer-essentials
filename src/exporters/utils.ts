import { isObject } from 'es-toolkit/compat';

/**
 * Override base flattenTags function to handle objectIDs.
 *
 * Flattening tags to one-level object.
 * E.g.
 *  **From:**
 *  ```js
 *  { error: { name: "MoleculerError" } }
 *  ```
 *
 * **To:**
 *  ```js
 *  { "error.name": "MoleculerError" }
 *  ```
 */
export function flattenTags(
  obj: object,
  convertToString = false,
  path = '',
): Record<string, unknown> | null {
  if (!obj) return null;

  return Object.keys(obj).reduce(
    (res, k) => {
      // @ts-expect-error Can't easilly cast objects to any
      const o = obj[k];
      const pp = (path ? `${path}.` : '') + k;

      if (isObject(o)) {
        if ('toHexString' in o) {
          res[pp] = o.toString();
        } else {
          Object.assign(res, flattenTags(o, convertToString, pp));
        }
      } else if (o !== undefined && o !== null) {
        res[pp] = convertToString ? String(o) : o;
      }
      return res;
    },
    {} as Record<string, unknown>,
  );
}
