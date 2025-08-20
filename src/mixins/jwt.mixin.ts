import {
  type JwtHeader,
  type PrivateKey,
  sign as jwtSign,
  type SigningKeyCallback,
  type SignOptions,
  verify,
  type VerifyOptions,
} from 'jsonwebtoken';
import { JwksClient, type Options } from 'jwks-rsa';
import { type Context, Errors } from 'moleculer';
import { wrapMixin } from '../types/index.js';

export type JwtSignerMixinSettings = {
  signOptions: SignOptions;
  privateKey: PrivateKey;
  /**
   * Set to false to disable caching of the JWT token.
   */
  renewBefore: number | false;

  /**
   * Set to true to disable the getToken action.
   */
  disableAction?: boolean;
};

export function JwtSignerMixin(opts: JwtSignerMixinSettings) {
  const { privateKey, signOptions, renewBefore, disableAction } = opts;

  let jwt: string | null = null;
  let expiryDate: number | null = null;

  return wrapMixin({
    methods: {
      generateJwt(payload: string | Buffer | object = {}): Promise<string> {
        const options: SignOptions = {
          algorithm: 'ES512',
          notBefore: '-2s',
          ...signOptions,
        };

        return new Promise<string>((resolve, reject) =>
          jwtSign(payload, privateKey, options, (err, token) =>
            err || !token ? reject(err) : resolve(token),
          ),
        );
      },
    },

    actions: {
      getToken: disableAction
        ? false
        : {
            visibility: 'public',
            params: {
              type: 'object',
              additionalProperties: false,
              required: [],
              properties: {},
            },
            async handler(): Promise<string> {
              if (
                renewBefore &&
                jwt &&
                expiryDate &&
                expiryDate - Date.now() > renewBefore
              ) {
                return jwt;
              }

              jwt = await this.generateJwt();
              if (typeof signOptions.expiresIn === 'number') {
                expiryDate = Date.now() + signOptions.expiresIn * 1000; // Convert seconds to milliseconds
              }

              return jwt;
            },
          },
    },
  });
}

export type JwtVerifierMixinSettings = {
  jwksOptions: Options;
  validClaim: VerifyOptions;
};

export function JwtVerifierMixin(opts: JwtVerifierMixinSettings) {
  const { jwksOptions, validClaim } = opts;

  const jwksClient = new JwksClient(jwksOptions);

  return wrapMixin({
    methods: {
      getJwksClient(): JwksClient {
        return jwksClient;
      },
      /**
       * Used with jsonwebtoken verify function. Retrieves the signing public key
       * from the kid defined in the JWT header.
       */
      async getVerifyPublicKey(
        header: JwtHeader,
        callback: SigningKeyCallback,
      ): Promise<void> {
        try {
          const key = await this.getJwksClient().getSigningKey(header.kid);
          callback(null, key.getPublicKey());
        } catch (err) {
          callback(err as Error);
        }
      },

      /**
       * Will validate the JWT token signature but also some claims like the issuer.
       */
      verifyJwt(token: string): Promise<void> {
        return new Promise((resolve, reject) => {
          verify(
            token,
            (header, callback) => this.getVerifyPublicKey(header, callback),
            validClaim,
            err => (err ? reject(err) : resolve()),
          );
        });
      },

      async verifyAuthorizationHeader(
        ctx: Context,
        value: string | undefined,
      ): Promise<void> {
        if (
          !value ||
          typeof value !== 'string' ||
          !value.startsWith('Bearer ')
        ) {
          throw new Errors.MoleculerError(
            'Incorrect bearer format authorization',
            401,
            'Unauthorized',
          );
        }

        const token = value.slice(7);
        if (!token) {
          throw new Errors.MoleculerError(
            'Incorrect token',
            401,
            'Unauthorized',
          );
        }

        try {
          await this.verifyJwt(token);
        } catch (err) {
          ctx.logger.warn('Unable to verify JWT', { err });
          throw new Errors.MoleculerError(
            'Unable to verify JWT',
            401,
            'Unauthorized',
          );
        }
      },
    },
  });
}
