# Expense Tracker — DevOps Portfolio Project

A three-tier expense-tracking application built with React, Node.js/Express, and MongoDB. This project demonstrates containerisation, automated CI/CD, container image security scanning, and Kubernetes deployment on Amazon EKS.

**Live application:** https://expensetk.name.ng
**Repository:** https://github.com/babsegun-codes/Expense-tracker

## Project Overview

The Expense Tracker provides a web interface for recording, managing, searching, and analysing expenses. The application uses a React frontend, an Express REST API, and MongoDB for data persistence.

The project also implements a DevOps workflow that builds separate frontend and backend Docker images, scans the images with Trivy, publishes versioned images to Docker Hub, and deploys the application to Amazon EKS.

## Features

* Create, edit, and delete expenses
* Search by title, category, or description
* Filter by category and month
* Dashboard totals, monthly spending, transaction count, and average
* User registration and JWT-based authentication
* User-specific expense access
* MongoDB persistence
* REST API validation and health endpoints
* Responsive frontend interface

## Technology Stack

| Area                        | Technologies                  |
| --------------------------- | ----------------------------- |
| Frontend                    | React, Vite, Nginx            |
| Backend                     | Node.js, Express              |
| Database                    | MongoDB                       |
| Containerisation            | Docker, Docker Compose        |
| CI/CD                       | GitHub Actions                |
| Container registry          | Docker Hub                    |
| Security scanning           | Trivy                         |
| Orchestration               | Kubernetes                    |
| Cloud platform              | AWS                           |
| Managed Kubernetes          | Amazon EKS                    |
| Ingress and traffic routing | AWS Application Load Balancer |
| TLS certificate             | AWS Certificate Manager       |

## Architecture

### Application architecture

Browser → React frontend served by Nginx → Express REST API → MongoDB

### Deployment architecture

GitHub repository → GitHub Actions → Build and test → Docker image build → Trivy vulnerability scan → Docker Hub → Amazon EKS → Kubernetes Deployments and Services → AWS Application Load Balancer → Users

The application runs in the `expense-tracker` Kubernetes namespace. The frontend and backend use separate Deployments, and internal Kubernetes Services route traffic to the corresponding pods.

## CI/CD Pipeline

The GitHub Actions workflow is defined in `.github/workflows/ci-cd.yaml`.

The pipeline runs on pushes to `main` and pull requests targeting `main`.

### 1. Dependency installation and testing

The backend job installs dependencies with `npm ci` and executes `npm test`. The frontend job installs dependencies and creates a production build.

### 2. Docker image builds

The pipeline builds separate frontend and backend Docker images using Docker Buildx.

Each image receives a tag based on the first seven characters of the Git commit SHA, allowing image versions to be associated with source-code revisions.

### 3. Security scanning with Trivy

Trivy scans the frontend and backend images for operating-system and library vulnerabilities rated HIGH or CRITICAL.

The pipeline is configured to fail when matching vulnerabilities are detected. Unfixed vulnerabilities are excluded according to the workflow's configured policy.

During development, the frontend image failed security scanning because of vulnerable Alpine Linux packages. The production Dockerfile was updated to upgrade Alpine packages, and a subsequent local Trivy scan reported zero HIGH or CRITICAL vulnerabilities.

### 4. Image publishing

On pushes to `main`, the pipeline authenticates with Docker Hub and publishes the versioned frontend and backend images.

Pull requests build and scan the images without publishing them.

### 5. Deployment to Amazon EKS

After both image jobs succeed, the deployment job:

* Configures AWS credentials.
* Updates the local Kubernetes configuration for the `expense-tracker` EKS cluster in `us-east-1`.
* Updates the frontend and backend manifests with the new image tags.
* Applies the application Deployments, Services, Ingress, and backend Horizontal Pod Autoscaler.
* Waits for the backend and frontend rollouts to complete.

## Kubernetes Configuration

The application uses Kubernetes resources to manage its runtime environment.

### Frontend and backend

* Frontend Deployment: three desired replicas, serving HTTP on port 80.
* Backend Deployment: three desired replicas, serving the API on port 4500.
* Startup, liveness, and readiness probes check application startup and health.
* CPU and memory requests and limits are defined for both application Deployments.

### Networking and ingress

The frontend and backend use internal ClusterIP Services. An internet-facing AWS Application Load Balancer routes requests for `expensetk.name.ng`:

* `/` routes to the frontend Service.
* `/api` routes to the backend Service.

The Ingress is configured to use an AWS Certificate Manager certificate and redirect HTTP traffic to HTTPS.

### Autoscaling

The backend Horizontal Pod Autoscaler is configured with:

* Minimum replicas: 3
* Maximum replicas: 6
* Target average CPU utilisation: 70%

Scaling depends on the availability of Kubernetes metrics and the cluster's ability to schedule additional pods.

### Database and persistence

MongoDB runs as a single-replica StatefulSet using the `mongo:7` image. A volume claim template requests 1 GiB of persistent storage using the `gp2` StorageClass and `ReadWriteOnce` access mode.

Kubernetes Secrets supply database credentials and the backend connection string.

The current manifests do not establish a replicated MongoDB cluster or document an automated database backup and recovery strategy.

## Local Development with Docker Compose

From the repository root, start the local application:

```bash
docker compose up --build -d
```

Check the running services and backend logs:

```bash
docker compose ps
docker compose logs backend
```

Local application endpoints:

* Frontend: http://localhost:801
* Backend API: http://localhost:4600
* Backend health: http://localhost:4600/health

MongoDB is intended to remain accessible only inside the Docker network.

To stop the services:

```bash
docker compose down
```

## Local Development Without Docker Compose

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Configure the required environment variables locally before starting the backend.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

For local frontend development, Vite uses `http://localhost:4600/api` by default.

## API Endpoints

| Method | Endpoint                 | Purpose                                   |
| ------ | ------------------------ | ----------------------------------------- |
| POST   | `/api/auth/register`     | Register an account                       |
| POST   | `/api/auth/login`        | Authenticate and receive a JWT            |
| GET    | `/api/auth/me`           | Retrieve the authenticated user           |
| POST   | `/api/auth/claim-legacy` | Claim eligible unassigned legacy expenses |
| GET    | `/api/expenses`          | List the authenticated user's expenses    |
| POST   | `/api/expenses`          | Create an expense                         |
| PUT    | `/api/expenses/:id`      | Update an owned expense                   |
| DELETE | `/api/expenses/:id`      | Delete an owned expense                   |
| GET    | `/health`                | Check API and database health             |

Protected endpoints require a valid Bearer token. Expense records are restricted to the authenticated account.

## Security Considerations

* Trivy scans container images for HIGH and CRITICAL vulnerabilities.
* The pipeline uses GitHub Actions secrets for Docker Hub and AWS credentials.
* JWT authentication protects account-specific expense endpoints.
* Kubernetes Secrets supply MongoDB connection settings to the backend.
* Production credentials and application secrets must not be committed to source control.
* Database backups, secret rotation, and disaster recovery should be addressed before treating the deployment as production-hardened.

## Lessons Learned

This project provided practical experience with:

* Building and packaging a multi-tier web application.
* Creating Docker images for frontend and backend services.
* Automating dependency installation, testing, and builds with GitHub Actions.
* Investigating and resolving container image vulnerabilities.
* Versioning images with Git commit identifiers.
* Deploying Kubernetes resources to Amazon EKS.
* Configuring Services, Ingress routing, health probes, and autoscaling.
* Verifying CI/CD results and checking the deployed application.

## Future Improvements

* Implement and test automated database backups and recovery.
* Improve secrets management and rotation.
* Add application and infrastructure monitoring.
* Add resource dashboards and alerting.
* Review deployment rollback procedures.
* Strengthen automated tests and deployment verification.
