import {
  Collection,
  CollectionOptions,
  MongoClient,
  CreateCollectionOptions,
  MongoError,
} from 'mongodb';
import { wrapMixin } from '../../types/index.js';
import { GlobalStoreMixin } from '../global-store.mixin.js';

// Declare the global variables used for MongoDB connection
declare global {
  var __MONGO_URI__: string | undefined;
  var __MONGO_DB_NAME__: string | undefined;
}

export type DatabaseConnectionOptions = {
  /**
   * Name of the database to use.
   * If not specified, will use the default one (inferred from uri).
   *
   * OVERRIDDEN by globalThis.__MONGO_DB_NAME__ if set, which is useful for tests.
   */
  databaseName?: string;
  /**
   * Name of the collection in the DB.
   */
  collectionName: string;
  /**
   * Collection creation options.
   * If not specified, will use the default one.
   * Note that it shouldn't be changed without being sure of what you are doing.
   */
  createCollectionOptions?: CreateCollectionOptions;

  /**
   * URI of the MongoDB server.
   * If not specified, will try to use one from environment:
   * - process.env.MONGO_URL
   * - process.env.MONGODB_URL
   * - 'mongodb://localhost:27017' (default)
   *
   * OVERRIDDEN by globalThis.__MONGO_URI__ if set, which is useful for tests.
   */
  uri?: string;
};

export function DatabaseConnectionMixin<
  TSchema extends Record<string, unknown> = never,
>(opts: DatabaseConnectionOptions) {
  const { databaseName, collectionName, createCollectionOptions } = opts;
  const uri =
    globalThis.__MONGO_URI__ ||
    opts.uri ||
    process.env.MONGO_URL ||
    process.env.MONGODB_URL ||
    'mongodb://localhost:27017';

  // Allow override the DB name for testing purposes.
  const dbName = globalThis.__MONGO_DB_NAME__
    ? `${globalThis.__MONGO_DB_NAME__}-${databaseName}`
    : databaseName;

  // Key is the uri, but we may want to add other options in the future
  const key = uri;

  return wrapMixin({
    mixins: [GlobalStoreMixin<MongoClient>()],

    methods: {
      getMongoClient(): MongoClient {
        return this.mongoClient;
      },
      getCollection(options?: CollectionOptions): Collection<TSchema> {
        return this.getMongoClient()
          .db(dbName)
          .collection<TSchema>(collectionName, options);
      },
    },
    created() {
      let client = this.getFromStore('mongodb', key);
      this.logger.debug(
        'MongoDB mixin starting, loading mongo client from store',
      );
      if (!client) {
        this.logger.info(
          "Didn't find mongo client in store, creating a new one",
        );
        client = new MongoClient(uri);
        this.setClientToStore('mongodb', key, client, async () => {
          this.logger.debug('Closing mongoDB connection');
          await client?.close();
          this.logger.info('MongoDB connection closed');
        });

        client.on('error', err => this.logger.error('MongoDB error', err));
      }
      this.mongoClient = client;
    },
    async started() {
      // Mongo driver already have a lock that will return the same promise if it's already connecting
      this.logger.debug('Service connecting to mongoDB');
      await this.getMongoClient().connect();
      this.logger.debug('Service connected to mongoDB, creating collection');
      try {
        await this.getMongoClient()
          .db(dbName)
          .createCollection(collectionName, createCollectionOptions);
      } catch (err) {
        // Code 48 === Collection already exists
        if ((err as MongoError)?.code !== 48) {
          this.logger.error('Error while creating collection', { err });
        }
      }
    },
    async stopped() {
      await this.removeServiceFromStore('mongodb', key);
    },
  });
}
