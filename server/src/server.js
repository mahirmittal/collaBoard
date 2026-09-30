import http from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import app from './app.js';
import { config } from './config.js';
import { attachSockets } from './sockets.js';

let memoryDatabase;
const mongoUri = process.env.USE_MEMORY_DB === 'true'
  ? (memoryDatabase = await (await import('mongodb-memory-server')).MongoMemoryServer.create()).getUri()
  : config.mongoUri;

await mongoose.connect(mongoUri);
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.clientUrl } });
app.set('io', io); attachSockets(io);
server.listen(config.port, () => console.log(`SyncTask API listening on ${config.port}`));

async function shutdown() {
  await mongoose.disconnect();
  await memoryDatabase?.stop();
  process.exit(0);
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
