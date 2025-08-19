/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSONSchemaType } from '../json-schema/index.js';

export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

export interface LicenseObject {
  name: string;
  url?: string;
}

export interface InfoObject {
  title: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
  version: string;
}

export interface ServerVariableObject {
  enum?: string[];
  default: string;
  description?: string;
}

export interface ServerObject {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariableObject>;
}

export type PathsObject = Record<string, PathItemObject>;

export interface ExternalDocumentationObject {
  description?: string;
  url: string;
}

export interface ParameterObject extends ParameterBaseObject {
  name: string;
  in: string;
}

export type HeaderObject = ParameterBaseObject;

export interface ParameterBaseObject {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: ReferenceObject | SchemaObject;
  example?: any;
  examples?: Record<string, ReferenceObject | ExampleObject>;
  content?: Record<string, MediaTypeObject>;
}

export type SchemaObject<
  T = any,
  _partial extends boolean = false,
> = JSONSchemaType<T, _partial>;

export interface ReferenceObject {
  $ref: string;
}

export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

export interface EncodingObject {
  contentType?: string;
  headers?: Record<string, ReferenceObject | HeaderObject>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface MediaTypeObject {
  schema?: ReferenceObject | SchemaObject;
  example?: any;
  examples?: Record<string, ReferenceObject | ExampleObject>;
  encoding?: Record<string, EncodingObject>;
}

export interface RequestBodyObject {
  description?: string;
  content: Record<string, MediaTypeObject>;
  required?: boolean;
}

export interface LinkObject {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, any>;
  requestBody?: any;
  description?: string;
  server?: ServerObject;
}

export interface ResponseObject {
  description: string;
  headers?: Record<string, ReferenceObject | HeaderObject>;
  content?: Record<string, MediaTypeObject>;
  links?: Record<string, ReferenceObject | LinkObject>;
}

export type ResponsesObject = Record<string, ReferenceObject | ResponseObject>;

export type SecurityRequirementObject = Record<string, string[]>;

export interface HttpSecurityScheme {
  type: 'http';
  description?: string;
  scheme: string;
  bearerFormat?: string;
}

export interface ApiKeySecurityScheme {
  type: 'apiKey';
  description?: string;
  name: string;
  in: string;
}

export interface OAuth2SecurityScheme {
  type: 'oauth2';
  flows: {
    implicit?: {
      authorizationUrl: string;
      refreshUrl?: string;
      scopes: Record<string, string>;
    };
    password?: {
      tokenUrl: string;
      refreshUrl?: string;
      scopes: Record<string, string>;
    };
    clientCredentials?: {
      tokenUrl: string;
      refreshUrl?: string;
      scopes: Record<string, string>;
    };
    authorizationCode?: {
      authorizationUrl: string;
      tokenUrl: string;
      refreshUrl?: string;
      scopes: Record<string, string>;
    };
  };
}

export interface OpenIdSecurityScheme {
  type: 'openIdConnect';
  description?: string;
  openIdConnectUrl: string;
}

export type SecuritySchemeObject =
  | HttpSecurityScheme
  | ApiKeySecurityScheme
  | OAuth2SecurityScheme
  | OpenIdSecurityScheme;

export type CallbackObject = Record<string, PathItemObject>;

export interface ComponentsObject {
  schemas?: Record<string, ReferenceObject | SchemaObject>;
  responses?: Record<string, ReferenceObject | ResponseObject>;
  parameters?: Record<string, ReferenceObject | ParameterObject>;
  examples?: Record<string, ReferenceObject | ExampleObject>;
  requestBodies?: Record<string, ReferenceObject | RequestBodyObject>;
  headers?: Record<string, ReferenceObject | HeaderObject>;
  securitySchemes?: Record<string, ReferenceObject | SecuritySchemeObject>;
  links?: Record<string, ReferenceObject | LinkObject>;
  callbacks?: Record<string, ReferenceObject | CallbackObject>;
}

export interface TagObject {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
}

export interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
  operationId?: string;
  parameters?: (ReferenceObject | ParameterObject)[];
  requestBody?: ReferenceObject | RequestBodyObject;
  responses?: ResponsesObject;
  callbacks?: Record<string, ReferenceObject | CallbackObject>;
  deprecated?: boolean;
  security?: SecurityRequirementObject[];
  servers?: ServerObject[];
}

export interface PathItemObject {
  $ref?: string;
  summary?: string;
  description?: string;
  get?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  trace?: OperationObject;
  servers?: ServerObject[];
  parameters?: (ReferenceObject | ParameterObject)[];
}

export interface Document {
  openapi: string;
  info: InfoObject;
  servers?: ServerObject[];
  paths: PathsObject;
  components?: ComponentsObject;
  security?: SecurityRequirementObject[];
  tags?: TagObject[];
  externalDocs?: ExternalDocumentationObject;
  'x-express-openapi-additional-middleware'?: (
    | ((request: any, response: any, next: any) => Promise<void>)
    | ((request: any, response: any, next: any) => void)
  )[];
  'x-express-openapi-validation-strict'?: boolean;
}
