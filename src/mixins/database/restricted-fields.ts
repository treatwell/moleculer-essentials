import { omit, partition, pick } from 'lodash';

function getFieldMode(fields: string[] | undefined): 'allow' | 'deny' {
  // Get the first field as reference (use second if first is _id)
  const refField = fields?.[0] === '-_id' ? fields?.[1] : fields?.[0];
  if (refField && !refField.startsWith('-')) {
    return 'allow';
  }
  return 'deny';
}

/**
 * This function is here to prevent accessing private (secure) fields.
 *
 * It removes any unauthorized fields from the query if it is an
 * "allowed list" mode. In "deny list" mode or if no list,
 * it adds secure fields to the list.
 *
 * If a query is a mixed of both mode, it throws an error.
 */
export function filterFields(
  fields: string[] | undefined,
  secureFields: string[] | undefined,
): string[] | undefined {
  if (!secureFields?.length) {
    return fields;
  }
  const mode = getFieldMode(fields);

  switch (mode) {
    case 'deny': {
      if (fields?.some(f => !f.startsWith('-'))) {
        throw new Error('All fields must have a "-" prefix in deny mode');
      }
      return [
        ...new Set([...(fields || []), ...secureFields.map(f => `-${f}`)]),
      ];
    }
    case 'allow': {
      if (fields?.some(f => f.startsWith('-') && f !== '-_id')) {
        throw new Error('No fields must have a "-" prefix in allow mode');
      }
      const filteredFields = fields?.filter(
        f => !secureFields.find(sF => f === sF || f.startsWith(`${sF}.`)),
      );
      // If all the fields are secure ones, force projection on _id field
      if (filteredFields?.length === 0) {
        return ['_id'];
      }
      return filteredFields;
    }
    default:
      throw new Error('Should not happen');
  }
}

/**
 * Filter an objects following a fields array.
 * A simpler version of mongo projection logic.
 */
export function filterObjectFields<T extends Record<string, unknown>>(
  obj: Record<string, unknown>,
  fields?: string[],
): T {
  if (!fields?.length) {
    return obj as T;
  }
  let res = obj;
  const [fieldsRemove, fieldsAdd] = partition(fields || [], f =>
    f.startsWith('-'),
  );
  if (fieldsRemove.length) {
    res = omit(
      res,
      fieldsRemove.map(f => f.substring(1)),
    );
  }
  if (fieldsAdd.length) {
    res = pick(res, fieldsAdd);
  }
  return res as T;
}

/**
 * Return an object with each list item as key and 1/0/-1 as value
 * to be used in mongo projection or sort.
 */
export function getQueryFromList<
  T extends 'sort' | 'projection',
  NotOp extends T extends 'sort' ? -1 : 0,
>(type: T, list?: string[]): Record<string, 1 | NotOp> | undefined {
  if (!list?.length) {
    return undefined;
  }
  const res: Record<string, 1 | NotOp> = {};
  list.forEach(el => {
    if (el.startsWith('-')) {
      const p = el.slice(1);
      res[p] = (type === 'sort' ? -1 : 0) as NotOp;
    } else {
      res[el] = 1;
    }
  });
  return res;
}
