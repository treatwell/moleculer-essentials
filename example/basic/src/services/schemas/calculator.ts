import { z } from 'zod';

export const SumParams = z.object({
  // Because we get those params from a GET query, we need to coerce them to int
  a: z.coerce.number().int(),
  b: z.coerce.number().int(),
});

export type SumParams = z.infer<typeof SumParams>;

export const MultiplyParams = z.object({
  a: z.int(),
  b: z.int(),
});

export type MultiplyParams = z.infer<typeof MultiplyParams>;
