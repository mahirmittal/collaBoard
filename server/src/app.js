import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import { errorHandler } from './middleware.js';

const app = express();
app.use(cors({ origin: config.clientUrl }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }), authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use(errorHandler);
export default app;
