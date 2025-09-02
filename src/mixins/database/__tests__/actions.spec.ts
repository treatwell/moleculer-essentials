import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Collection } from 'mongodb';
import { Context } from 'moleculer';
import { createServiceBroker } from '../../../service-broker/index.js';
import { wrapService } from '../../../types/index.js';
import { addQueryOps } from '../actions/ajv.js';
import { QueryOp } from '../actions/shared.js';
import { DatabaseConnectionMixin } from '../connection.js';
import { DatabaseMethodsMixin } from '../methods.js';
import { DatabaseMethodsOptions } from '../mixin-types.js';

describe('DB Mixin V2 methods', () => {
  const broker = createServiceBroker();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: DatabaseMethodsOptions<any, any> = {
    softDelete: false,
    timestamps: false,
    tenantField: false,
    sQuerySchema: {
      type: 'object',
      additionalProperties: false,
      required: [],
      properties: {
        count: addQueryOps<number>({ type: 'number' }, [
          QueryOp.GT,
          QueryOp.LT,
        ]),
      },
    },
    actions: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [],
        properties: { _id: { type: 'string' }, count: { type: 'number' } },
      },
      count: { visibility: 'public' },
    },
  };

  const svc = broker.createService(
    wrapService({
      name: 'test',
      version: 1,
      mixins: [
        DatabaseConnectionMixin({ collectionName: 'test' }),
        DatabaseMethodsMixin(opts),
      ],
    }),
  );

  broker.createService(
    wrapService({
      name: 'test2',
      version: 1,
      mixins: [
        DatabaseConnectionMixin({ collectionName: 'test' }),
        DatabaseMethodsMixin({ ...opts, sQuerySchema: undefined }),
      ],
    }),
  );

  const col = svc.getCollection() as Collection;

  beforeAll(async () => {
    await broker.start();
    return () => broker.stop();
  });

  beforeEach(async () => {
    await col.deleteMany({});
    opts.tenantField = false;
    opts.softDelete = false;
    opts.timestamps = false;
    opts.idGenerator = undefined;
  });

  describe('count action', () => {
    it('should return the correct number of document', async () => {
      await col.insertMany([{ count: 1 }, { count: 2 }, { count: 4 }]);
      const ctx = Context.create(broker);

      const res1 = await ctx.call('v1.test.count', {});
      expect(res1).toEqual(3);

      const res2 = await ctx.call('v1.test.count', {
        sQuery: JSON.stringify({ count: 1 }),
      });
      expect(res2).toEqual(1);

      const res3 = await ctx.call('v1.test.count', {
        sQuery: JSON.stringify({ count: { $gt: 1 } }),
      });
      expect(res3).toEqual(2);
    });

    it('should throw', async () => {
      await col.insertMany([{ count: 1 }, { count: 2 }, { count: 4 }]);
      const ctx = Context.create(broker);

      await expect(
        ctx.call('v1.test.count', {
          sQuery: JSON.stringify({ count: { $gte: 1 } }),
        }),
      ).rejects.toThrow();
    });

    it('should throw (2)', async () => {
      await col.insertMany([
        { count: 1, m: 1 },
        { count: 2, m: 1 },
        { count: 4, m: 1 },
      ]);
      const ctx = Context.create(broker);

      await expect(
        ctx.call('v1.test.count', {
          sQuery: JSON.stringify({ m: 1 }),
        }),
      ).rejects.toThrow();
    });

    it('should ignore query params', async () => {
      await col.insertMany([{ count: 1 }, { count: 2 }, { count: 4 }]);
      const ctx = Context.create(broker);

      const res1 = await ctx.call('v1.test2.count', {
        sQuery: JSON.stringify({ count: 1 }),
      });
      expect(res1).toEqual(3);
    });
  });
});
