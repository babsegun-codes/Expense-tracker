# Expense Tracker

A fully functional three-tier expense tracker built with React, Node.js/Express and MongoDB.

## Features

- Create, edit and delete expenses
- Search by title, category or description
- Filter by category and month
- Dashboard totals, monthly spending, transaction count and average
- MongoDB persistence with a Docker volume
- REST API with validation and health checks
- Docker Compose deployment with service health checks
- Responsive interface

## Architecture

Browser → React/Vite + Nginx → Express API → MongoDB

## Docker deployment

From the repository root:

```bash
docker compose down
docker compose up --build -d
```

Check the services:

```bash
docker compose ps
docker compose logs backend
```

Open the application at:

- Frontend: http://localhost:801
- Backend API: http://localhost:4600
- Backend health: http://localhost:4600/health

MongoDB is intentionally exposed only inside the Docker network.

## Local development

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

For local frontend development, Vite uses `http://localhost:4600/api` by default.

## API

- `GET /api/expenses` — list expenses
- `POST /api/expenses` — create an expense
- `PUT /api/expenses/:id` — update an expense
- `DELETE /api/expenses/:id` — delete an expense
- `GET /health` — API/database health

## Important

Do not commit production secrets. The Docker Compose file currently contains development credentials for the local MongoDB container; replace them with secrets before a public production deployment.
