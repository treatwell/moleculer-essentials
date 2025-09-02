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
      mixins: [DatabaseConnectionMixin({ collectionName: 'test-b' })],
    }),
  );

  const clientA = svcA.getMongoClient() as MongoClient;
  const clientB = svcB.getMongoClient() as MongoClient;

  beforeAll(async () => {
    await broker.start();
    return () => broker.stop();
  });

  it('should reuse clients', () => {
    expect(clientA).toBeInstanceOf(MongoClient);
    expect(clientA).toBe(clientB);
  });

  it('should successfully connect to mongo server', async () => {
    await clientA.db('admin').command({ ping: 1 });
  });
});
