import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { Workspace } from './models.js';

export function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try { req.user = jwt.verify(token, config.jwtSecret); next(); } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}

export async function member(req, res, next) {
  const workspaceId = req.params.workspaceId || req.body.workspaceId || req.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
  const workspace = await Workspace.findById(workspaceId);
  const membership = workspace?.members.find((m) => String(m.userId) === req.user.id);
  if (!membership) return res.status(403).json({ error: 'Workspace access denied' });
  req.workspace = workspace; req.membership = membership; next();
}

export function owner(req, res, next) {
  if (req.membership?.role !== 'owner') return res.status(403).json({ error: 'Owner permission required' });
  next();
}

export function errorHandler(err, req, res, next) {
  console.error(err); res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
}
