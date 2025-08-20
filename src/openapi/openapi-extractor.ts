import type { SomeJSONSchema } from '../json-schema/index.js';
import { RefExtractor } from '../validator/ref-extractor.js';
import type { Document } from './types.js';

export class OpenAPIExtractor extends RefExtractor {
  private readonly doc: Document;

  constructor(doc: Document) {
    super();
    this.doc = doc;
  }

  public override refReplacer(ref: string): string {
    return `#/components/schemas/${ref}`;
  }

  public override onNewRef(originalRef: string, schema: SomeJSONSchema): void {
    if (!this.doc.components) {
      this.doc.components = {};
    }
    if (!this.doc.components.schemas) {
      this.doc.components.schemas = {};
    }
    this.doc.components.schemas[originalRef] = schema;
  }
}
