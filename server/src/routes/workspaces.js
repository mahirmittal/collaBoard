import { Router } from 'express';
import { z } from 'zod';
import { Workspace, User, Column, Task, Comment, Activity, Whiteboard } from '../models.js';
import { auth, member, owner } from '../middleware.js';
import { logActivity } from '../activity.js';

const router = Router();
const emit = (req, room, event, data) => req.app.get('io').to(`workspace:${room}`).emit(event, data);

router.get('/', auth, async (req, res, next) => { try { const workspaces = await Workspace.find({ 'members.userId': req.user.id }).sort('-updatedAt'); res.json({ workspaces }); } catch (err) { next(err); } });
router.post('/', auth, async (req, res, next) => { try {
  const { name } = z.object({ name: z.string().min(2).max(80) }).parse(req.body);
  const workspace = await Workspace.create({ name, ownerId: req.user.id, members: [{ userId: req.user.id, role: 'owner' }] });
  await Column.insertMany(['To Do', 'In Progress', 'Done'].map((name, position) => ({ workspaceId: workspace.id, name, position })));
  await Whiteboard.create({ workspaceId: workspace.id, elements: [] });
  res.status(201).json({ workspace });
} catch (err) { next(err); } });

router.get('/:workspaceId', auth, member, async (req, res, next) => { try {
  await req.workspace.populate('members.userId', 'name email');
  const [columns, tasks, whiteboard] = await Promise.all([Column.find({ workspaceId: req.workspace.id }).sort('position'), Task.find({ workspaceId: req.workspace.id }).sort('position').populate('assigneeId', 'name email').populate('createdBy', 'name'), Whiteboard.findOne({ workspaceId: req.workspace.id })]);
  res.json({ workspace: req.workspace, columns, tasks, whiteboard: whiteboard || { elements: [] } });
} catch (err) { next(err); } });

router.post('/:workspaceId/invite', auth, member, owner, async (req, res, next) => { try {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(404).json({ error: 'Ask the teammate to register first' });
  if (req.workspace.members.some((m) => String(m.userId) === user.id)) return res.status(409).json({ error: 'User is already in this workspace' });
  req.workspace.members.push({ userId: user.id, role: 'member' }); await req.workspace.save();
  res.json({ workspace: req.workspace });
} catch (err) { next(err); } });

router.post('/:workspaceId/columns', auth, member, owner, async (req, res, next) => { try {
  const { name } = z.object({ name: z.string().min(1).max(40) }).parse(req.body);
  const position = await Column.countDocuments({ workspaceId: req.workspace.id }); const column = await Column.create({ workspaceId: req.workspace.id, name, position });
  emit(req, req.workspace.id, 'column:created', column); res.status(201).json({ column });
} catch (err) { next(err); } });

router.post('/:workspaceId/tasks', auth, member, async (req, res, next) => { try {
  const data = z.object({ title: z.string().min(1).max(140), description: z.string().max(5000).optional(), priority: z.enum(['low','medium','high']).optional(), columnId: z.string(), assigneeId: z.string().nullable().optional() }).parse(req.body);
  const column = await Column.findOne({ _id: data.columnId, workspaceId: req.workspace.id }); if (!column) return res.status(400).json({ error: 'Invalid board column' });
  if (data.assigneeId && !req.workspace.members.some((m) => String(m.userId) === data.assigneeId)) return res.status(400).json({ error: 'Assignee must belong to workspace' });
  const position = await Task.countDocuments({ columnId: column.id }); const task = await Task.create({ ...data, workspaceId: req.workspace.id, createdBy: req.user.id, position });
  const populated = await task.populate(['assigneeId','createdBy']); await logActivity(req.workspace.id, req.user.id, 'task_created', task.id, { title: task.title });
  emit(req, req.workspace.id, 'task:created', populated); res.status(201).json({ task: populated });
} catch (err) { next(err); } });

async function taskInWorkspace(req, res, next) {
  const task = await Task.findById(req.params.taskId); if (!task) return res.status(404).json({ error: 'Task not found' }); req.workspaceId = task.workspaceId.toString();
  const workspace = await Workspace.findById(req.workspaceId); const membership = workspace?.members.find((m) => String(m.userId) === req.user.id); if (!membership) return res.status(403).json({ error: 'Workspace access denied' }); req.task = task; req.workspace = workspace; req.membership = membership; next();
}

router.patch('/tasks/:taskId', auth, taskInWorkspace, async (req, res, next) => { try {
  const updates = z.object({ title: z.string().min(1).max(140).optional(), description: z.string().max(5000).optional(), priority: z.enum(['low','medium','high']).optional(), assigneeId: z.string().nullable().optional() }).parse(req.body);
  if (updates.assigneeId && !req.workspace.members.some((m) => String(m.userId) === updates.assigneeId)) return res.status(400).json({ error: 'Assignee must belong to workspace' });
  Object.assign(req.task, updates); await req.task.save(); const task = await req.task.populate(['assigneeId','createdBy']); await logActivity(req.workspace.id, req.user.id, 'task_updated', task.id, updates);
  emit(req, req.workspace.id, 'task:updated', task); res.json({ task });
} catch (err) { next(err); } });

router.patch('/tasks/:taskId/move', auth, taskInWorkspace, async (req, res, next) => { try {
  const { columnId, position } = z.object({ columnId: z.string(), position: z.number().nonnegative() }).parse(req.body);
  const column = await Column.findOne({ _id: columnId, workspaceId: req.workspace.id }); if (!column) return res.status(400).json({ error: 'Invalid board column' });
  req.task.columnId = columnId; req.task.position = position; await req.task.save(); const task = await req.task.populate(['assigneeId', 'createdBy']); await logActivity(req.workspace.id, req.user.id, 'task_moved', task.id, { columnId, position }); emit(req, req.workspace.id, 'task:moved', task); res.json({ task });
} catch (err) { next(err); } });

router.delete('/tasks/:taskId', auth, taskInWorkspace, async (req, res, next) => { try { await Comment.deleteMany({ taskId: req.task.id }); await req.task.deleteOne(); await logActivity(req.workspace.id, req.user.id, 'task_deleted', req.task.id, { title: req.task.title }); emit(req, req.workspace.id, 'task:deleted', { id: req.task.id }); res.status(204).end(); } catch (err) { next(err); } });

router.get('/tasks/:taskId/details', auth, taskInWorkspace, async (req, res, next) => { try { const [comments, activity] = await Promise.all([Comment.find({ taskId: req.task.id }).sort('createdAt').populate('authorId','name'), Activity.find({ taskId: req.task.id }).sort('createdAt').populate('actorId','name')]); res.json({ task: req.task, comments, activity }); } catch (err) { next(err); } });
router.post('/tasks/:taskId/comments', auth, taskInWorkspace, async (req, res, next) => { try { const { text } = z.object({ text: z.string().min(1).max(2000) }).parse(req.body); const comment = await Comment.create({ taskId: req.task.id, authorId: req.user.id, text }); await comment.populate('authorId','name'); await logActivity(req.workspace.id, req.user.id, 'comment_added', req.task.id); emit(req, req.workspace.id, 'comment:created', comment); res.status(201).json({ comment }); } catch (err) { next(err); } });

router.put('/:workspaceId/whiteboard', auth, member, async (req, res, next) => { try { const { elements } = z.object({ elements: z.array(z.any()).max(1000) }).parse(req.body); const whiteboard = await Whiteboard.findOneAndUpdate({ workspaceId: req.workspace.id }, { elements }, { new: true, upsert: true }); emit(req, req.workspace.id, 'whiteboard:updated', { elements }); res.json({ whiteboard }); } catch (err) { next(err); } });
router.delete('/:workspaceId/whiteboard', auth, member, owner, async (req, res, next) => { try { const whiteboard = await Whiteboard.findOneAndUpdate({ workspaceId: req.workspace.id }, { elements: [] }, { new: true }); await logActivity(req.workspace.id, req.user.id, 'whiteboard_cleared'); emit(req, req.workspace.id, 'whiteboard:updated', { elements: [] }); res.json({ whiteboard }); } catch (err) { next(err); } });
export default router;
