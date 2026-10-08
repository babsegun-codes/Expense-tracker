# Expense Tracker — Project Context

## 1. Project Overview

This repository contains the user's Expense Tracker application.

Current stack:

* Frontend: React/Vite
* Backend: Node.js + Express
* Database: MongoDB
* Repository: `babsegun-codes/Expense-tracker`

The original application was built as a simple expense-tracking MVP. The application has since been containerised and deployed successfully.

The next development phase focuses on improving the application itself.

---

## 2. Current Application

The current application supports basic expense management:

* Add expenses
* View expenses
* Edit expenses
* Delete expenses
* Calculate spending totals/statistics
* Persist expense data in MongoDB

The backend exposes expense functionality under:

`/api/expenses`

The backend uses port `4500`.

The frontend is a React application.

---

## 3. Current Production Architecture — Background Only

The application has already been successfully deployed and tested using:

* Docker
* Kubernetes
* AWS EKS
* Terraform
* AWS VPC
* AWS Load Balancer Controller
* AWS Application Load Balancer
* Route 53
* AWS ACM HTTPS
* Docker Hub
* GitHub Actions CI/CD

Production request flow:

```text
Route 53
    ↓
AWS Application Load Balancer
    ↓
Kubernetes Ingress
    ↓
Frontend / Backend Services
    ↓
Frontend / Backend Pods
    ↓
MongoDB Service
    ↓
MongoDB StatefulSet
    ↓
Persistent EBS Storage
```

The application currently uses:

`https://expensetk.name.ng`

GitHub Actions CI/CD has been tested successfully:

```text
Code push
    ↓
GitHub Actions
    ↓
Build Docker images
    ↓
Push images to Docker Hub
    ↓
Connect to EKS
    ↓
Update Kubernetes deployments
    ↓
Rolling deployment
```

---

## 4. Important DevOps Scope

Do NOT work on DevOps as part of the application-development task.

Do not modify:

* AWS
* EKS
* Kubernetes
* Terraform
* Docker deployment configuration
* GitHub Actions
* CI/CD
* Route 53
* ACM
* AWS Load Balancer Controller

The existing DevOps setup is working and should remain unchanged.

The immediate goal is application development only.

---

# 5. New Product Direction

The application should evolve from a basic Expense Tracker into a:

**Multi-user personal finance management application.**

The long-term product should support:

* Multiple users
* User registration and login
* Secure authentication
* User-specific financial data
* Expenses
* Income
* Categories
* Budgets
* Financial summaries
* Multiple financial accounts per user
* Connected bank accounts
* Automatically imported bank transactions
* Manual transactions
* Automatic transaction categorisation
* Recurring transactions
* Financial insights

The application should not remain limited to manually entering expenses.

---

# 6. V2 Immediate Goal

The first V2 milestone is a proper multi-user application.

## Authentication

Implement:

* User registration
* User login
* Logout
* Password hashing with bcrypt
* JWT-based authentication
* Authentication middleware
* Protected API routes
* Appropriate authentication error handling

## User Ownership

Every expense must belong to a specific authenticated user.

A user must:

* See only their own expenses
* Create expenses only for themselves
* Update only their own expenses
* Delete only their own expenses

A user must never be able to access another user's expenses by changing an expense ID or manipulating an API request.

Ownership must be enforced by the backend.

Do not rely on frontend restrictions for security.

---

# 7. Frontend Requirements

Add:

* Registration page
* Login page
* Authenticated dashboard
* Logout functionality
* Authentication state handling
* Appropriate redirects for unauthenticated users
* User-friendly validation
* User-friendly authentication errors

Preserve the existing expense functionality while making expenses user-specific.

---

# 8. Future Financial Model

The V2 architecture should be designed so that future bank integration does not require a major database redesign.

The eventual model should be capable of representing concepts such as:

* User
* Financial account
* Transaction
* Category
* Budget
* Recurring transaction
* Bank connection/provider account

A transaction should eventually be capable of representing:

* User
* Financial account
* Transaction type
* Amount
* Category
* Description
* Merchant
* Date
* Source
* External transaction identifier
* Recurring/import metadata

Possible transaction sources include:

```text
manual
bank_import
```

Do not implement bank integration yet unless explicitly requested.

Design the application so that bank integration can be added later.

---

# 9. Existing Data

The original application was single-user/shared-data.

Existing expense records may therefore not have a user association.

Do not silently assign existing expenses to an arbitrary user.

Before implementing migration behaviour:

1. Inspect the current database/model structure.
2. Determine how existing records are represented.
3. Propose a safe migration strategy.
4. Avoid destroying existing financial data.

---

# 10. Development Principles

Before changing code:

1. Inspect the existing project.
2. Understand the current backend routes.
3. Understand the current database/model structure.
4. Understand the current frontend structure.
5. Understand how expenses currently flow from frontend to backend to MongoDB.
6. Reuse the existing architecture where sensible.
7. Avoid unnecessary rewrites.
8. Avoid unnecessary dependencies.
9. Keep the implementation maintainable.
10. Keep the code understandable for a beginner learning software development and DevOps.

Do not assume files or architecture that have not been inspected.

---

# 11. Security Requirements

The application must:

* Never store plaintext passwords.
* Never expose passwords through API responses.
* Never hard-code authentication secrets.
* Never commit `.env` files or credentials.
* Protect authenticated routes.
* Enforce ownership checks on the server.
* Never trust a user-provided `userId` for ownership.
* Determine ownership from the authenticated JWT identity.
* Validate incoming data.
* Return appropriate HTTP status codes.
* Avoid exposing sensitive database or authentication information in errors.

---

# 12. Testing Requirements

Before considering V2 complete:

* Run existing tests if present.
* Add appropriate tests for authentication.
* Test registration.
* Test duplicate registration.
* Test login.
* Test invalid credentials.
* Test protected routes.
* Test JWT authentication.
* Test expense ownership.
* Test that User A cannot access User B's expenses.
* Test that User A cannot modify User B's expenses.
* Test that User A cannot delete User B's expenses.
* Test expense CRUD for authenticated users.
* Run frontend build/checks.
* Run backend checks.

Fix implementation errors before declaring the application complete.

---

# 13. Working Style

Do not stop after adding a login page.

The objective is a functioning multi-user application with proper backend authorization and user-owned financial data.

Do not make broad infrastructure changes.

When implementing a feature:

1. Inspect the existing code.
2. Understand the current implementation.
3. Determine the minimum necessary changes.
4. Implement the feature.
5. Test the feature.
6. Fix errors.
7. Verify that existing functionality still works.

After implementation, report:

* What changed
* Files created
* Files modified
* Tests/checks performed
* Database migration considerations
* Remaining manual steps

---

# 14. Long-Term Product Vision

The final direction is a personal finance manager combining:

```text
Manual Transactions
        +
Connected Financial Accounts
        +
Automatic Transaction Imports
        +
Automatic Categorisation
        +
Budgets
        +
Financial Dashboards
        +
Spending Insights
```

The bank-account integration should be implemented only after the multi-user financial foundation is stable.

The application should eventually make financial tracking more automatic rather than requiring users to manually enter every expense.
