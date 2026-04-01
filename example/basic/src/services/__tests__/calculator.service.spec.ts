import { describe, beforeAll, expect, it } from 'vitest';
import { createServiceBroker } from '@treatwell/moleculer-essentials';
import CalculatorService from '../calculator.service.js';

describe('Test encryptor service', () => {
  const broker = createServiceBroker();

  const service = broker.createService(CalculatorService);

  beforeAll(async () => {
    await broker.start();
    return () => broker.stop();
  });

  describe('sum action', () => {
    it('should correctly sum 2 numbers', async () => {
      expect(service.sum(1, 2)).toEqual(3);
    });
  });
});
