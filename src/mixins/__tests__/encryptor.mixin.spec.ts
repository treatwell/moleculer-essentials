import { randomBytes } from 'crypto';
import {
  getLocalCryptographicMaterialsCache,
  NodeCachingMaterialsManager,
  RawAesKeyringNode,
  RawAesWrappingSuiteIdentifier,
} from '@aws-crypto/client-node';
import {
  describe,
  beforeAll,
  afterAll,
  expect,
  it,
  beforeEach,
  vi,
} from 'vitest';
import { wrapService } from '../../types/index.js';
import { EncryptorMixin, kCmm } from '../encryptor.mixin.js';
import { createServiceBroker } from '../../service-broker/index.js';

describe('Test encryptor service', () => {
  const broker = createServiceBroker();

  const service = broker.createService(
    wrapService({
      name: 'test',
      mixins: [
        EncryptorMixin({
          keyId: undefined,
          cacheMaxAge: 1000,
          cacheCapacity: 100,
          localMasterKey: randomBytes(32).toString('base64'),
        }),
      ],
    }),
  );

  beforeAll(async () => {
    await broker.start();
    return () => broker.stop();
  });

  describe('encrypt method', () => {
    it('should crypt simple string data', async () => {
      const encryptedData = await service.encrypt('hello-world');

      expect(encryptedData).toBeInstanceOf(Buffer);
      const stringifiedVersion = encryptedData.toString('utf-8');
      expect(stringifiedVersion).toContain('aes-local-keyring');
      expect(stringifiedVersion).toContain('aes-local-keyring-namespace');
    });

    it('should crypt Buffer', async () => {
      const encryptedData = await service.encrypt(randomBytes(1024));

      expect(encryptedData).toBeInstanceOf(Buffer);
      const stringifiedVersion = encryptedData.toString('utf-8');
      expect(stringifiedVersion).toContain('aes-local-keyring');
      expect(stringifiedVersion).toContain('aes-local-keyring-namespace');
    });

    it('should handle big buffer of data', async () => {
      const encryptedData = await service.encrypt(randomBytes(1024 * 1024));

      expect(encryptedData).toBeInstanceOf(Buffer);
    });
  });

  describe('decrypt method', () => {
    it('should decrypt simple string data', async () => {
      const encryptedData = await service.encrypt('hello-world');

      const decryptedData = await service.decrypt(encryptedData);

      expect(decryptedData).toBeInstanceOf(Buffer);
      expect(decryptedData.toString('utf-8')).toEqual('hello-world');
    });

    it('should decrypt Buffer', async () => {
      const plainData = randomBytes(1024);
      const encryptedData = await service.encrypt(plainData);

      const decryptedData = await service.decrypt(encryptedData);

      expect(decryptedData).toEqual(plainData);
    });
  });

  describe('cache system', () => {
    const aesKeyring = new RawAesKeyringNode({
      keyName: 'aes-test-name',
      keyNamespace: 'aes-test-namespace',
      wrappingSuite:
        RawAesWrappingSuiteIdentifier.AES256_GCM_IV12_TAG16_NO_PADDING,
      unencryptedMasterKey: randomBytes(32),
    });
    // @ts-expect-error Symbol is not a valid index type
    const originalCmm = service[kCmm];
    const spyEncrypt = vi.spyOn(aesKeyring, '_onEncrypt');
    const spyDecrypt = vi.spyOn(aesKeyring, '_onDecrypt');

    beforeEach(() => {
      spyEncrypt.mockClear();
      spyDecrypt.mockClear();
    });
    afterAll(() => {
      spyEncrypt.mockRestore();
      spyDecrypt.mockRestore();
      // @ts-expect-error Symbol is not a valid index type
      service[kCmm] = originalCmm;
    });

    it('should reuse encrypt keys', async () => {
      // @ts-expect-error Symbol is not a valid index type
      service[kCmm] = new NodeCachingMaterialsManager({
        backingMaterials: aesKeyring,
        cache: getLocalCryptographicMaterialsCache(100),
        maxAge: 1000 * 60 * 5,
        maxMessagesEncrypted: 2,
      });

      await service.encrypt(randomBytes(1024));
      await service.encrypt(randomBytes(1024));
      await service.encrypt(randomBytes(1024));

      expect(spyEncrypt).toHaveBeenCalledTimes(2);
    });

    it('should create data key each time by default', async () => {
      // @ts-expect-error Symbol is not a valid index type
      service[kCmm] = new NodeCachingMaterialsManager({
        backingMaterials: aesKeyring,
        cache: getLocalCryptographicMaterialsCache(100),
        maxAge: 1000 * 60 * 5,
        maxMessagesEncrypted: 1, // Should be set to 1 in service by default
      });

      await service.encrypt(randomBytes(1024));
      await service.encrypt(randomBytes(1024));
      await service.encrypt(randomBytes(1024));

      expect(spyEncrypt).toHaveBeenCalledTimes(3);
    });

    it('should reuse decrypt keys', async () => {
      // @ts-expect-error Symbol is not a valid index type
      service[kCmm] = new NodeCachingMaterialsManager({
        backingMaterials: aesKeyring,
        cache: getLocalCryptographicMaterialsCache(10),
        maxAge: 1000 * 60 * 5,
        maxMessagesEncrypted: 1,
      });
      const encryptedA = await service.encrypt(randomBytes(1024));
      const encryptedB = await service.encrypt(randomBytes(1024));

      await service.decrypt(encryptedA);
      await service.decrypt(encryptedA);
      await service.decrypt(encryptedA);
      await service.decrypt(encryptedB);
      await service.decrypt(encryptedB);

      expect(spyDecrypt).toHaveBeenCalledTimes(2);
    });

    it('should limit number of keys in cache', async () => {
      // @ts-expect-error Symbol is not a valid index type
      service[kCmm] = new NodeCachingMaterialsManager({
        backingMaterials: aesKeyring,
        cache: getLocalCryptographicMaterialsCache(2),
        maxAge: 1000 * 60 * 5,
        maxMessagesEncrypted: 1,
      });
      const encryptedA = await service.encrypt(randomBytes(1024));
      const encryptedB = await service.encrypt(randomBytes(1024));
      const encryptedC = await service.encrypt(randomBytes(1024));

      // Fill LRU cache
      await service.decrypt(encryptedA);
      await service.decrypt(encryptedB);
      await service.decrypt(encryptedC);
      expect(spyDecrypt).toHaveBeenCalledTimes(3);
      spyDecrypt.mockClear();

      // B and C should be in cache
      await service.decrypt(encryptedB);
      await service.decrypt(encryptedC);
      await service.decrypt(encryptedB);
      await service.decrypt(encryptedC);
      expect(spyDecrypt).toHaveBeenCalledTimes(0);
      spyDecrypt.mockClear();

      // A should not be in cache at first
      // but will replace B (LRU)
      await service.decrypt(encryptedA);
      await service.decrypt(encryptedA);
      await service.decrypt(encryptedA);
      expect(spyDecrypt).toHaveBeenCalledTimes(1);
      spyDecrypt.mockClear();

      // Check that B was replaced by A
      await service.decrypt(encryptedB);
      expect(spyDecrypt).toHaveBeenCalledTimes(1);
    });
  });
});
