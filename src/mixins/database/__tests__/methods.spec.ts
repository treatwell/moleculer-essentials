import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection, FindCursor, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { createServiceBroker } from '../../../service-broker/index.js';
import { wrapService } from '../../../types/index.js';
import { AjvValidator } from '../../../validator/index.js';
import { DatabaseConnectionMixin } from '../connection.js';
import { DatabaseMethodsMixin } from '../methods.js';
import { DatabaseMethodsOptions } from '../mixin-types.js';

describe('DB Mixin V2 methods', () => {
  const broker = createServiceBroker({
    validator: new AjvValidator<'default'>(
      {
        default: {
          useDefaults: true,
          coerceTypes: true,
          allErrors: true,
          removeAdditional: false,
          discriminator: true,
        },
      },
      'default',
    ),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: DatabaseMethodsOptions<any, any> = {
    softDelete: false,
    timestamps: false,
    tenantField: false,
  };

  const svc = broker.createService(
    wrapService({
      name: 'test',
      mixins: [
        DatabaseConnectionMixin({ collectionName: 'test' }),
        DatabaseMethodsMixin(opts),
      ],
    }),
  );
  const ctx = { emit: vi.fn() };

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

  describe('prepare update filter method', () => {
    it('should do nothing if timestamp is disabled', () => {
      const changes = { $set: { foo: 'bar' } };
      const expected = { $set: { foo: 'bar' } };

      expect(svc._prepareUpdateFilter(changes, 'create')).toEqual(expected);
      expect(svc._prepareUpdateFilter(changes, 'update')).toEqual(expected);
      expect(svc._prepareUpdateFilter(changes, 'replace')).toEqual(expected);
    });

    describe('create type', () => {
      it('should add timestamps', async () => {
        opts.timestamps = true;
        const changes = { $set: { foo: 'bar' } };

        const res = await col.findOneAndUpdate(
          { _id: { $exists: false } },
          svc._prepareUpdateFilter(changes, 'create'),
          { upsert: true, returnDocument: 'after' },
        );

        expect(res).toEqual({
          _id: expect.any(ObjectId),
          foo: 'bar',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(res?.createdAt).toEqual(res?.updatedAt);
      });

      it('should override timestamps if provided', async () => {
        opts.timestamps = true;
        const changes = {
          $set: {
            createdAt: new Date('2000-02-03'),
            updatedAt: new Date('2000-02-03'),
            foo: 'bar',
          },
        };

        const res = await col.findOneAndUpdate(
          { _id: { $exists: false } },
          svc._prepareUpdateFilter(changes, 'create'),
          { upsert: true, returnDocument: 'after' },
        );

        expect(res).toEqual({
          _id: expect.any(ObjectId),
          foo: 'bar',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });

        // Allow for some time difference between mongo and test.
        const limit = Date.now() - 500;
        expect(res?.createdAt.getTime()).toBeGreaterThan(limit);
        expect(res?.updatedAt.getTime()).toBeGreaterThan(limit);
      });
    });

    describe('update type', () => {
      it('should update updatedAt but not createdAt', async () => {
        opts.timestamps = true;
        await col.insertOne({
          createdAt: new Date('2000-02-03'),
          updatedAt: new Date('2000-02-03'),
          test: 'bar',
        });

        const changes = { $set: { foo: 'bar' } };
        const res = await col.findOneAndUpdate(
          { test: 'bar' },
          svc._prepareUpdateFilter(changes, 'update'),
          { returnDocument: 'after' },
        );

        expect(res?.updatedAt.getTime()).toBeGreaterThan(Date.now() - 500);
        expect(res?.createdAt).toEqual(new Date('2000-02-03'));
      });

      it('should remove createdAt if provided', async () => {
        opts.timestamps = true;
        await col.insertOne({
          createdAt: new Date('2000-02-03'),
          updatedAt: new Date('2000-02-03'),
          test: 'bar',
        });

        const changes = {
          $set: { foo: 'bar' },
          $inc: { createdAt: 1000 * 60 * 60 * 24 * 15 },
        };
        const res = await col.findOneAndUpdate(
          { test: 'bar' },
          svc._prepareUpdateFilter(changes, 'update'),
          { returnDocument: 'after' },
        );

        expect(res?.updatedAt.getTime()).toBeGreaterThan(Date.now() - 500);
        expect(res?.createdAt).toEqual(new Date('2000-02-03'));
      });

      it('should add createdAt if update with upsert', async () => {
        opts.timestamps = true;

        const changes = { $set: { foo: 'bar' } };
        const res = await col.findOneAndUpdate(
          { test: 'bar' },
          svc._prepareUpdateFilter(changes, 'update'),
          { returnDocument: 'after', upsert: true },
        );

        expect(res?.updatedAt.getTime()).toBeGreaterThan(Date.now() - 500);
        expect(res?.createdAt.getTime()).toBeGreaterThan(Date.now() - 500);
      });

      it.each([
        [
          [
            {
              $addFields: {
                test: 'bar',
                createdAt: new Date('2010-02-03'),
                updatedAt: new Date('2010-02-03'),
              },
            },
          ],
        ],
        [[{ $set: { createdAt: new Date('2011-02-03') } }]],
        [[{ $unset: 'createdAt' }]],
        [[{ $unset: ['createdAt'] }]],
        [[{ $unset: ['createdAt', 'test2'] }]],
        [[{ $project: { createdAt: 0 } }]],
        [[{ $project: { test: 1 } }]],
      ])('should work with pipelines %#', async changes => {
        opts.timestamps = true;
        await col.insertOne({
          createdAt: new Date('2000-02-03'),
          updatedAt: new Date('2000-02-03'),
          test: 'bar',
        });

        const res = await col.findOneAndUpdate(
          { test: 'bar' },
          svc._prepareUpdateFilter(changes, 'update'),
          { returnDocument: 'after' },
        );

        expect(res).toEqual({
          _id: expect.any(ObjectId),
          test: 'bar',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(res?.updatedAt.getTime()).toBeGreaterThan(Date.now() - 500);
        expect(res?.createdAt).toEqual(new Date('2000-02-03'));
      });

      it('should prevent using replaceWith in updates', async () => {
        opts.timestamps = true;
        const changes = [{ $replaceWith: { test: 'foo' } }];

        expect.hasAssertions();
        try {
          await col.findOneAndUpdate(
            { test: 'bar' },
            svc._prepareUpdateFilter(changes, 'update'),
            { returnDocument: 'after' },
          );
        } catch (e) {
          expect(e).toMatchSnapshot();
        }
      });
    });

    describe('replace type', () => {
      it('should throw if not a pipeline', async () => {
        opts.timestamps = true;
        await col.insertOne({
          createdAt: new Date('2000-02-03'),
          updatedAt: new Date('2000-02-03'),
          test: 'bar',
        });

        const changes = { $set: { foo: 'bar' } };
        expect.hasAssertions();
        try {
          await col.findOneAndUpdate(
            { test: 'bar' },
            svc._prepareUpdateFilter(changes, 'replace'),
            { returnDocument: 'after' },
          );
        } catch (e) {
          expect(e).toMatchSnapshot();
        }
      });

      it('should keep createdAt field', async () => {
        opts.timestamps = true;
        await col.insertOne({
          createdAt: new Date('2000-02-03'),
          updatedAt: new Date('2000-02-03'),
          test: 'bar',
        });

        const changes = [{ $replaceWith: { foo: 'bar' } }];
        const res = await col.findOneAndUpdate(
          { test: 'bar' },
          svc._prepareUpdateFilter(changes, 'replace'),
          { returnDocument: 'after' },
        );

        expect(res).toEqual({
          _id: expect.any(ObjectId),
          foo: 'bar',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(res?.updatedAt.getTime()).toBeGreaterThan(Date.now() - 500);
        expect(res?.createdAt).toEqual(new Date('2000-02-03'));
      });
    });
  });

  describe('tenant filter method', () => {
    it('should do nothing if no tenantField', () => {
      opts.tenantField = undefined;

      expect(svc._getTenantFilter({ foo: 'bar' })).toEqual({});
    });

    it('should throw if no params are passed', () => {
      opts.tenantField = 'foo';

      expect(() => svc._getTenantFilter(null)).toThrowErrorMatchingSnapshot();
    });

    it('should throw if params does not have field', () => {
      opts.tenantField = 'foo';

      expect(() =>
        svc._getTenantFilter({ bar: 1 }),
      ).toThrowErrorMatchingSnapshot();
    });

    it('should not throw if strict mode is disabled and params does not have field', () => {
      opts.tenantField = 'foo';

      expect(svc._getTenantFilter({ bar: 1 }, false)).toEqual({});
    });

    it('should return the correct mongo filter', () => {
      opts.tenantField = 'foo';

      expect(svc._getTenantFilter({ foo: 'myfoo-shop' })).toEqual({
        foo: 'myfoo-shop',
      });
    });

    it('should return the correct mongo filter (not strict)', () => {
      opts.tenantField = 'foo';

      expect(svc._getTenantFilter({ foo: 'myfoo-shop' }, false)).toEqual({
        foo: 'myfoo-shop',
      });
    });
  });

  describe('soft delete method', () => {
    it('should do nothing if soft delete is disabled', () => {
      opts.softDelete = false;
      expect(svc._getSoftDeleteFilter()).toEqual({});
    });

    it('should return the correct mongo filter (scope: only-deleted)', () => {
      opts.softDelete = true;
      expect(svc._getSoftDeleteFilter('only-deleted')).toEqual({
        deletedAt: { $gte: 0 },
      });
    });

    it('should return the correct mongo filter (scope: no-deleted)', () => {
      opts.softDelete = true;
      expect(svc._getSoftDeleteFilter('no-deleted')).toEqual({
        deletedAt: null,
      });
    });

    it('should return the correct mongo filter (scope: undefined)', () => {
      opts.softDelete = true;
      expect(svc._getSoftDeleteFilter()).toEqual({ deletedAt: null });
    });

    it('should return the correct mongo filter (scope: include-deleted)', () => {
      opts.softDelete = true;
      expect(svc._getSoftDeleteFilter('include-deleted')).toEqual({});
    });

    it('should throw if unknown scope', () => {
      opts.softDelete = true;
      expect(() =>
        svc._getSoftDeleteFilter('test-deleted'),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('get query filter method', () => {
    it('should return the correct mongo filter', () => {
      opts.softDelete = true;
      opts.tenantField = 'foo';

      expect(svc._getQueryFilter({ test: 1 }, { foo: 'myfoo-shop' })).toEqual({
        test: 1,
        foo: 'myfoo-shop',
        deletedAt: null,
      });
    });

    it('should always prioritize feature filters (soft-delete, tenant)', () => {
      opts.softDelete = true;
      opts.tenantField = 'foo';

      expect(
        svc._getQueryFilter(
          { test: 1, foo: 'another-shop', deletedAt: { $gte: 50 } },
          { foo: 'myfoo-shop' },
        ),
      ).toEqual({ test: 1, foo: 'myfoo-shop', deletedAt: null });
    });

    it('should optimize query after all', () => {
      opts.tenantField = 'foo';
      expect(
        svc._getQueryFilter(
          { $or: [{ test: 1 }, { testB: 2 }] },
          { foo: 'myfoo-shop' },
        ),
      ).toEqual({
        $or: [
          { test: 1, foo: 'myfoo-shop' },
          { testB: 2, foo: 'myfoo-shop' },
        ],
      });
    });
  });

  describe('create find cursor', () => {
    it('should return a find cursor', () => {
      expect(svc._createFindCursor({}, null, {})).toBeInstanceOf(FindCursor);
    });

    it('should add query filters', async () => {
      opts.softDelete = true;
      opts.tenantField = 'foo';
      await col.insertMany([
        { foo: 'bar', test: 3, deletedAt: new Date() },
        { foo: 'bar', test: 1 },
        { foo: 'bar', test: 2 },
        { foo: 'bar', test: 3 },
        { foo: 'rab', test: 4 },
      ]);

      const cursor = svc._createFindCursor(
        { test: { $gte: 2 } },
        { foo: 'bar' },
        {},
      );

      expect(cursor).toBeInstanceOf(FindCursor);
      expect(await cursor.toArray()).toHaveLength(2);
    });

    it('should transform sort and projection options', async () => {
      await col.insertMany([
        { part: 3, test: 1 },
        { part: 1, test: 1 },
        { part: 2, test: 2 },
        { part: 4, test: 2 },
      ]);

      const cursor = svc._createFindCursor({}, null, {
        sort: ['-test', 'part'],
        fields: ['part', '-_id'],
      });

      expect(cursor).toBeInstanceOf(FindCursor);
      expect(await cursor.toArray()).toEqual([
        { part: 2 },
        { part: 4 },
        { part: 1 },
        { part: 3 },
      ]);
    });

    it('should transfer driver options', async () => {
      await col.insertMany([
        { part: 3 },
        { part: 1 },
        { part: 2 },
        { part: 4 },
      ]);

      const cursor = svc._createFindCursor({}, null, {
        skip: 2,
        sort: ['part'],
        fields: ['-_id'],
      });

      expect(cursor).toBeInstanceOf(FindCursor);
      expect(await cursor.toArray()).toEqual([{ part: 3 }, { part: 4 }]);
    });
  });

  describe('find one method', () => {
    it('should return null if no document is found', async () => {
      expect(await svc._findOne({})).toBeNull();
    });

    it('should return a single document', async () => {
      await col.insertMany([{ part: 1 }, { part: 2 }]);

      expect(await svc._findOne({}, null, { sort: ['-part'] })).toEqual({
        part: 2,
        _id: expect.any(ObjectId),
      });
    });
  });

  describe('find method', () => {
    it('should return empty array', async () => {
      expect(await svc._find({})).toEqual([]);
    });

    it('should return a all documents', async () => {
      await col.insertMany([{ part: 1 }, { part: 2 }]);

      expect(
        await svc._find({}, null, { sort: ['-part'], fields: ['-_id'] }),
      ).toEqual([{ part: 2 }, { part: 1 }]);
    });
  });

  describe('findStream method', () => {
    it('should return a single document', async () => {
      await col.insertMany([{ part: 2 }, { part: 2 }]);

      const stream = svc._findStream({}, null, { fields: ['-_id'] });

      expect.assertions(3);
      expect(stream).toBeInstanceOf(Readable);

      for await (const doc of stream) {
        expect(doc).toEqual({ part: 2 });
      }
    });
  });

  describe('countDocuments method', () => {
    it('should return the correct number of document', async () => {
      await col.insertMany([{ part: 1 }, { part: 2 }, { part: 4 }]);

      const count = await svc._countDocuments({ part: { $gte: 2 } }, null, {});

      expect(count).toEqual(2);
    });
  });

  describe('insertOne method', () => {
    it('should insert a document', async () => {
      const doc = await svc._insertOne(ctx, { foo: 'bar' });

      expect(doc).toEqual({ _id: expect.any(ObjectId), foo: 'bar' });
    });

    it('should let specify projection', async () => {
      const doc = await svc._insertOne(
        ctx,
        { foo: 'bar' },
        { fields: ['-_id'] },
      );

      expect(doc).toEqual({ foo: 'bar' });
    });

    it('should generate id if generator specified', async () => {
      let id = 0;
      // @ts-expect-error For test purpose
      opts.idGenerator = () => {
        id += 1;
        return `test-${id}`;
      };

      const docA = await svc._insertOne(ctx, { foo: 'bar' });
      const docB = await svc._insertOne(ctx, {
        _id: 'specific-id',
        foo: 'bar',
      });

      expect(docA).toEqual({ _id: 'test-1', foo: 'bar' });
      expect(docB).toEqual({ _id: 'specific-id', foo: 'bar' });
    });
  });

  describe('insertMany method', () => {
    it('should insert many documents', async () => {
      const ids = await svc._insertMany(ctx, [{ foo: 'bar' }, { foo: 'rab' }]);

      expect(ids).toEqual([expect.any(ObjectId), expect.any(ObjectId)]);
    });

    it('should return ObjectIds with forceServerObjectId', async () => {
      const ids = await svc._insertMany(ctx, [{ foo: 'bar' }, { foo: 'rab' }], {
        forceServerObjectId: true,
      });

      expect(ids).toEqual([expect.any(ObjectId), expect.any(ObjectId)]);
    });

    it('should generate id if generator specified', async () => {
      let id = 0;
      // @ts-expect-error For test purpose
      opts.idGenerator = () => {
        id += 1;
        return `test-${id}`;
      };

      const ids = await svc._insertMany(ctx, [
        { foo: 'bar' },
        { _id: 'my-id', foo: 'bar' },
        { foo: 'rab' },
      ]);
      expect(ids).toEqual(['test-1', 'my-id', 'test-2']);
    });
  });

  describe('updateOne method', () => {
    it('should return the after document', async () => {
      await col.insertMany([{ test: 1 }, { test: 2 }, { test: 3 }]);

      const doc = await svc._updateOne(ctx, { test: 2 }, null, {
        $set: { test: 4 },
      });

      expect(doc).toEqual({ test: 4, _id: expect.any(ObjectId) });
    });

    it('should return the after document (with projection)', async () => {
      await col.insertMany([{ test: 1 }, { test: 2 }, { test: 3 }]);

      const doc = await svc._updateOne(
        ctx,
        { test: 2 },
        null,
        { $inc: { test: 2 } },
        { fields: ['-_id'] },
      );

      expect(doc).toEqual({ test: 4 });
    });

    it('should allow to return before version', async () => {
      await col.insertMany([{ test: 1 }, { test: 2 }, { test: 3 }]);

      const doc = await svc._updateOne(
        ctx,
        { test: 2 },
        null,
        { $inc: { test: 2 } },
        { returnDocument: 'before', skipUpdateEvent: true },
      );

      expect(doc).toEqual({ test: 2, _id: expect.any(ObjectId) });
    });

    it('should throw if update event and before doc', async () => {
      opts.eventPrefix = 'test';
      await col.insertMany([{ test: 1 }, { test: 2 }, { test: 3 }]);

      expect.hasAssertions();
      try {
        await svc._updateOne(
          ctx,
          { test: 2 },
          null,
          { $inc: { test: 2 } },
          { returnDocument: 'before' },
        );
      } catch (e) {
        expect(e).toMatchSnapshot();
      }
    });
  });

  describe('updateMany method', () => {
    it('should update many documents', async () => {
      opts.tenantField = 'foo';
      await col.insertMany([
        { test: 1, foo: 'bar' },
        { test: 2, foo: 'bar' },
        { test: 3, foo: 'bar' },
        { test: 3, foo: 'rab' },
      ]);

      const res = await svc._updateMany(
        { test: { $gte: 2 } },
        { foo: 'bar' },
        { $set: { test: 3 } },
      );

      expect(res).toEqual(
        expect.objectContaining({ matchedCount: 2, modifiedCount: 1 }),
      );
    });
  });

  describe('replaceOne method', () => {
    it('should return null if no match', async () => {
      const res = await svc._replaceOne(ctx, {}, null, {
        test: 3,
      });

      expect(res).toBeNull();
    });

    it('should replace a document', async () => {
      await col.insertOne({ test: 2, notDeclared: true });

      const res = await svc._replaceOne(
        ctx,
        { test: { $gte: 2 } },
        null,
        { test: 3 },
        { fields: ['-_id'] },
      );

      expect(res).toEqual({ test: 3 });
    });

    it('should not evaluate operator in document', async () => {
      await col.insertOne({ test: 2 });

      const res = await svc._replaceOne(ctx, { test: { $gte: 2 } }, null, {
        $inc: { test: 1 },
      });

      expect(res).toEqual({
        _id: expect.any(ObjectId),
        $inc: { test: 1 },
      });
    });

    it('should throw if update event and before doc', async () => {
      opts.eventPrefix = 'test';
      await col.insertMany([{ test: 1 }, { test: 2 }, { test: 3 }]);

      expect.hasAssertions();
      try {
        await svc._replaceOne(
          ctx,
          { test: 2 },
          null,
          { test: 7 },
          { returnDocument: 'before' },
        );
      } catch (e) {
        expect(e).toMatchSnapshot();
      }
    });
  });

  describe('deleteOne method', () => {
    it('should delete document', async () => {
      await col.insertOne({ test: 2 });

      const res = await svc._deleteOne(ctx, { test: { $gte: 2 } }, null);

      expect(await col.countDocuments()).toEqual(0);
      expect(res).toEqual({ _id: expect.any(ObjectId), test: 2 });
    });

    it('should soft delete', async () => {
      opts.softDelete = true;
      await col.insertOne({ test: 2 });

      const res = await svc._deleteOne(ctx, { test: { $gte: 2 } }, null);

      expect(await col.find({}).toArray()).toEqual([
        {
          _id: expect.any(ObjectId),
          test: 2,
          deletedAt: expect.any(Date),
        },
      ]);
      expect(res).toEqual({ _id: expect.any(ObjectId), test: 2 });
    });

    it('should respect projection', async () => {
      opts.softDelete = true;
      await col.insertOne({ test: 2 });

      const res = await svc._deleteOne(ctx, { test: { $gte: 2 } }, null, {
        fields: ['-_id'],
      });

      expect(res).toEqual({ test: 2 });
    });
  });

  describe('deleteMany method', () => {
    it('should delete multiple document', async () => {
      await col.insertMany([{ test: 2 }, { test: 3 }, { test: 4 }]);

      const res = await svc._deleteMany({ test: { $gte: 3 } }, null);

      expect(await col.countDocuments()).toEqual(1);
      expect(res).toEqual(2);
    });

    it('should soft delete', async () => {
      opts.softDelete = true;
      await col.insertMany([
        { test: 2 },
        { test: 3 },
        { test: 4, deletedAt: new Date() },
      ]);

      const res = await svc._deleteMany({ test: { $gte: 3 } }, null);

      expect(res).toEqual(1);
      expect(await col.find({}, { sort: { test: 1 } }).toArray()).toEqual([
        {
          _id: expect.any(ObjectId),
          test: 2,
        },
        {
          _id: expect.any(ObjectId),
          test: 3,
          deletedAt: expect.any(Date),
        },
        {
          _id: expect.any(ObjectId),
          test: 4,
          deletedAt: expect.any(Date),
        },
      ]);
    });
  });
});
