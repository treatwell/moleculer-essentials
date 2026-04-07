import { assertType, describe, it } from 'vitest';
import { wrapService } from '../index.js';
import { createServiceBroker } from '../../service-broker/index.js';

describe('wrapService function tests', () => {
  it('should allow simple use', () => {
    const Service = wrapService({
      name: 'test',
      settings: { test: 1 as const },
      methods: {
        methodA(a: number): number {
          return a + 1;
        },

        methodB(): 'exact' {
          return 'exact';
        },
      },
    });
    const broker = createServiceBroker();
    const svc = broker.createService(Service);

    assertType<number>(svc.methodA(1));
    assertType<'exact'>(svc.methodB());
    assertType<1>(svc.settings.test);
    // Allow any calls for easier testing
    assertType(svc.unknown());
  });
});
