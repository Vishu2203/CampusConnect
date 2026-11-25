# CampusConnect

A beginner-friendly full-stack student collaboration platform MVP.

## Included features
- Student registration/login (JWT + bcrypt password hashing)
- Student profile and skills
- Create, browse, search and delete projects
- Send join requests and accept/reject requests as project owner
- Bookmark/unbookmark projects
- Responsive React interface
- MongoDB database using Mongoose models

## Requirements
- Node.js 18+
- MongoDB Atlas account (cloud database) or local MongoDB
- Git (recommended)

## 1. Create MongoDB database
Create a free MongoDB Atlas cluster, create a database user, allow your development IP address in Network Access, and copy the Node.js connection string. Replace its username, password and cluster details. The database name in the URI should be `campusconnect`.

## 2. Start the backend
Open a terminal in `backend`:

```bash
npm install
```

Copy `.env.example` to `.env` (Windows PowerShell: `Copy-Item .env.example .env`) and set `MONGODB_URI` and a long random `JWT_SECRET`. Never share or commit `.env`.

```bash
npm run dev
```

Backend runs at `http://localhost:5000`. Test `http://localhost:5000/api/health`.

## 3. Start the frontend
Open another terminal in `frontend`:

```bash
npm install
```

Create `.env` from `.env.example` (PowerShell: `Copy-Item .env.example .env`) and keep `VITE_API_URL=http://localhost:5000/api`. Then run:

```bash
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## 4. First use
Register two student accounts. With the first account, create a project. Sign in with the second account and send a join request. Sign back in as the project owner and accept the request.

## Notes
This is a functional MVP, not a production-hardened service. Before public launch, add email verification, password reset, rate limiting, stronger validation, moderation/reporting, automated tests, backups and monitoring. MongoDB collections are created automatically when the first documents are saved.

## Deployment overview
- Frontend: deploy `frontend` to Vercel; set `VITE_API_URL` to deployed backend URL plus `/api`.
- Backend: deploy `backend` to Render; set `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` and `PORT`.
- Database: MongoDB Atlas. In Atlas Network Access, configure access appropriately; avoid broad public access for production.
- Set backend `CLIENT_URL` to the exact deployed frontend origin.
