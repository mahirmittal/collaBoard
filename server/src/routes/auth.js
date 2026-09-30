import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models.js';
import { config } from '../config.js';
import { auth } from '../middleware.js';

const router = Router();
const credentials = z.object({ email: z.string().email(), password: z.string().min(8) });
const tokenFor = (user) => jwt.sign({ id: String(user._id), email: user.email }, config.jwtSecret, { expiresIn: '7d' });

router.post('/register', async (req, res, next) => { try {
  const { name, email, password } = credentials.extend({ name: z.string().min(2).max(80) }).parse(req.body);
  if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ error: 'Email already registered' });
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email }, token: tokenFor(user) });
} catch (err) { next(err); } });

router.post('/login', async (req, res, next) => { try {
  const { email, password } = credentials.parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ user: { id: user.id, name: user.name, email: user.email }, token: tokenFor(user) });
} catch (err) { next(err); } });

router.get('/me', auth, async (req, res, next) => { try { const user = await User.findById(req.user.id).select('name email'); res.json({ user: { id: user.id, name: user.name, email: user.email } }); } catch (err) { next(err); } });
export default router;
