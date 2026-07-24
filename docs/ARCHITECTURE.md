# Mafundi Mtaani platform architecture

## Product model

Mafundi is a two-sided, Nairobi-first service marketplace. The experience combines:

- Airbnb-style trust, discovery, profiles, reviews, transparent selection, and progressive request capture.
- Uber-style supply availability, distance-aware matching, job dispatch, live status, ETA, and an artisan earnings console.
- Apple-style focus, restrained motion, plain-language setup, privacy by design, accessibility, and consistent component behavior.
- ERPNext-inspired document lifecycles, role permissions, approval workflows, immutable activity ledgers, billing, and operational reporting.

These are interaction and architecture patterns. No third-party brand assets or proprietary UI are copied. ERPNext is GPL software; this codebase uses its domain ideas but does not import GPL source, keeping licensing boundaries explicit.

## Target topology

```text
Next.js web/PWA
  -> API gateway / BFF
    -> FastAPI marketplace service
      -> PostgreSQL + PostGIS
      -> Redis (availability, rate limits, queues)
      -> Object storage (portfolio and job images)
      -> Event bus / workers
         -> matching and dispatch
         -> notifications (SMS, WhatsApp, email, push)
         -> payments and ledger
         -> trust and safety
```

The repository starts as a modular monolith. Domain packages become independent services only when load, ownership, or isolation justifies it.

## Bounded domains

- Identity and access: client, artisan, estate manager, support, finance, admin; OIDC, MFA, device sessions, RBAC and audit.
- Artisan supply: profile, skills, documents, verification, service radius, availability, portfolio, pricing.
- Jobs: draft, open, matched, assigned, in progress, completed, disputed, cancelled.
- Dispatch: eligibility filters, score calculation, offer fan-out, expiry, acceptance and reassignment.
- Commerce: quote, escrow authorization, payment capture, refund, artisan payout, platform fee, tax document.
- Trust: review eligibility, moderation, incident reporting, guarantees and disputes.
- Operations: subscriptions, lead credits, support cases, configuration and reporting.

## Enterprise controls

- PostgreSQL row-level tenancy for enterprise/estate accounts and encrypted sensitive fields.
- Append-only `job_events` and payment ledger; idempotency keys on all write integrations.
- Transactional outbox for reliable event publishing.
- OpenTelemetry traces, structured logs, SLO dashboards and error budgets.
- Kenya Data Protection Act aligned retention, consent, deletion and subject-access workflows.
- CI gates: formatting, static typing, unit/contract/integration tests, dependency and container scans, migrations, preview deploys.
- Progressive delivery with feature flags, canaries, automated rollback, daily backups and restore drills.

## Delivery sequence

1. Foundation: identity, profiles, job requests, matching, quotes, state timeline, notifications.
2. Trusted transaction: M-Pesa authorization/capture, payouts, receipts, disputes, reviews.
3. Live operations: geospatial dispatch, availability heartbeat, ETA, in-app chat and push.
4. Enterprise: estate work orders, approvals, SLAs, planned maintenance, inventory and ERPNext connector.

For ERP integration, keep ERPNext as a separate GPL application behind a versioned adapter. Sync approved suppliers, sales invoices, purchase invoices, payments and maintenance work orders via its REST API and webhooks.
