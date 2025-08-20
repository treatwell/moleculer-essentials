import type { GenericObject } from 'moleculer';
import { isObject } from 'lodash';

/**
 * >>> Override base flattenTags function to handle objectIDs.
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
  obj: GenericObject,
  convertToString = false,
  path = '',
): GenericObject {
  if (!obj) return null as unknown as GenericObject;

  return Object.keys(obj).reduce((res, k) => {
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
  }, {} as GenericObject);
}
