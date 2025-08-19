import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { ZodValidator } from '../zod-validator.js';

function createValidator() {
  return new ZodValidator();
}

describe('ZodValidator', () => {
  it('should convert string to date', () => {
    const validator = createValidator();

    const res = validator.validate('123', z.coerce.number().int());

    expect(res).toEqual(123);
  });

  it('should remove undeclared properties', () => {
    const validator = createValidator();

    const schema = z.object({
      a: z.string(),
      b: z.coerce.boolean(),
    });

    // Also check typing
    const res: z.infer<typeof schema> = validator.validate(
      { a: 'abc', b: 'true', c: 'should be removed' },
      schema,
    );

    expect(res).toEqual({ a: 'abc', b: true });
  });
});
