import assert from 'node:assert/strict';
import http from 'node:http';
import test, { after, before } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';

let database;
let server;
let baseUrl;

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  app.set('io', { to: () => ({ emit: () => {} }) });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await database.stop();
});

test('user can create a workspace, task, and whiteboard item', async () => {
  const email = `test-${crypto.randomUUID()}@example.test`;
  const registration = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email, password: 'Password123!' })
  });
  assert.equal(registration.status, 201);
  const { token } = await registration.json();
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const createdWorkspace = await fetch(`${baseUrl}/workspaces`, {
    method: 'POST', headers, body: JSON.stringify({ name: 'Test Workspace' })
  });
  assert.equal(createdWorkspace.status, 201);
  const { workspace } = await createdWorkspace.json();

  const workspaceResponse = await fetch(`${baseUrl}/workspaces/${workspace._id}`, { headers });
  assert.equal(workspaceResponse.status, 200);
  const details = await workspaceResponse.json();
  assert.deepEqual(details.columns.map((column) => column.name), ['To Do', 'In Progress', 'Done']);

  const createdTask = await fetch(`${baseUrl}/workspaces/${workspace._id}/tasks`, {
    method: 'POST', headers,
    body: JSON.stringify({ title: 'Ship the demo', columnId: details.columns[0]._id, priority: 'high' })
  });
  assert.equal(createdTask.status, 201);

  const whiteboard = await fetch(`${baseUrl}/workspaces/${workspace._id}/whiteboard`, {
    method: 'PUT', headers,
    body: JSON.stringify({ elements: [{ id: 'note-1', type: 'stickyNote', x: 10, y: 10, content: 'Ready' }] })
  });
  assert.equal(whiteboard.status, 200);
  const result = await whiteboard.json();
  assert.equal(result.whiteboard.elements[0].content, 'Ready');
});
