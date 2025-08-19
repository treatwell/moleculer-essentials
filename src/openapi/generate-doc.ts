import { merge } from 'lodash';
import { ServiceSchema } from 'moleculer';
import { ZodObject, ZodOptional, ZodType } from 'zod/v4';
import {
  JSONSchemaType,
  omitFields,
  SomeJSONSchema,
} from '../json-schema/index.js';
import { Alias } from '../types/index.js';
import { getSchemaFromMoleculer } from '../validator/utils.js';
import {
  Document,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  ResponsesObject,
} from './types.js';
import { OpenAPIExtractor } from './openapi-extractor.js';
import { zodToOpenAPISchema } from '../zod/zod-helpers.js';

type HTTPMethod =
  | 'get'
  | 'put'
  | 'post'
  | 'delete'
  | 'options'
  | 'head'
  | 'patch'
  | 'trace';

export type GenerateDocParams = {
  /**
   * Mutable OpenAPI document
   */
  doc: Document;
  /**
   * Services used to allow service level openapi specs
   */
  services: ServiceSchema[];
  /**
   * All path available by the moleculer-web API Gateway
   * Those should be sorted to be stable across generations.
   */
  aliases: Alias[];
  /**
   * Gives the list of security schemes to apply for a specific action.
   */
  getSecuritySchemes?: (action: Alias) => string[] | undefined | false;
};

/**
 * Create an OpenAPI document of the current
 * list of services and aliases.
 *
 * Will:
 * - Merge `settings.openapi` field of all services globally
 *
 * Note: Mutate `doc` variable
 */
export function generateOpenAPISpec({
  doc,
  aliases,
  services,
  getSecuritySchemes,
}: GenerateDocParams): Document {
  // First, merge service openapi
  services.forEach(svc => merge(doc, svc.settings?.openapi));

  const extractor = new OpenAPIExtractor(doc);

  // Extract refs from schemas injected in services settings
  if (doc.components?.schemas) {
    const { schemas } = doc.components;
    // Reset schemas before extracting refs
    doc.components.schemas = {};
    for (const [key, val] of Object.entries(schemas)) {
      doc.components.schemas[key] = extractor.extract(
        val,
        `#/components/schemas/${key}`,
        true,
      );
    }
  }

  // Now for each alias, generate its Operation OpenAPI spec
  for (const alias of aliases) {
    const url = alias.fullPath.replace(/:(\w+)/g, '{$1}');
    const p = doc.paths[url] || {};
    doc.paths[url] = p;

    const op = createOperationFromAlias(alias, extractor, url);
    p[<HTTPMethod>alias.methods.toLowerCase()] = op;

    if (op.responses) {
      op.responses['401'] = {
        $ref: '#/components/responses/UnauthorizedError',
      };
      op.responses['422'] = { $ref: '#/components/responses/ValidationError' };
      op.responses['5XX'] = { $ref: '#/components/responses/ServerError' };
    }

    const authModes = getSecuritySchemes?.(alias);
    if (authModes) {
      op.security = authModes.map(authMode => ({ [authMode]: [] }));
    }
  }

  // Make components.schemas stable
  if (doc.components?.schemas) {
    const sortedEntries = Object.entries(doc.components.schemas).sort((a, b) =>
      a[0] > b[0] ? 1 : -1,
    );
    doc.components.schemas = Object.fromEntries(sortedEntries);
  }

  return doc;
}

export function createOperationFromAlias(
  alias: Alias,
  extractor: OpenAPIExtractor,
  url: string,
): OperationObject {
  let parameters: ParameterObject[] | undefined;
  let requestBody: RequestBodyObject | undefined;

  extractor.setMeta({ url, alias });
  // Load parameters from fullPath
  const pathParams = url.match(/{(\w+)}/g) || [];
  const params = getSchemaFromMoleculer(alias.action.params);

  // Create params from Zod/Ajv Schema
  if (params instanceof ZodType) {
    ({ parameters, requestBody } = createOperationFromZodParams(
      params,
      pathParams,
      alias,
      extractor,
    ));
  } else {
    ({ parameters, requestBody } = createOperationFromAjvParams(
      params as JSONSchemaType<Record<string, unknown>, false>,
      pathParams,
      alias,
      extractor,
    ));
  }

  const openapi = alias.action.openapi || {};

  // Add/override existing parameters with the ones declared in openapi
  if (openapi.parameters) {
    if (!parameters) {
      parameters = [];
    }
    for (const param of openapi.parameters) {
      const newP = param as ParameterObject; // We don't handle refs here
      const idx = parameters.findIndex(p => p.name === newP.name);
      if (idx === -1) {
        parameters.push(newP);
      } else {
        parameters[idx] = newP;
      }
    }
  }

  const responses: ResponsesObject = {};
  if (openapi.responses) {
    for (const [key, val] of Object.entries(openapi.responses)) {
      responses[key] = val;

      // Extract schema from responses
      const content = (val as ResponseObject).content?.['application/json'];

      if (
        content &&
        'zodInstance' in content &&
        typeof content.zodInstance === 'function'
      ) {
        content.schema = zodToOpenAPISchema(content.zodInstance(), extractor);
      } else if (content?.schema) {
        content.schema = extractor.extract(content.schema);
      }
    }
  }

  return {
    requestBody, // Let openapi override requestBody
    operationId: alias.actionName,
    ...openapi,
    responses,
    parameters,
  };
}

export function createOperationFromAjvParams(
  params: JSONSchemaType<Record<string, unknown>, false>,
  pathParams: string[],
  alias: Alias,
  extractor: OpenAPIExtractor,
): { parameters?: ParameterObject[]; requestBody?: RequestBodyObject } {
  const parameters: ParameterObject[] = [];
  let requestBody: RequestBodyObject | undefined;

  if (pathParams.length) {
    parameters.push(
      ...pathParams.map(p => {
        const name = p.slice(1, -1);
        return {
          in: 'path',
          name,
          required: true,
          schema: extractor.extract(
            params?.properties?.[name] || { type: 'string' },
          ),
        };
      }),
    );
  }

  if (['get', 'delete'].includes(alias.methods.toLowerCase())) {
    const schemas = [
      ...(params?.allOf || []),
      ...(params?.oneOf || []),
      ...(params?.anyOf || []),
      ...(params && 'properties' in params ? [params] : []),
    ] as SomeJSONSchema[];

    for (const schema of schemas) {
      parameters.push(
        ...Object.entries(schema.properties)
          // Do not add query params that already are in path
          .filter(([key]) => !parameters.find(p => p.name === key))
          .map(([key, val]) => ({
            in: 'query',
            name: key,
            schema: extractor.extract(val || { type: 'string' }),
            required: schema.required?.includes(key),
          })),
      );
    }
  } else if (params) {
    // We can do this as extractor.extract can handle allOf
    requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: extractor.extract(
            omitFields(
              params,
              parameters.map(p => p.name),
              alias.action.bodySchemaRefName,
            ),
          ),
        },
      },
    };
  }
  return { requestBody, parameters };
}

export function createOperationFromZodParams(
  params: ZodType,
  pathParams: string[],
  alias: Alias,
  extractor: OpenAPIExtractor,
): { parameters?: ParameterObject[]; requestBody?: RequestBodyObject } {
  const parameters: ParameterObject[] = [];
  let requestBody: RequestBodyObject | undefined;

  if (!(params instanceof ZodObject)) {
    throw new Error(
      `Expected params to be an ZodObject in ${alias.actionName}`,
    );
  }

  if (pathParams.length) {
    parameters.push(
      ...pathParams.map(p => {
        const name = p.slice(1, -1);
        return {
          in: 'path',
          name,
          required: true,
          schema: zodToOpenAPISchema(params.shape[name], extractor),
        };
      }),
    );
  }

  if (['get', 'delete'].includes(alias.methods.toLowerCase())) {
    parameters.push(
      ...Object.entries(params.shape)
        // Do not add query params that already are in path
        .filter(([key]) => !parameters.find(p => p.name === key))
        .map(([key, val]) => ({
          in: 'query',
          name: key,
          schema: zodToOpenAPISchema(val, extractor),
          required: !(val instanceof ZodOptional),
        })),
    );
  } else if (params) {
    let zodBody = params;
    // If it exists, remove existing parameters
    if (parameters.length > 0) {
      zodBody = params.omit(
        Object.fromEntries(parameters.map(p => [p.name, true])) as never,
      );
    }
    if (alias.action.bodySchemaRefName) {
      zodBody = zodBody.meta({ id: alias.action.bodySchemaRefName });
    }

    requestBody = {
      required: true,
      content: {
        'application/json': { schema: zodToOpenAPISchema(zodBody, extractor) },
      },
    };
  }

  return { requestBody, parameters };
}
