import { beforeAll, describe, expect, it } from 'vitest';
import { MongoClient } from 'mongodb';
import { createServiceBroker } from '../../../service-broker/index.js';
import { wrapService } from '../../../types/index.js';
import { DatabaseConnectionMixin } from '../connection.js';

describe('DB Mixin V2 connection', () => {
  const broker = createServiceBroker();

  const svcA = broker.createService(
    wrapService({
      name: 'test-a',
      mixins: [DatabaseConnectionMixin({ collectionName: 'test-a' })],
    }),
  );

  const svcB = broker.createService(
    wrapService({
      name: 'test-b',
      mixins: [
        DatabaseConnectionMixin({
          collectionName: 'test-b',
          createCollectionOptions: { collation: { locale: 'fr' } },
        }),
      ],
    }),
  );

  const svcC = broker.createService(
    wrapService({
      name: 'test-c',
      mixins: [DatabaseConnectionMixin({ collectionName: undefined })],
    }),
  );

  const clientA = svcA.getMongoClient() as MongoClient;
  const clientB = svcB.getMongoClient() as MongoClient;
  const clientC = svcC.getMongoClient() as MongoClient;

  beforeAll(async () => {
    await broker.start();
    return () => broker.stop();
  });

  it('should reuse clients', () => {
    expect(clientA).toBeInstanceOf(MongoClient);
    expect(clientB).toBe(clientA);
    expect(clientC).toBe(clientA);
  });

  it('should have created collections with related options', async () => {
    const cols = await svcA.getMongoDb().listCollections().toArray();

    expect(cols.length).toEqual(2);
    expect(cols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'test-a' }),
        expect.objectContaining({
          name: 'test-b',
          options: expect.objectContaining({
            collation: expect.objectContaining({ locale: 'fr' }),
          }),
        }),
      ]),
    );
  });

  it('should successfully connect to mongo server', async () => {
    await clientA.db('admin').command({ ping: 1 });
  });
});
