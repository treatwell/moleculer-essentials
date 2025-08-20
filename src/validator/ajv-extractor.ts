import { Ajv2019 as Ajv } from 'ajv/dist/2019.js';
import { RefExtractor } from './ref-extractor.js';
import type { SomeJSONSchema } from '../json-schema/index.js';

export class AjvExtractor extends RefExtractor {
  private readonly ajv: Ajv;

  constructor(ajv: Ajv) {
    super();
    this.ajv = ajv;
  }

  protected override refReplacer(ref: string): string {
    return `https://schemas.wavy.fr/${ref}`;
  }

  protected override onNewRef(
    originalRef: string,
    schema: SomeJSONSchema,
  ): void {
    this.ajv.addSchema(schema, this.refReplacer(originalRef));
  }
}
