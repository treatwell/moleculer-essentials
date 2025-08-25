import { describe, beforeAll, expect, it } from 'vitest';
import { verify as jwtVerify } from 'jsonwebtoken';
import { generateKeyPairSync } from 'crypto';
import { createServiceBroker } from '../../service-broker/index.js';
import { wrapService } from '../../types/index.js';
import { JwtSignerMixin } from '../jwt.mixin.js';

const keyPair = generateKeyPairSync('ec', {
  namedCurve: 'P-521',
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

describe('Test JWT mixin', () => {
  const broker = createServiceBroker();

  const svc = broker.createService(
    wrapService({
      name: 'test.jwt',
      mixins: [
        JwtSignerMixin({
          privateKey: keyPair.privateKey,
          signOptions: {
            keyid: 'yo',
            issuer: 'test-issuer',
          },
          renewBefore: 30 * 1000,
        }),
      ],
    }),
  );

  beforeAll(async () => {
    await broker.start();
    return () => broker.stop();
  });

  describe('method generateJwt', () => {
    it('should generate a valid token', async () => {
      const token = await svc.generateJwt();

      expect(token).toBeDefined();
      expect(
        jwtVerify(token, keyPair.publicKey, {
          algorithms: ['ES512'],
          issuer: 'test-issuer',
        }),
      ).toBeDefined();
    });
  });

  describe('action getToken', () => {
    it('should generate a valid token', async () => {
      const token = await broker.call<string>('test.jwt.getToken');

      expect(token).toBeDefined();
      expect(
        jwtVerify(token, keyPair.publicKey, {
          algorithms: ['ES512'],
          issuer: 'test-issuer',
        }),
      ).toBeDefined();
    });
  });
});
