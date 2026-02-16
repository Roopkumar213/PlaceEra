# Daily Placement Training PWA

This is a scaffold for the Daily Placement Training PWA project.

## Setup

1.  Clone the repository.
2.  Run `npm install` in both `backend` and `frontend` directories.
3.  Copy `.env.example` to `.env` in `backend` and configure variables.

## Development

-   **Backend**: `cd backend && npm run dev` (Ensure nodemon/ts-node is set up, or just `node index.js`)
-   **Frontend**: `cd frontend && npm run dev`

## Test

-   **Backend**: `cd backend && npm test`
-   **Frontend**: `cd frontend && npm test`

## Worker

-   Worker scripts are located in `backend/src/workers`. Run them using `node backend/src/workers/worker_name.js`.

## Deploy

-   **Backend**: Deploy as a Node.js service (e.g. Render, Railway).
-   **Frontend**: Deploy as a static site (e.g. Vercel, Netlify).
