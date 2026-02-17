# Elevare Installation Guide

## 1. Requirements

Before starting, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v6 or higher) - [Download](https://www.mongodb.com/try/download/community)
  - *Optional if using Docker or a cloud instance.*
- **Redis** (Optional) - Required for background jobs.
- **Git** - [Download](https://git-scm.com/)

## 2. Quick Setup (Recommended)

We provide automated scripts to install all dependencies for you.

### Windows (PowerShell)
```powershell
./setup.ps1
```

### Linux / macOS (Bash)
```bash
chmod +x setup.sh
./setup.sh
```

## 3. Manual Setup

If you prefer to install manually:

**Backend:**
```bash
cd backend
cp .env.example .env  # Configure your environment variables
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

## 4. Running the Project

### Local Development (No Docker)

1.  **Start Backend:**
    ```bash
    cd backend
    npm run dev
    ```
    Runs on: `http://localhost:5000`

2.  **Start Frontend:**
    ```bash
    cd frontend
    npm run dev
    ```
    Runs on: `http://localhost:5173` (or similar)

3.  **Environment Variables:**
    Ensure `backend/.env` is configured correctly.
    - `MONGO_URI`: Connection string to your MongoDB instance.
    - `REDIS_HOST`: Redis host (default `localhost`).

### Docker Setup (Optional)

If you have Docker installed, you can spin up the entire environment:

```bash
docker-compose up --build
```

This will start Backend, Frontend, MongoDB, and Redis automatically.
