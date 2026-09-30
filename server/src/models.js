import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const userSchema = new Schema({ name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, passwordHash: { type: String, required: true } }, { timestamps: true });
const workspaceSchema = new Schema({ name: { type: String, required: true, trim: true }, ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, members: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, role: { type: String, enum: ['owner', 'member'], default: 'member' } }] }, { timestamps: true });
const columnSchema = new Schema({ workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true }, name: { type: String, required: true }, position: { type: Number, required: true } }, { timestamps: true });
const taskSchema = new Schema({ workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true }, columnId: { type: Schema.Types.ObjectId, ref: 'Column', required: true }, title: { type: String, required: true, trim: true }, description: { type: String, default: '' }, priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }, assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }, position: { type: Number, default: 0 } }, { timestamps: true });
const commentSchema = new Schema({ taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true }, authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, text: { type: String, required: true, trim: true } }, { timestamps: true });
const activitySchema = new Schema({ workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true }, taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null }, actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, type: { type: String, required: true }, metadata: { type: Schema.Types.Mixed, default: {} } }, { timestamps: true });
const whiteboardSchema = new Schema({ workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, unique: true }, elements: { type: [Schema.Types.Mixed], default: [] } }, { timestamps: true });

export const User = model('User', userSchema);
export const Workspace = model('Workspace', workspaceSchema);
export const Column = model('Column', columnSchema);
export const Task = model('Task', taskSchema);
export const Comment = model('Comment', commentSchema);
export const Activity = model('Activity', activitySchema);
export const Whiteboard = model('Whiteboard', whiteboardSchema);
