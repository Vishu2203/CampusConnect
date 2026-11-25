# CampusConnect deployment (MongoDB edition)

## MongoDB Atlas
1. Create an Atlas project and cluster.
2. Create a database user (username/password).
3. Add your IP address in Network Access for local development. For hosted deployment, configure access for the backend host according to Atlas guidance; do not expose credentials.
4. Copy the Node.js driver connection string and use database name `campusconnect`.

## Render backend
- Create a Web Service from the GitHub repository.
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL` (exact Vercel origin), `NODE_ENV=production`. Render supplies `PORT`.

## Vercel frontend
- Import the same repository as a separate Vercel project.
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://YOUR-BACKEND.onrender.com/api`

After deployment, test registration, login, profile update, project creation/search/deletion, join requests, and bookmarks.
