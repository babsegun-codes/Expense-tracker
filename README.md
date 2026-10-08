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

- POST /api/auth/register — register with email and password (minimum 10 characters)
- POST /api/auth/login — sign in and receive a JWT
- GET /api/auth/me — get the signed-in user (Bearer token required)
- POST /api/auth/claim-legacy — claim unassigned legacy expenses (Bearer token and configured claim code required)
- GET /api/expenses — list only the signed-in user's expenses (Bearer token required)
- POST /api/expenses — create an expense for the signed-in user
- PUT /api/expenses/:id — update an expense owned by the signed-in user
- DELETE /api/expenses/:id — delete an expense owned by the signed-in user
- GET /health — API/database health

## Important

Do not commit production secrets. The Docker Compose file currently contains development credentials for the local MongoDB container; replace them with secrets before a public production deployment.

## Authentication and existing expenses

The backend requires JWT_SECRET to be configured with at least 32 characters. Generate a random value locally and keep it in the backend environment; never commit it.

Registration and login use the email and password endpoints under /api/auth. Expense routes require a Bearer token and return only records owned by that account.

Existing expenses have no owner and stay hidden from user expense lists until explicitly claimed. To claim them, configure LEGACY_EXPENSES_OWNER_EMAIL and a strong LEGACY_EXPENSES_CLAIM_TOKEN in the backend environment, register the matching owner email, sign in, and use the “Bring over your original expenses” form. The backend assigns only unowned records to that authenticated account. After the claim succeeds, remove both migration settings from the backend environment. Never commit these values.
