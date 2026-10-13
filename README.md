# Expense Tracker — DevOps Portfolio Project

A three-tier expense-tracking application built with React, Node.js/Express, and MongoDB. The project demonstrates Infrastructure as Code (IaC), containerisation, automated CI/CD, container image security scanning, Kubernetes orchestration on Amazon EKS, and application monitoring with Prometheus and Grafana.

**Live application:** https://expensetk.name.ng

**Repository:** https://github.com/babsegun-codes/Expense-tracker

## Project Overview

The Expense Tracker provides a web interface for recording, managing, searching, and analysing expenses. The application uses a React frontend, an Express REST API, and MongoDB for data persistence. User registration and JWT-based authentication support account-specific expense management.

The DevOps workflow builds separate frontend and backend Docker images, runs automated tests and security scans, publishes versioned images to Docker Hub, and deploys the application to Amazon EKS through GitHub Actions.

Terraform manages core AWS infrastructure, while Kubernetes manifests define application workloads and networking. Helm manages the Prometheus and Grafana monitoring components. Pino generates structured backend logs, and Prometheus collects application metrics for visualisation in Grafana.

## Features

* Create, edit, and delete expenses.
* Search by title, category, or description.
* Filter by category and month.
* Display dashboard totals, monthly spending, transaction count, and average spending.
* Register accounts and authenticate using JWTs.
* Restrict expense access to the authenticated account.
* Persist application data in MongoDB.
* Validate REST API requests and expose health endpoints.
* Provide a responsive frontend interface.
* Collect HTTP request counts and duration metrics.
* Visualise backend traffic, latency, and HTTP 5xx error rates in Grafana.

## Technology Stack

| Area                           | Technologies                              |
| ------------------------------ | ----------------------------------------- |
| Frontend                       | React, Vite, Nginx                        |
| Backend                        | Node.js, Express, Pino                    |
| Database                       | MongoDB                                   |
| Containerisation               | Docker, Docker Compose                    |
| Infrastructure as Code         | Terraform, Kubernetes manifests, Helm     |
| CI/CD                          | GitHub Actions                            |
| Container registry             | Docker Hub                                |
| Security scanning              | Trivy                                     |
| Orchestration                  | Kubernetes                                |
| Cloud platform                 | AWS                                       |
| Managed Kubernetes             | Amazon EKS                                |
| Networking and ingress         | Amazon VPC, AWS Application Load Balancer |
| TLS certificate                | AWS Certificate Manager                   |
| Application metrics            | Prometheus                                |
| Monitoring dashboards          | Grafana                                   |
| Package and release management | Helm                                      |

## Architecture

### Application architecture

Browser → React frontend served by Nginx → Express REST API → MongoDB

### Deployment architecture

GitHub repository → GitHub Actions → Dependency installation and tests → Docker image builds → Trivy vulnerability scans → Docker Hub → Amazon EKS → Kubernetes Deployments and Services → AWS Application Load Balancer → Users

Terraform manages core AWS infrastructure, including networking and EKS-related resources. Kubernetes manifests define the application Deployments, Services, Ingress and autoscaling configuration. Helm deploys Prometheus and Grafana into the `monitoring` namespace.

### Monitoring architecture

Express backend → `/metrics` endpoint → Prometheus scraping → Grafana data source → Expense Tracker Monitoring dashboard

Pino generates structured JSON logs from the backend. Prometheus collects application and Node.js runtime metrics, while Grafana queries Prometheus to visualise selected performance indicators.

The application runs in the `expense-tracker` Kubernetes namespace. Monitoring components run separately in the `monitoring` namespace.

## Infrastructure as Code

The project uses Terraform, Kubernetes manifests and Helm to manage infrastructure and application configuration.

### Terraform

Terraform provisions core AWS infrastructure for the EKS deployment, including VPC networking, subnets, routing, IAM roles and EKS-related resources.

Infrastructure configuration is maintained in version-controlled Terraform files. The project uses an S3 backend for Terraform state.

### Kubernetes manifests

Kubernetes manifests define application Deployments, Services, Ingress, the backend Horizontal Pod Autoscaler, database resources and related runtime settings.

### Helm

Helm manages the Prometheus and Grafana releases in the `monitoring` namespace. Custom values configure the backend scrape target and persistent storage for both monitoring services.

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
* Applies the application Deployments, Services, Ingress and backend Horizontal Pod Autoscaler.
* Waits for the backend and frontend rollouts to complete.

## Kubernetes Configuration

The application uses Kubernetes resources to manage its runtime environment.

### Frontend and backend

* Frontend Deployment: three desired replicas, serving HTTP on port 80.
* Backend Deployment: three desired replicas, serving the API on port 4500.
* Startup, liveness and readiness probes check application startup and health.
* CPU and memory requests and limits are defined for both application Deployments.
* Kubernetes Services route internal traffic to the corresponding pods.

### Networking and ingress

The frontend and backend use internal ClusterIP Services. An internet-facing AWS Application Load Balancer routes requests for `expensetk.name.ng`:

* `/` routes to the frontend Service.
* `/api` routes to the backend Service.

The Ingress is configured to use an AWS Certificate Manager certificate and redirect HTTP traffic to HTTPS.

### Autoscaling

The backend Horizontal Pod Autoscaler is configured with:

* Minimum replicas: 3.
* Maximum replicas: 6.
* Target average CPU utilisation: 70%.

Scaling depends on the availability of Kubernetes metrics and the cluster's ability to schedule additional pods.

### Database and persistence

MongoDB runs as a single-replica StatefulSet using the `mongo:7` image. A volume claim template requests 1 GiB of persistent storage using the `gp2` StorageClass and `ReadWriteOnce` access mode.

Kubernetes Secrets supply database credentials and the backend connection string.

The current manifests do not establish a replicated MongoDB cluster or document a tested automated database backup and recovery strategy.

## Observability and Monitoring

The project uses Pino, Prometheus and Grafana to monitor backend application behaviour.

### Structured logging with Pino

The backend uses Pino to generate structured JSON logs. The logger records application events, startup messages and errors. Configured redaction rules help prevent sensitive values, including passwords, authentication headers, cookies and tokens, from appearing in logs.

The application writes logs to standard output, allowing Kubernetes to capture container logs.

Centralised log aggregation and long-term log searching have not yet been configured.

### Prometheus metrics

The backend exposes application metrics through the `/metrics` endpoint. Prometheus scrapes the internal backend Service every 15 seconds.

The exported metrics include:

* `http_requests_total`: cumulative HTTP request counts grouped by method, route and status code.
* `http_request_duration_seconds`: request-duration histogram, including count, sum and bucket metrics.
* Node.js runtime and process metrics collected by the Prometheus client library.

The application also exposes `/health` for basic health checks and `/ready` for readiness checks that account for MongoDB connectivity.

The `/metrics` endpoint is intended for internal monitoring rather than public access.

### Grafana dashboards

Grafana uses Prometheus as its data source. The `Expense Tracker Monitoring` dashboard contains four panels.

| Panel               | Purpose                                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| Total HTTP requests | Displays the cumulative number of recorded requests.                       |
| Request rate        | Shows HTTP requests per second over a rolling five-minute window.          |
| Average latency     | Estimates average HTTP request duration over a rolling five-minute window. |
| HTTP 5xx error rate | Shows the rate of server-side HTTP errors.                                 |

The dashboard provides an overview of backend traffic, response performance and HTTP server errors. The metrics support troubleshooting but do not, by themselves, establish application availability or user activity.

### Monitoring storage

Prometheus uses an 8 GiB persistent volume, while Grafana uses a 5 GiB persistent volume. Both use the `gp2` StorageClass.

Persistent volumes retain stored data across ordinary pod replacement, subject to the storage and recovery configuration. Persistent storage does not replace backups.

### Current monitoring limitations

Automated alert rules and notification delivery have not yet been configured. Kubernetes resource dashboards for CPU, memory and pod restarts also remain potential improvements. Centralised log aggregation is not implemented.

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

| Method | Endpoint                 | Purpose                                                      |
| ------ | ------------------------ | ------------------------------------------------------------ |
| POST   | `/api/auth/register`     | Register an account                                          |
| POST   | `/api/auth/login`        | Authenticate and receive a JWT                               |
| GET    | `/api/auth/me`           | Retrieve the authenticated user                              |
| POST   | `/api/auth/claim-legacy` | Claim eligible unassigned legacy expenses                    |
| GET    | `/api/expenses`          | List the authenticated user's expenses                       |
| POST   | `/api/expenses`          | Create an expense                                            |
| PUT    | `/api/expenses/:id`      | Update an owned expense                                      |
| DELETE | `/api/expenses/:id`      | Delete an owned expense                                      |
| GET    | `/health`                | Check basic API health                                       |
| GET    | `/ready`                 | Check application readiness, including database connectivity |
| GET    | `/metrics`               | Expose Prometheus metrics                                    |

Protected endpoints require a valid Bearer token. Expense records are restricted to the authenticated account.

## Security Considerations

* Trivy scans container images for HIGH and CRITICAL vulnerabilities according to the workflow policy.
* The pipeline uses GitHub Actions secrets for Docker Hub and AWS credentials.
* JWT authentication protects account-specific expense endpoints.
* Kubernetes Secrets supply MongoDB connection settings to the backend.
* Pino redacts configured sensitive fields from structured logs.
* The Prometheus and Grafana interfaces are accessed through internal Kubernetes Services and local port-forwarding rather than public ingress.
* Production credentials and application secrets must not be committed to source control.
* Database backups, secret rotation, disaster recovery and deployment rollback procedures require further attention before treating the deployment as production-hardened.

## Lessons Learned

This project provided practical experience with:

* Building and packaging a multi-tier web application.
* Creating Docker images for frontend and backend services.
* Automating dependency installation, testing, image builds and deployments with GitHub Actions.
* Investigating and resolving container image vulnerabilities.
* Versioning images with Git commit identifiers.
* Managing AWS infrastructure with Terraform.
* Deploying Kubernetes resources to Amazon EKS.
* Configuring Services, Ingress routing, health probes, resource requests and autoscaling.
* Collecting application metrics with Prometheus.
* Building Grafana dashboards for request traffic, latency and HTTP errors.
* Implementing structured logging with Pino.
* Troubleshooting Helm releases, Kubernetes pods and persistent volume claims.

## Future Improvements

* Implement and test automated database backups and recovery.
* Improve secrets management and consider GitHub Actions OIDC for AWS authentication.
* Configure alert rules and notification delivery for backend errors and service availability.
* Add Kubernetes resource dashboards for CPU, memory, pod restarts and capacity.
* Introduce centralised log aggregation and search.
* Review deployment rollback procedures and post-deployment smoke tests.
* Improve database resilience and verify replica distribution across availability zones.
* Strengthen automated integration tests and infrastructure validation.
* Review Helm chart maintenance and update deprecated chart dependencies.
