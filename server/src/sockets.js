import jwt from 'jsonwebtoken';
import { Workspace, Task } from './models.js';
import { config } from './config.js';
import { logActivity } from './activity.js';

const callRooms = new Map();

export function attachSockets(io) {
  io.use((socket, next) => {
    try { socket.user = jwt.verify(socket.handshake.auth?.token, config.jwtSecret); next(); } catch { next(new Error('Unauthorized')); }
  });
  io.on('connection', (socket) => {
    socket.workspaceIds = new Set();
    socket.on('workspace:join', async ({ workspaceId }, done) => {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace?.members.some((m) => String(m.userId) === socket.user.id)) return done?.({ error: 'Workspace access denied' });
      socket.join(`workspace:${workspaceId}`); socket.workspaceIds.add(String(workspaceId)); done?.({ ok: true });
    });
    socket.on('whiteboard:cursor', ({ workspaceId, cursor }) => {
      if (!socket.workspaceIds.has(String(workspaceId))) return;
      socket.to(`workspace:${workspaceId}`).emit('whiteboard:cursor', { userId: socket.user.id, name: socket.user.email, cursor });
    });
    socket.on('call:join', async ({ workspaceId, taskId }, done) => {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace?.members.some((m) => String(m.userId) === socket.user.id)) return done?.({ error: 'Workspace access denied' });
      const task = await Task.findOne({ _id: taskId, workspaceId });
      if (!task) return done?.({ error: 'Task does not belong to this workspace' });
      const participants = callRooms.get(taskId) || new Set();
      if (participants.size >= 2 && !participants.has(socket.id)) return done?.({ error: 'This task call already has two participants' });
      const wasEmpty = participants.size === 0; participants.add(socket.id); callRooms.set(taskId, participants); socket.join(`call:${taskId}`); socket.callTaskId = taskId;
      socket.workspaceId = String(workspaceId);
      if (wasEmpty) await logActivity(workspaceId, socket.user.id, 'call_started', taskId);
      socket.to(`call:${taskId}`).emit('call:user-joined', { socketId: socket.id, name: socket.user.email });
      done?.({ ok: true, peers: [...participants].filter((id) => id !== socket.id) });
    });
    const relay = (event, payload) => {
      const { taskId, targetId } = payload;
      const participants = callRooms.get(taskId);
      if (socket.callTaskId !== taskId || !participants?.has(socket.id) || !participants.has(targetId)) return;
      io.to(targetId).emit(event, { fromId: socket.id, ...payload });
    };
    socket.on('webrtc:offer', (payload) => relay('webrtc:offer', payload));
    socket.on('webrtc:answer', (payload) => relay('webrtc:answer', payload));
    socket.on('webrtc:ice-candidate', (payload) => relay('webrtc:ice-candidate', payload));
    socket.on('call:leave', () => leaveCall(socket, io));
    socket.on('disconnect', () => leaveCall(socket, io));
  });
}

async function leaveCall(socket, io) {
  const taskId = socket.callTaskId; if (!taskId) return;
  const participants = callRooms.get(taskId); participants?.delete(socket.id); socket.to(`call:${taskId}`).emit('call:user-left', { socketId: socket.id });
  if (!participants?.size) { callRooms.delete(taskId); if (socket.workspaceId) await logActivity(socket.workspaceId, socket.user.id, 'call_ended', taskId); }
  socket.callTaskId = null;
}
