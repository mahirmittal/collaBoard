# SyncTask

A lightweight real-time collaboration platform for small teams: Kanban tasks, a shared whiteboard, task comments, and low-bandwidth 1-to-1 task calls.

For a beginner-friendly production deployment using MongoDB Atlas, Render, and Vercel, read [DEPLOYMENT.md](./DEPLOYMENT.md).

## Included

- JWT authentication and protected, rate-limited APIs
- Multi-member workspaces with owner/member roles
- Kanban task board with task details, assignees, comments, activity, drag-and-drop movement, and real-time updates
- Persisted collaborative whiteboard with freehand drawing, sticky notes, text, rectangles, arrows, colors, and live cursors
- Task-linked WebRTC calls for two participants
- Docker Compose and MongoDB persistence

## Start locally

1. Open a terminal in `C:\dev\collaBoard`.
2. Run `npm run install:clean`. This explicitly disables any inherited offline-mode setting.
3. Run `npm run dev:memory`.
4. Open `http://localhost:5173`.

`dev:memory` starts a temporary in-memory MongoDB instance automatically. It is ideal for local demos and testing, but data resets whenever the backend stops.

For persistent data, copy `.env.example` to `.env`, start MongoDB with `docker compose up mongo -d`, then run `npm run dev`.

Or run the complete container stack: `docker compose up --build`.

If Docker is not installed and you want persistent local data, install MongoDB Community Server. The default local connection is `mongodb://127.0.0.1:27017/synctask`.

## MongoDB Atlas

Atlas is recommended for a deployed portfolio project. The application already reads its database connection from `MONGO_URI`.

1. In Atlas, create a database deployment and a **database user** with `readWrite` access to the `synctask` database.
2. In **Network Access**, allow your current public IP for local development. When deployed, add the backend host's outbound IP. Avoid allowing every IP address except for a short-lived test.
3. In the Atlas **Connect → Drivers** dialog, copy the Node.js `mongodb+srv://` URI.
4. Copy `.env.atlas.example` to `.env`, replace the URI placeholders, then run `npm run dev`.

If the database password contains characters such as `@`, `:`, `/`, or `?`, URL-encode it in the connection string. Atlas database users are separate from your Atlas dashboard login.

## Architecture

Express REST routes handle durable reads/writes. Socket.IO broadcasts workspace-scoped updates only after persistence. WebRTC moves audio/video directly between the two browsers; Socket.IO only exchanges signaling messages. A public STUN server supports development. A production deployment should configure a TURN server for users behind restrictive networks.

## Scope limits

One board and whiteboard per workspace, and 1-to-1 calls only. No file uploads, email delivery, recordings, screen sharing, billing, AI diagrams, whiteboard exports, or multi-server Socket.IO scaling.
