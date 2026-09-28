# Madhura CRM ↔ Client Portal: Two-Way Integration Plan

**Goal:** Madhura CRM (`madhuracrm.com`) and the Client Portal (`clientportal.madhuracrm.com`, this repo) run as **separate services** that share data both ways over APIs and webhooks.

- If a client raises a question (ticket) in the **portal**, it shows up in the **CRM**.
- If the CRM opens a **project**, creates an **invoice**, or adds a **client**, it shows up in the **portal**.
- Status changes on either side sync to the other side.
- One setup serves many tenants (companies), so it works for any company that uses Madhura CRM.

---

## 1. Domains and services

```
                        ┌──────────────────────────────┐
                        │   auth.madhuracrm.com (SSO)  │  ← one login for both apps
                        └──────────────┬───────────────┘
                                       │ OIDC / JWT
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                                                             ▼
┌───────────────────────┐   REST API (pull/push)   ┌─────────────────────────────────┐
│  madhuracrm.com       │ ◄──────────────────────► │  clientportal.madhuracrm.com    │
│  api.madhuracrm.com   │   Webhooks (events)      │  clientportal.madhuracrm.com/api│
│  CRM microservice     │ ◄──────────────────────► │  Portal microservice            │
│  (staff side)         │                          │  (client side)                  │
└──────────┬────────────┘                          └──────────────┬──────────────────┘
           ▼                                                      ▼
       CRM DB                                               Portal DB
```

| Host | Purpose |
|---|---|
| `madhuracrm.com` | CRM UI for staff: sales, clients, projects, billing |
| `api.madhuracrm.com/v1` | Public CRM API. The portal calls it. |
| `clientportal.madhuracrm.com` | Client-facing portal (this app) |
| `clientportal.madhuracrm.com/api/v1` | Portal API. The CRM calls it. |
| `auth.madhuracrm.com` | Shared SSO (OIDC). Session cookie on `.madhuracrm.com` |
| `{tenant}.clientportal.madhuracrm.com` *(optional)* | Branded portal for each tenant |
| `portal.clientcompany.com` *(optional)* | Custom domain: a CNAME that points to `clientportal.madhuracrm.com` |

**Tenant resolution (the multi-tenant part):** the portal finds the tenant in this order: subdomain → custom-domain lookup → `tenant_id` claim in the JWT. Every API call and database row carries `tenant_id`.

---

## 2. Source of truth: which system owns what

Only one system owns each entity. The other system keeps a synced copy and sends change requests to the owner. This rule prevents sync loops and conflicting edits.

| Entity | Owner | Portal can | CRM can |
|---|---|---|---|
| Client (company) | **CRM** | read, request edit | full CRUD |
| Client users / contacts | **CRM** | read; client admin can invite | full CRUD |
| Project | **CRM** | read, comment, approve | full CRUD |
| Invoice / billing | **CRM** | read, download PDF, pay | full CRUD |
| Payment | **Payment gateway → CRM** | start payment | record/reconcile |
| Ticket / question | **Portal** | full CRUD | read, reply, assign, change status |
| Ticket messages | **Portal** | create | create (via API) |
| Documents | shared, by uploader | upload/download | upload/download |
| Announcements | **CRM** (or portal admin) | read | CRUD, target by client |
| Approvals | **Portal** | approve/reject | create request, read result |
| SLA policies | **Portal** | CRUD | read |

---

## 3. What to get from the CRM, with its data model

The portal already has these types in `src/lib/portal-data.tsx`. Each synced type gets `externalId` (the CRM id), `source`, and `syncedAt` fields.

### 3.1 Client (`GET /v1/clients`, `GET /v1/clients/:id`)
```json
{
  "id": "crm_cli_812",
  "tenant_id": "tn_madhura",
  "name": "Acme Corp",
  "code": "ACME",
  "tier": "ENTERPRISE",           // STANDARD | ENTERPRISE | VIP  -> Client.tier
  "primary_contact": { "name": "Ravi", "email": "ravi@acme.com", "phone": "+91..." },
  "billing_email": "accounts@acme.com",
  "website": "https://acme.com",
  "address": "...",
  "account_manager_id": "crm_usr_12",   // -> supportAgentIds
  "active": true,
  "updated_at": "2026-09-25T10:00:00Z"
}
```

### 3.2 Contacts / portal users (`GET /v1/clients/:id/contacts`)
```json
{ "id": "crm_con_55", "client_id": "crm_cli_812", "name": "Ravi", "email": "ravi@acme.com",
  "portal_access": true, "portal_role": "CLIENT_ADMIN" }   // CLIENT_ADMIN | CLIENT_USER
```
A portal login is created only for contacts with `portal_access = true`.

### 3.3 Project (`GET /v1/projects?client_id=`)
```json
{ "id": "crm_prj_301", "client_id": "crm_cli_812", "name": "Website Revamp", "code": "WEB-01",
  "status": "ACTIVE",              // PLANNING | ACTIVE | ON_HOLD | COMPLETED | ARCHIVED
  "progress": 45, "start_date": "...", "target_date": "...",
  "lead_user_id": "crm_usr_12", "description": "...",
  "milestones": [{ "name": "Design", "due": "...", "done": true }],
  "visible_to_client": true,        // CRM decides what the portal can show
  "updated_at": "..." }
```

### 3.4 Invoice (`GET /v1/invoices?client_id=`, `GET /v1/invoices/:id/pdf`)
```json
{ "id": "crm_inv_990", "number": "INV-2026-0142", "client_id": "crm_cli_812", "project_id": "crm_prj_301",
  "currency": "INR", "amount": 125000, "tax": 22500, "total": 147500, "balance_due": 147500,
  "status": "SENT",                // DRAFT | SENT | PAID | OVERDUE | CANCELLED  (portal hides DRAFT)
  "issue_date": "...", "due_date": "...", "paid_date": null,
  "items": [{ "description": "Design sprint", "quantity": 1, "rate": 125000, "amount": 125000 }],
  "payment_link": "https://pay.madhuracrm.com/inv_990", "pdf_url": "signed-url" }
```

### 3.5 Staff users (`GET /v1/users?role=support`)
These let the portal show the account manager and the assigned agent: `id, name, email, role, job_title, avatar`.

### 3.6 Announcements (`GET /v1/announcements?client_id=`)
Maps directly to the `Announcement` type (`targetClientIds` ← `target_client_ids`).

---

## 4. What the CRM gets from the portal

### 4.1 Ticket (`GET /api/v1/tickets`, pushed to the CRM by webhook)
```json
{ "id": "tkt_7781", "code": "TCK-1042", "tenant_id": "tn_madhura",
  "client_id": "crm_cli_812", "project_id": "crm_prj_301",
  "title": "Invoice amount wrong", "description": "...", "category": "BILLING",
  "priority": "HIGH", "status": "OPEN",
  "creator": { "contact_id": "crm_con_55", "email": "ravi@acme.com" },
  "assignee_id": "crm_usr_12",
  "related": { "invoice_id": "crm_inv_990" },     // a ticket can link to an invoice or project
  "due_at": "...", "breached": false, "created_at": "...", "updated_at": "..." }
```

### 4.2 Portal endpoints the CRM calls
| Method | Path | Use |
|---|---|---|
| GET | `/api/v1/tickets?client_id=&status=&updated_since=` | List tickets inside the CRM client page |
| GET | `/api/v1/tickets/:id` | Ticket with messages and activity |
| POST | `/api/v1/tickets/:id/messages` | Staff reply from the CRM (`internal: true/false`) |
| PATCH | `/api/v1/tickets/:id` | Change status, priority, or assignee |
| POST | `/api/v1/tickets` | CRM creates a ticket for a client (for example, from a phone call) |
| POST | `/api/v1/approvals` | CRM asks the client to approve something (quote, milestone) |
| GET | `/api/v1/approvals/:id` | Read the approval result |
| POST | `/api/v1/documents` | Push a file (contract, report) to the client |
| POST | `/api/v1/sync/:entity` | Force a resync of one entity (client, project, invoice) |

### 4.3 CRM endpoints the portal calls
| Method | Path | Use |
|---|---|---|
| GET | `/v1/clients`, `/v1/clients/:id` | Client profile |
| GET | `/v1/clients/:id/contacts` | Portal users |
| GET | `/v1/projects?client_id=` | Projects list and detail |
| GET | `/v1/invoices?client_id=` | Billing page |
| GET | `/v1/invoices/:id/pdf` | Invoice download (signed URL) |
| POST | `/v1/invoices/:id/payment-intent` | Start a payment (Razorpay / Stripe) |
| POST | `/v1/clients/:id/change-requests` | Client asks to edit profile or billing details |
| POST | `/v1/leads` | "Request new service" form in the portal becomes a CRM lead |

---

## 5. Two-way flow: webhook events

Each side registers a webhook URL with the other:
- CRM → `https://clientportal.madhuracrm.com/api/v1/webhooks/crm`
- Portal → `https://api.madhuracrm.com/v1/webhooks/portal`

### 5.1 Events from CRM to portal
| Event | What the portal does |
|---|---|
| `client.created` / `client.updated` / `client.deactivated` | Upsert or disable the client and block its logins |
| `contact.portal_access_granted` / `revoked` | Invite the user or disable the login |
| `project.created` / `project.updated` / `project.closed` | Show, update, or archive the project for the client |
| `invoice.sent` / `invoice.updated` / `invoice.overdue` | Show on the billing page and notify the client |
| `invoice.paid` / `payment.received` | Mark the invoice paid and send a receipt notification |
| `announcement.published` | Show a banner to the targeted clients |
| `ticket.reply_from_crm` | Only needed if staff reply inside the CRM without calling the API |

### 5.2 Events from portal to CRM
| Event | What the CRM does |
|---|---|
| `ticket.created` | Create an activity and task on the client record, and notify the account manager |
| `ticket.message_added` | Add to the client timeline |
| `ticket.status_changed` / `ticket.escalated` / `ticket.sla_breached` | Update the dashboard and alert the manager |
| `ticket.resolved` + `ticket.csat_submitted` | Store the CSAT score on the client health score |
| `approval.approved` / `approval.rejected` | Advance the deal or project stage |
| `invoice.disputed` (ticket with category BILLING and an `invoice_id`) | Flag the invoice as disputed |
| `document.uploaded` | Attach the file to the client or project in the CRM |
| `client.change_requested` | Put it in the staff approval queue |

### 5.3 Webhook envelope, the same for both directions
```json
{
  "id": "evt_01J9...",            // unique; the receiver stores it for idempotency
  "type": "project.updated",
  "tenant_id": "tn_madhura",
  "occurred_at": "2026-09-25T10:00:00Z",
  "version": 1,
  "data": { /* full entity, not a diff */ }
}
```
Headers: `X-Madhura-Signature: sha256=<HMAC of body with shared secret>`, `X-Madhura-Timestamp`.

**Receiver rules:**
1. Verify the HMAC and reject if the timestamp is older than 5 minutes.
2. If this `id` was already processed, return `200` and do nothing.
3. Upsert by `externalId`. Ignore the event if `data.updated_at` is older than the stored copy (last-write-wins, but only for the owner's fields).
4. Return `2xx` quickly and do the heavy work in a queue.
5. The sender retries with exponential backoff (1m, 5m, 30m, 2h, 12h), then moves the event to a dead-letter list that the admin UI shows.

**Loop guard:** a change that arrives by webhook is saved with `source = "crm"` or `"portal"` and **does not** trigger an outgoing webhook back to its origin.

### 5.4 Safety net: reconciliation
A nightly job calls `GET ...?updated_since=<last_sync>` on both APIs and repairs anything that webhooks missed.

---

## 6. Example flows

### A. A client raises a question in the portal
```
Client (portal) ─ POST ticket ─► Portal DB ─ ticket.created ─► CRM
                                                        └► task for account manager, client timeline
CRM staff replies ─ POST /api/v1/tickets/:id/messages ─► Portal ─► client gets notification + email
```

### B. The CRM opens a project
```
CRM staff creates project (visible_to_client=true) ─ project.created ─► Portal
Portal: project appears under /projects for that client's users; notification sent
Client comments/approves milestone in portal ─ approval.approved ─► CRM moves stage
```

### C. Billing
```
CRM sends invoice ─ invoice.sent ─► Portal /billing shows it (+ PDF, Pay button)
Client clicks Pay ─ POST /v1/invoices/:id/payment-intent ─► gateway ─► CRM
CRM confirms ─ invoice.paid ─► Portal marks PAID, receipt notification
Client disputes ─ ticket(category=BILLING, related.invoice_id) ─► CRM flags invoice
```

---

## 7. Authentication and security

| Concern | Approach |
|---|---|
| User login | OIDC SSO at `auth.madhuracrm.com`. A JWT carries `sub, tenant_id, role, client_id`. The same login works in both apps. |
| Service-to-service | OAuth2 client-credentials, or an API key **for each tenant**, with scopes such as `clients:read`, `projects:read`, `invoices:read`, `tickets:write` |
| Webhooks | HMAC-SHA256 with a per-tenant secret and timestamp replay protection |
| Data isolation | Every query is filtered by `tenant_id`; client users are also filtered by `client_id` (use Postgres RLS) |
| What clients see | The portal hides `DRAFT` invoices, `internal: true` messages, and projects with `visible_to_client=false` |
| Transport | HTTPS only; CORS allows only `*.madhuracrm.com` and registered custom domains |
| Rate limits | 600 requests/min per API key; `429` responses include `Retry-After` |
| Audit | Every synced write is logged with `source`, `event_id`, and `actor` |

---

## 8. Portal tables to add when moving off localStorage

```sql
tenants(id, name, slug, custom_domain, crm_base_url, crm_api_key_enc, webhook_secret_enc, branding jsonb)
external_refs(tenant_id, entity, local_id, external_id, source, synced_at)   -- unique(tenant_id, entity, external_id)
webhook_events_in(id pk, tenant_id, type, received_at, processed_at, error)  -- idempotency
webhook_events_out(id, tenant_id, type, payload jsonb, attempts, next_try_at, status)  -- outbox + retries
sync_cursors(tenant_id, entity, last_synced_at)
```
Add `tenant_id` to every existing entity (clients, projects, tickets, invoices, documents, announcements, approvals).

**Outbox pattern:** write the entity and its `webhook_events_out` row in the same DB transaction. A worker sends the queued events. This way an event is never lost when the app crashes.

---

## 9. API conventions (both sides)

- Versioned base path `/v1`. Breaking changes go to `/v2`.
- JSON with `snake_case` fields and ISO-8601 UTC timestamps. Money is a number with a `currency` code.
- Cursor pagination: `?limit=50&cursor=...` returns `{ data, next_cursor }`.
- Filters: `updated_since`, `client_id`, `status`.
- Errors: `{ "error": { "code": "not_found", "message": "...", "request_id": "..." } }`.
- `Idempotency-Key` header is required on every POST.
- An OpenAPI spec is published at `/v1/openapi.json` on each service.

---

## 10. Build phases

| Phase | Scope | Result |
|---|---|---|
| **0. Contract** | Agree on the OpenAPI specs and event list (sections 3–5) with the CRM team | Signed-off API contract |
| **1. Read-only pull** | Portal backend (TanStack Start server functions in `src/server.ts`) calls the CRM API for clients, projects, and invoices; cached | Portal shows real CRM data |
| **2. SSO** | `auth.madhuracrm.com` OIDC; replace the demo role switcher | One login for both apps |
| **3. Tickets to CRM** | Portal DB, outbox, and `ticket.*` webhooks; CRM reply endpoint | Questions show in the CRM and replies come back |
| **4. CRM webhooks in** | `/api/v1/webhooks/crm` receiver with HMAC and idempotency | Projects and invoices appear instantly |
| **5. Billing actions** | PDF download, payment intent, `invoice.paid`, disputes | Clients pay from the portal |
| **6. Approvals and documents** | Two-way approvals and file sync | Milestone and quote sign-off |
| **7. Multi-tenant** | Tenant table, subdomain and custom-domain routing, per-tenant keys and branding | Any Madhura CRM customer gets a portal |
| **8. Hardening** | Nightly reconciliation, dead-letter UI, rate limits, audit log, monitoring | Production ready |

---

## 11. Checklist: what to ask the CRM team for

- [ ] Base URL and sandbox URL for the CRM API
- [ ] Auth method (OAuth client-credentials or API key) plus credentials for each tenant
- [ ] OpenAPI spec for clients, contacts, projects, invoices, payments, users, and announcements
- [ ] The CRM's enum values for statuses and tiers, and how they map to the portal enums above
- [ ] Webhook registration endpoint, the event list, and the signing secret
- [ ] `visible_to_client` flags for projects, invoices, and documents
- [ ] Payment gateway owner (CRM or portal) and callback URL
- [ ] SSO provider details (issuer, client id, and the redirect URI `https://clientportal.madhuracrm.com/auth/callback`)
- [ ] Rate limits and the `updated_since` filter on every list endpoint
