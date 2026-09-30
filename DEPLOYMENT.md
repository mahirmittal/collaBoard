# Deploy SyncTask for yourself and friends

This guide publishes SyncTask so friends on different networks can use the same board, whiteboard, comments, and real-time updates.

It uses three services:

```text
Browser -> Vercel (the React app) -> Render (API + Socket.IO) -> MongoDB Atlas (data)
```

- **Vercel** serves the frontend quickly over HTTPS.
- **Render** keeps the Express API and Socket.IO server reachable on one public URL.
- **MongoDB Atlas** stores users, workspaces, tasks, comments, and whiteboards.

> Keep `.env` private. Never place the Atlas connection string or `JWT_SECRET` in GitHub, Vercel, screenshots, or messages.

## Before you start

You need accounts for:

1. [GitHub](https://github.com) — stores the code and lets deployment platforms redeploy after each push.
2. [MongoDB Atlas](https://www.mongodb.com/atlas) — your database is already created here.
3. [Render](https://render.com) — hosts the Node.js API and Socket.IO.
4. [Vercel](https://vercel.com) — hosts the React frontend.

The code is already in the GitHub repository. Open it from the GitHub account that owns it before continuing.

## 1. Secure MongoDB Atlas

### Why this is needed

Render must be allowed to connect to Atlas. Atlas rejects every connection until both a database user and a network rule allow it.

### What to do

1. Open Atlas and select your project and cluster.
2. Go to **Database Access**. Create or verify a database user with the `readWrite` role for database `synctask`.
3. Use a long, unique password. If the password uses characters such as `@`, `:`, `/`, or `?`, URL-encode it inside the MongoDB URI.
4. Go to **Network Access** and add the IP addresses permitted to connect.

For a small Render deployment, the practical option is often `0.0.0.0/0` (allow any IP), because shared cloud services can use changing outbound addresses. This does **not** make the data public: a client must still know the private connection string and database-user password. Use a unique password and do not share the URI.

5. Copy the Node.js connection URI from **Connect -> Drivers**. It should look like this:

```text
mongodb+srv://DATABASE_USER:URL_ENCODED_PASSWORD@YOUR_CLUSTER/synctask?retryWrites=true&w=majority
```

The `synctask` portion is the database name for this app.

> If an Atlas password was ever committed or pasted publicly, rotate it in **Database Access** before deploying.

## 2. Deploy the API on Render

### Why deploy the API first

The React app needs the API's public URL at build time. Render gives us that URL first.

### Create the service

1. In Render, select **New + -> Web Service**.
2. Connect GitHub, then choose the `mahirmittal/collaBoard` repository.
3. Use these settings:

| Render setting | Value | Why |
| --- | --- | --- |
| Runtime | `Node` | The API is a Node/Express app. |
| Branch | `main` | Deploys the stable branch. |
| Root Directory | leave blank | The root holds the npm workspaces and lock file. |
| Build Command | `npm ci` | Installs the exact locked dependency versions. |
| Start Command | `npm run start` | Starts only the server workspace in production. |
| Health Check Path | `/api/health` | Lets Render confirm the API and Atlas connection have started. |

4. In **Environment Variables**, add these values:

| Key | Value |
| --- | --- |
| `MONGO_URI` | Your private Atlas `mongodb+srv://...` URI |
| `JWT_SECRET` | A new random secret (see below) |
| `CLIENT_URL` | `https://example.com` temporarily; replace it after deploying Vercel |

Do not set `PORT`. Render supplies it automatically, and this app already reads it.

To generate `JWT_SECRET` locally in PowerShell, run:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

5. Click **Create Web Service** and wait for the deploy to finish.
6. Open this URL in a browser, replacing it with your Render URL:

```text
https://YOUR-API.onrender.com/api/health
```

You should see:

```json
{"status":"ok"}
```

Copy the base API URL, for example `https://synctask-api.onrender.com`. You need it in the next step.

## 3. Deploy the frontend on Vercel

### Why Vercel needs a variable

The browser cannot guess where your API lives. Vite reads `VITE_API_URL` while building the frontend and puts that public URL into the generated JavaScript bundle.

1. In Vercel, select **Add New -> Project**.
2. Import `mahirmittal/collaBoard`.
3. Set **Root Directory** to `client`.
4. Vercel should recognize Vite automatically. If it asks for values, use:

| Vercel setting | Value |
| --- | --- |
| Build Command | `npm run build` |
| Output Directory | `dist` |

5. Before deploying, open **Environment Variables** and add:

```dotenv
VITE_API_URL=https://YOUR-API.onrender.com/api
```

Use your actual Render URL. This is intentionally safe to expose: it is a public API address, not a password.

6. Click **Deploy**.
7. Copy the production URL Vercel provides, such as `https://colla-board.vercel.app`.

## 4. Link the two public services

### Why this final step matters

The server allows requests and Socket.IO connections only from `CLIENT_URL`. This prevents another website from using your API through your friends' browsers.

1. Return to your Render web service.
2. Change `CLIENT_URL` to your exact Vercel production URL, with no trailing slash:

```dotenv
CLIENT_URL=https://colla-board.vercel.app
```

3. Save the variable. Render redeploys automatically; if it does not, select **Manual Deploy -> Deploy latest commit**.
4. Wait until the service is live again.

## 5. Test with a friend

1. Open the Vercel URL in an incognito/private browser window.
2. Create your account and create a workspace.
3. Send your friend the same Vercel URL.
4. Your friend creates an account using their own email address.
5. In your workspace, select **Invite** and enter the email they used to register. The current app intentionally has no email-delivery service, so they must register before you invite them.
6. Have both people open the same workspace, then test:
   - create or move a task;
   - add a comment;
   - draw on the whiteboard;
   - open a task call in two separate browsers.

Task, whiteboard, and live-update features should work from different networks. The call is limited to **two participants** by design.

## Video-call note

The app uses direct browser-to-browser WebRTC media with a public STUN server. HTTPS from Vercel and Render is required for microphone/camera permissions and is provided automatically.

Most friends can connect using STUN alone, but some corporate, college, or restrictive mobile networks block direct WebRTC. If calls fail for some users, add a managed TURN provider later. That is a reliability upgrade; it is not required for boards, whiteboards, or Socket.IO updates.

## Common deployment problems

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Render health check fails | Atlas blocks the connection or `MONGO_URI` is wrong | Verify Network Access, database user, password encoding, and the complete URI. |
| Login works locally but fails on Vercel | `VITE_API_URL` is missing or incorrect | Set it to `https://YOUR-API.onrender.com/api`, then redeploy Vercel. |
| Browser reports a CORS or Socket.IO error | `CLIENT_URL` does not exactly match Vercel's production URL | Update Render `CLIENT_URL`, remove a trailing `/`, and redeploy Render. |
| First request is slow after inactivity | Your chosen Render plan paused the service | Wait for it to wake, or choose an always-on plan. |
| Video connects for one friend but not another | Their network blocks direct WebRTC | Add TURN service credentials to a future call configuration. |

## After deployment

Every push to `main` triggers a new deployment in both Render and Vercel if automatic deploys remain enabled. For safer changes, use a separate Git branch first, test its Vercel preview, then merge into `main`.

Useful provider references: [Render web services](https://render.com/docs/web-services), [Render WebSockets](https://render.com/docs/websocket), [Vercel Vite deployments](https://vercel.com/docs/frameworks/frontend/vite), and [MongoDB Atlas connections](https://www.mongodb.com/docs/atlas/driver-connection/).
