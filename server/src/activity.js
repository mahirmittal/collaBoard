import { Activity } from './models.js';
export async function logActivity(workspaceId, actorId, type, taskId = null, metadata = {}) {
  return Activity.create({ workspaceId, actorId, type, taskId, metadata });
}
