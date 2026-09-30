import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: resolve(serverRoot, '../.env') });
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/synctask',
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-me',
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '')
};
