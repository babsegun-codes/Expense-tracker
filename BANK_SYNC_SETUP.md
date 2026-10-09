# Bank synchronisation setup

## Provider review (9 October 2026)

| Provider | Nigeria and linking | Data and sync | Pricing and launch |
|---|---|---|---|
| **Mono Connect (implemented)** | Current Connect docs describe a hosted authorisation link. Mono's coverage page is dynamic; it currently reports 338 Nigeria connections and includes examples such as Access Bank and ALAT by WEMA. Check the institution/auth-method list at runtime; don't promise every bank. | `account_connected` and `account_updated` webhooks report account ID and data status. Transactions are paginated. Status can be AVAILABLE, PARTIAL, UNAVAILABLE or FAILED. Refresh and history depend on the connection and plan. | Sandbox requests are free. Public PAYG pricing last updated Feb. 20, 2026: successful authorization ₦80, account details ₦100, transaction page with returned data ₦150, data sync ₦100; wallet funded. Subscription plans start at ₦50,000/month (account caps apply). Verify current dashboard plan before launch. |
| **Okra (not selected)** | Its docs describe Nigerian linking, sandbox and production environments, but a current service/coverage check is required. | Its docs describe account and transaction APIs with pagination. | Its going-live guide describes free sandbox. However, recent reporting says Okra ceased operations in May 2025; its still-published API docs are not proof of availability. Do not build on it without direct confirmation it has resumed. |

Mono is selected for the code integration because it has current Connect APIs and an active documentation/coverage surface, while Okra's live status is doubtful. This is a technical selection, not a legal determination that Mono has the required Nigerian authorisation for this app. CBN's operational guidelines provide for an Open Banking Registry; the public CBN Payment Service Provider directory lists Okra Technologies but not Mono. Those directories do not by themselves settle which registration applies to Mono's account-information service. Before live use, obtain written confirmation from Mono of its applicable Nigerian registration/authorisation and the app's permitted use, and verify it against the applicable CBN registry. Production launch remains gated on that check. Do not treat a provider's own onboarding/KYB approval as a substitute for this check.

## References

- [Mono Connect link integration](https://docs.mono.co/docs/financial-data/connect-link)
- [Mono transaction API and pagination](https://docs.mono.co/api/bank-data/transactions)
- [Mono account details and data availability](https://docs.mono.co/api/bank-data/accounts/details)
- [Mono financial-data webhook events and verification](https://docs.mono.co/docs/financial-data/webhook-introduction)
- [Mono unlink API](https://docs.mono.co/api/bank-data/accounts/unlink)
- [Mono quickstart and KYB requirements](https://docs.mono.co/docs/quickstart)
- [Mono current Nigeria coverage](https://docs.mono.co/docs/coverage)
- [Mono PAYG pricing, updated February 2026](https://support.mono.co/en/articles/11938612-pay-as-you-go-payg-pricing)
- [Mono Nigeria subscription pricing](https://support.mono.co/en/articles/11071042-updated-mono-new-product-pricing-nigeria)
- [Okra go-live, sandbox and production guidance](https://docs.okra.ng/get-started/going-live)
- [Okra wind-down reported from co-founder statement](https://nairametrics.com/2025/07/03/nigerian-fintech-okra-shuts-down-as-co-founder-fara-ashiru-moves-to-uks-kernel/)
- [CBN Payment Service Provider directory](https://www.cbn.gov.ng/PaymentsSystem/PSPs.html)
- [CBN Operational Guidelines for Open Banking in Nigeria](https://www.cbn.gov.ng/Out/2023/CCD/Operational%20Guidelines%20for%20Open%20Banking%20in%20Nigeria.pdf)

## Local sandbox configuration

Set these only in the backend runtime environment (never in Vite variables or frontend source). Mono sandbox keys must start `test_sk_`; live keys must start `live_sk_`. The app checks the key prefix and an optional `MONO_ENVIRONMENT` declaration so a test key cannot be labelled as live:

```text
MONO_SECRET_KEY=<Mono sandbox secret key>
MONO_WEBHOOK_SECRET=<secret shown when configuring the Mono webhook>
MONO_ENVIRONMENT=sandbox
MONO_REDIRECT_URL=http://localhost:5173/
```

Configure Mono's webhook destination to `https://<public-backend-host>/api/bank/webhook` (or a temporary HTTPS tunnel for local development). Subscribe to account-connected, account-updated and account-unlinked events. The web app opens the Mono-hosted link; Mono returns to the configured redirect with its authorisation code and the generated `ref`. The browser sends that code to the authenticated backend, which exchanges it server-side. Bank credentials and OTPs are never collected by this app.

The connection environment label defaults to `sandbox`; set `MONO_ENVIRONMENT=production` only when the live key is configured. The hosted page itself is operated by Mono. The app does not execute money movement.

## Production activation checklist

1. Create a Mono Connect app and complete Mono's KYB/business onboarding.
2. Confirm the intended Nigerian institutions and auth methods in Mono's institution list and test history availability in each relevant bank.
3. Confirm current live pricing, data refresh limits, allowed use, history depth and retention obligations with Mono.
4. Obtain confirmation of Mono's applicable Nigerian authorization/registration and permitted use for this app. Configure the public HTTPS redirect URL and webhook URL in the Mono dashboard; copy the webhook secret.
5. Add the live `MONO_SECRET_KEY`, `MONO_WEBHOOK_SECRET`, `MONO_ENVIRONMENT=production`, and `MONO_REDIRECT_URL` to the backend secret manager/runtime environment. Do not commit them or alter existing production secrets as part of this code change.
6. Test account linking, consent revocation, transaction sync, pagination, provider retry behavior and account unlinking with an approved live test account before offering production access.
7. Review CBN open-banking participant duties, applicable NDPA/data-protection requirements, consent records, retention/deletion rules, and Mono's contractual/regulatory requirements with qualified compliance counsel/provider contacts before launch.

## Data migration

Existing `Expense` records and API remain available. New expenses are mirrored into the ledger as integer kobo transactions. Run the safe owned-record copy as a dry run first:

```sh
cd backend
npm run migrate:expenses
npm run migrate:expenses -- --apply
```

The script copies only expenses with a `userId`, leaves unassigned records untouched, creates a Personal account when needed, and is idempotent. Ensure a database backup exists before applying. No database was available in this coding environment, so no production or local data migration was run.

## Operational boundaries

- The provider account identifier and customer identifier are stored as fields excluded from normal Mongoose selection; provider keys remain environment-only.
- Mono webhook requests are checked against `mono-webhook-secret` using a timing-safe comparison. Provider transaction IDs and idempotency keys have unique indexes.
- Transaction history returned by Mono is preserved with its source and provider reference. Suspected transfers remain ordinary imported activity with a review hint; they are not automatically counted as a matched internal transfer.
- CSV statement import is supported with a review and duplicate check. Excel, PDF statements, receipt image/PDF storage, and OCR are not supported by this initial implementation.
- Recurring schedules are stored and shown but are not automatically posted by a background scheduler; reminders/posting need an always-on job runner and explicit product policy.
