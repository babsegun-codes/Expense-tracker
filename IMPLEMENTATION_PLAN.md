# Personal Finance Manager implementation plan

## Repository findings

- React/Vite frontend and Express/Mongoose backend; JWT authentication and per-user `Expense` records already exist.
- `Expense.amount` is a floating-point `Number`, and old shared records may lack `userId`. Existing claim-legacy flow must remain intact.
- Preserve the current interface and authentication. No deployment or infrastructure files are part of this implementation.

## Architecture and migration

- Add user-owned `FinancialAccount`, `FinancialTransaction`, `Budget`, and `RecurringTransaction` collections; all ownership is taken from the JWT.
- Store money as integer minor units (`amountMinor`) with currency on each account. Transfers are a single logical transaction with source and destination IDs, so both balances derive together without a multi-document MongoDB transaction.
- Existing expenses remain readable and editable through existing routes. A separate explicit, idempotent migration script can copy only already-owned expenses to a selected/default account; ownerless legacy expenses remain unassigned for the existing verified claim flow. Do not run migration automatically at startup.
- Mono Connect: server creates the linking URL, receives and validates account events, stores provider identifiers, fetches paginated transactions, and de-duplicates on provider/account/transaction identifiers. Sandbox and live status are explicit. Provider secrets remain server-only.
- Imports accept CSV (and JSON where practical), validate/review before commit, and deduplicate. Uploads use bounded in-memory parsing; no uploaded documents are retained.

## Provider selection

- Mono Connect is the technical integration choice based on current official docs for Nigerian account linking, `account_connected`/`account_updated` webhooks, status/retrieved-data fields, paginated transactions, unlinking, and sandbox. Its current pricing is documented; production use remains gated on verifying its applicable Nigerian registration/authorisation for this data-access use case.
- Bank coverage and transaction history vary per institution/account; read the provider-returned status, retrieved data, and page metadata.
- Okra documentation describes sandbox/production and pagination but recent reports say the service ceased operating in May 2025. CBN's current Payment Service Provider directory lists Okra Technologies but not Mono; that directory alone does not determine the required open-banking registration. Production launch requires written provider/regulatory confirmation. Mono dashboard account, KYB, live keys, funded wallet/pricing confirmation, callback URL and webhook secret are also required.

## Implementation stages

1. Add finance models, validation, ownership-protected APIs, logical transfers, dashboard summaries, budgets and recurring schedules.
2. Add Mono Connect link, callback/webhook verification, sync/pagination/idempotency, connection management and provider configuration docs.
3. Add statement/receipt import review workflow and existing-expense migration utility.
4. Extend the existing dashboard with accounts, transactions, transfers, budgets, sync and onboarding controls.
5. Add tests and run backend suite, frontend production build, and `git diff --check`.

## Verification boundaries

The repository contains no provider credentials. Sandbox calls can only be run if sandbox keys are made available in the local environment; no secrets will be added to source control.
