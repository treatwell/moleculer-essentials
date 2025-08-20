import {
  buildClient,
  CommitmentPolicy,
  getLocalCryptographicMaterialsCache,
  KmsKeyringNode,
  type KeyringNode,
  NodeCachingMaterialsManager,
  RawAesKeyringNode,
  RawAesWrappingSuiteIdentifier,
} from '@aws-crypto/client-node';
import { wrapMixin } from '../types/index.js';

// Exported for testing purposes only
export const kCmm = Symbol('AWS KMS CMM');
const kClient = Symbol('AWS KMS client');

export type EncryptorMixinSettings = {
  // Always force to set keyId (even to undefined) to be sure to declare it
  // in production env.
  keyId: string | undefined;
  cacheMaxAge: number;
  cacheCapacity: number;
  cacheMaxBytesEncrypted?: number;
  cacheMaxMessagesEncrypted?: number;
  // Only used when keyId is undefined
  // Default to process.env.LOCAL_KMS_MASTER_KEY
  localMasterKey?: string;
};

export function EncryptorMixin({
  keyId,
  cacheMaxMessagesEncrypted,
  cacheMaxAge,
  cacheCapacity,
  cacheMaxBytesEncrypted,
  localMasterKey = process.env.LOCAL_KMS_MASTER_KEY,
}: EncryptorMixinSettings) {
  return wrapMixin({
    methods: {
      getEncryptorClient(): ReturnType<typeof buildClient> {
        // @ts-expect-error Symbol is not a valid index type
        return this[kClient];
      },

      /**
       * Get a keyring for a specific key ID
       * This keyring is wrapped in a caching manager in order to reduce KMS calls.
       *
       * More info: https://docs.aws.amazon.com/encryption-sdk/latest/developer-guide/data-key-caching.html
       */
      getEncryptorCmm(): NodeCachingMaterialsManager {
        let cmm = this[kCmm] as NodeCachingMaterialsManager;
        if (!cmm) {
          let keyring: KeyringNode;

          if (keyId) {
            keyring = new KmsKeyringNode({ generatorKeyId: keyId });
          } else if (localMasterKey) {
            // AWS SDK requires an isolated buffer (with byteOffset to 0)
            const buffer = Buffer.from(localMasterKey, 'base64');
            const unencryptedMasterKey = Buffer.alloc(
              buffer.byteLength,
              buffer,
            );
            keyring = new RawAesKeyringNode({
              keyName: 'aes-local-keyring',
              keyNamespace: 'aes-local-keyring-namespace',
              wrappingSuite:
                RawAesWrappingSuiteIdentifier.AES256_GCM_IV12_TAG16_NO_PADDING,
              unencryptedMasterKey,
            });
          } else {
            throw new Error('Missing KMS key ID in EncryptorMixin');
          }
          cmm = new NodeCachingMaterialsManager({
            backingMaterials: keyring,
            cache: getLocalCryptographicMaterialsCache(cacheCapacity),
            maxAge: cacheMaxAge,
            maxMessagesEncrypted: cacheMaxMessagesEncrypted || 1,
            maxBytesEncrypted: cacheMaxBytesEncrypted,
          });
          this[kCmm] = cmm;
        }
        return cmm;
      },

      async encrypt(plainData: Buffer | string): Promise<Buffer> {
        const { encrypt } = this.getEncryptorClient();

        const { result } = await encrypt(this.getEncryptorCmm(), plainData, {});
        return result;
      },
      async decrypt(encryptedData: Uint8Array | string): Promise<Buffer> {
        const { decrypt } = this.getEncryptorClient();

        const { plaintext } = await decrypt(
          this.getEncryptorCmm(),
          encryptedData,
          {},
        );
        return plaintext;
      },
    },

    created() {
      this[kClient] = buildClient({
        commitmentPolicy: CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT,
        maxEncryptedDataKeys: false,
      });
    },
  });
}
