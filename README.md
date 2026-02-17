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

## Docker Setup

### Prerequisites
- Docker and Docker Compose installed.

### Running with Docker

1.  **Start all services:**
    ```bash
    docker-compose up --build
    ```

2.  **Stop all services:**
    ```bash
    docker-compose down
    ```

3.  **View logs:**
    ```bash
    docker-compose logs -f
    ```

4.  **Service URLs:**
    - Frontend: http://localhost:3000
    - Backend: http://localhost:5000

### Production Mode

To run in production mode (using production builds and secure settings):

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

