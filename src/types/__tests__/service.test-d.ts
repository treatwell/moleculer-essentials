import { assertType, describe, it } from 'vitest';
import type {
  ServiceWithInference,
  PartialCustomServiceSchema,
} from '../service.js';

describe('ServiceWithInference type tests', () => {
  it('should handle recursive mixins', () => {
    const a = {} as ServiceWithInference<
      { test: 1 },
      { rootMethod(a: number): number },
      [
        PartialCustomServiceSchema<
          unknown,
          { mixinA(b: number): number },
          [
            PartialCustomServiceSchema<
              unknown,
              { subMixinA(b: number): number },
              unknown
            >,
          ]
        >,
        PartialCustomServiceSchema<
          unknown,
          { mixinB(b: number): number },
          unknown
        >,
        PartialCustomServiceSchema<
          unknown,
          { mixinA(b: string): string },
          unknown
        >,
        PartialCustomServiceSchema<
          unknown,
          object,
          [
            PartialCustomServiceSchema<
              { subProp: string },
              { subMixinB(b: number): number },
              unknown
            >,
          ]
        >,
        PartialCustomServiceSchema<{ base: string }, unknown, unknown>,
        PartialCustomServiceSchema<unknown, unknown, []>,
      ]
    >;

    // Settings merging
    assertType<string[] | undefined>(a.settings.$secureSettings);
    assertType<number>(a.settings.test);
    assertType<string>(a.settings.base);
    assertType<string>(a.settings.subProp);
    // @ts-expect-error Doesn't exist
    assertType<number>(a.settings.unknownProp);

    // Root level methods
    assertType<number>(a.rootMethod(1));

    // First level mixin methods
    assertType<number>(a.mixinA(1));
    assertType<string>(a.mixinA('a'));
    assertType<number>(a.mixinB(1));
    // @ts-expect-error Check return type immutability
    assertType<boolean>(a.mixinA(1));

    // Second level mixin methods
    assertType<number>(a.subMixinA(1));

    // All unknown props should be typed as unknown
    // @ts-expect-error Unknown methods
    assertType(a.unknownFunction(1));
    assertType<unknown>(a.unknownProp);
  });
});
