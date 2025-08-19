import { randomUUID } from 'node:crypto';
import { afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Declare the global variables used for MongoDB connection
declare global {
  var __MONGO_URI__: string | undefined;
  var __MONGO_DB__: MongoMemoryServer | undefined;
  var __MONGO_DB_NAME__: string | undefined;
}

const server = await MongoMemoryServer.create({});

globalThis.__MONGO_URI__ = server.getUri();
globalThis.__MONGO_DB__ = server;
globalThis.__MONGO_DB_NAME__ = server.instanceInfo?.dbName || randomUUID();

afterAll(async () => {
  await server.stop();
});
