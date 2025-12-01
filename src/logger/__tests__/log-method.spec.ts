import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pinoLogMethod, wrapLogMethodWithFilter } from '../log-method.js';

describe('log methods', () => {
  const validator = vi.fn();

  beforeEach(() => {
    validator.mockClear();
  });

  it.each([
    { args: [], expected: { msg: '' } },
    { args: ['Test', { a: 1, b: 2 }], expected: { msg: 'Test', a: 1, b: 2 } },
    {
      args: ['Test A', { a: 1, b: 3 }, 'Test B', { a: 5 }],
      expected: { msg: 'Test A Test B', a: 5, b: 3 },
    },
    {
      args: ['Test A', { a: 1, b: 3, msg: 'Test B' }],
      expected: { msg: 'Test A Test B', a: 1, b: 3 },
    },
    {
      args: [
        { a: 1, b: 2 },
        { c: 2, b: 3 },
      ],
      expected: { msg: '', a: 1, b: 3, c: 2 },
    },
  ])('should merge $args to $expected', ({ args, expected }) => {
    pinoLogMethod(args, validator);
    if (expected === null) {
      expect(validator).not.toHaveBeenCalled();
    } else {
      expect(validator).toHaveBeenCalledWith(expected);
    }
  });

  it.each([
    { args: ['test'], filter: /test/, filtered: true },
    { args: ['not matching log'], filter: /test/, filtered: false },
    { args: [{ msg: 'test', a: 1 }], filter: /test/, filtered: true },
  ])(
    'should apply filter $filter to log $args (filtered: $filtered)',
    ({ args, filter, filtered }) => {
      // @ts-expect-error Trouble with vitest fn
      wrapLogMethodWithFilter(validator, filter)(args, () => {}, 0);

      if (filtered) {
        expect(validator).not.toHaveBeenCalled();
      } else {
        expect(validator).toHaveBeenCalledWith(
          args,
          expect.any(Function),
          expect.any(Number),
        );
      }
    },
  );
});
