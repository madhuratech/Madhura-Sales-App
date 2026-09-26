# Madhura CRM ↔ Client Portal: Microservices Integration & API Specification

> **Environment Note:** Generated for live system integration. Contains complete contract details, REST API endpoints, Webhook protocols, document handling, live MongoDB data mappings, and **exact URIs with copy-paste Postman / cURL test requests**.

---

## 1. System Architecture & Boundaries

The ecosystem operates as two decoupled microservices:

1. **Madhura CRM (`madhuracrm.com` / `api.madhuracrm.com`):** Staff-facing operations for sales, onboarding, project delivery, and billing.
2. **Client Portal (`clientportal.madhuracrm.com`):** Client-facing self-service hub for project tracking, ticket management, invoice payment, and approvals.

```
                        ┌──────────────────────────────┐
                        │   auth.madhuracrm.com (SSO)  │  ← Shared OIDC / JWT Auth
                        └──────────────┬───────────────┘
                                       │ 
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
┌───────────────────────────────┐                             ┌─────────────────────────────────┐
│     Madhura CRM Service       │    REST API (Clients/Inv)   │      Client Portal Service      │
│     api.madhuracrm.com/v1     │ ──────────────────────────► │   clientportal.madhuracrm.com   │
│                               │ ◄────────────────────────── │                                 │
│  (Staff Side: Sales & Billing)│    Webhooks (Bidirectional) │   (Client Side: Self-Service)   │
│                               │ ◄─────────────────────────► │                                 │
│                               │    REST API (Tickets/Appr)  │                                 │
│                               │ ──────────────────────────► │                                 │
└──────────────┬────────────────┘                             └────────────────┬────────────────┘
               ▼                                                               ▼
        MongoDB (Live)                                                   Portal Database
```

### Entity Ownership (Single Source of Truth)

| Entity | Owner | Portal Privileges | CRM Privileges |
| :--- | :--- | :--- | :--- |
| **Clients (Company)** | **CRM** | Read profile, request edits | Full CRUD |
| **Client Contacts / Users** | **CRM** | Read; client admin invites | Full CRUD |
| **Projects & Milestones** | **CRM** | Read status/progress, comment | Full CRUD |
| **Invoices & Billing** | **CRM** | Read, download PDF, initiate payment | Full CRUD |
| **Payment Records** | **Gateway → CRM** | Initiate checkout | Record, verify, reconcile |
| **Tickets / Support Queries** | **Portal** | Full CRUD | Read, reply, reassign, update status |
| **Approvals (Quotes/Milestones)**| **Portal** | Approve or reject | Create request, read decision |
| **Documents & Attachments** | **Shared (Uploader)** | Upload and download | Upload and download |
| **Leads / Service Inquiries** | **CRM** | Create new lead from inquiry | Full CRUD |
| **Announcements** | **CRM** | Read targeted banners | Full CRUD |

---

## 2. Postman Quick-Setup & Environment Variables

To test in Postman, create an Environment named **"Madhura Integration"** with these variables:

| Variable Name | Staging / Localhost Value | Production Live Value | Description |
| :--- | :--- | :--- | :--- |
| `crm_base_url` | `http://localhost:5005/v1` | `https://api.madhuracrm.com/v1` | Base URL for CRM public API |
| `portal_base_url` | `http://localhost:3000/api/v1` | `https://clientportal.madhuracrm.com/api/v1` | Base URL for Client Portal API |
| `crm_api_key` | `crm_test_key_9981abc` | `crm_live_9981abc123` | Per-tenant API key for auth |
| `tenant_id` | `company_madhura` | `company_madhura` | Multi-tenant company identifier |
| `sample_client_id`| `664fa1b209e5b2001a123456` | `664fa1b209e5b2001a123456` | Example Client ID |
| `sample_project_id`| `664fa3c309e5b2001a789012` | `664fa3c309e5b2001a789012` | Example Project ID |
| `sample_invoice_id`| `664fa4e509e5b2001a345678` | `664fa4e509e5b2001a345678` | Example Tax Invoice ID |
| `sample_ticket_id` | `tkt_7781` | `tkt_7781` | Example Support Ticket ID |
| `webhook_secret` | `whsec_madhura_test_secret_442`| `whsec_madhura_live_secret_991` | Shared HMAC secret for webhooks |

---

## 3. Inbound APIs: Endpoints CRM Exposes to Portal (With Postman Exact URIs)

### 3.1 Clients API

#### 3.1.1 Get All Clients
* **Exact Method & URI:** `GET {{crm_base_url}}/clients`
  * *Localhost:* `http://localhost:5005/v1/clients`
  * *Live:* `https://api.madhuracrm.com/v1/clients`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Sample cURL for Postman Import:**
  ```bash
  curl -X GET "https://api.madhuracrm.com/v1/clients" \
    -H "X-API-Key: crm_live_9981abc123" \
    -H "Content-Type: application/json"
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "664fa1b209e5b2001a123456",
        "tenant_id": "company_madhura",
        "name": "Acme Technologies Private Limited",
        "code": "ACME",
        "tier": "ENTERPRISE",
        "primary_contact": {
          "name": "Ravi Kumar",
          "email": "ravi@acme.com",
          "phone": "+919876543210"
        },
        "billing_email": "accounts@acme.com",
        "website": "https://acme.com",
        "address": "123 Anna Salai, Chennai, Tamil Nadu, 600002",
        "gstin": "33AAAAA0000A1Z5",
        "account_manager_id": "664f98a109e5b2001a654321",
        "active": true,
        "updated_at": "2026-09-25T10:00:00.000Z"
      }
    ],
    "next_cursor": null
  }
  ```

---

#### 3.1.2 Get Single Client by ID
* **Exact Method & URI:** `GET {{crm_base_url}}/clients/{{sample_client_id}}`
  * *Localhost:* `http://localhost:5005/v1/clients/664fa1b209e5b2001a123456`
  * *Live:* `https://api.madhuracrm.com/v1/clients/664fa1b209e5b2001a123456`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "id": "664fa1b209e5b2001a123456",
    "tenant_id": "company_madhura",
    "name": "Acme Technologies Private Limited",
    "code": "ACME",
    "tier": "ENTERPRISE",
    "primary_contact": {
      "name": "Ravi Kumar",
      "email": "ravi@acme.com",
      "phone": "+919876543210"
    },
    "billing_email": "accounts@acme.com",
    "website": "https://acme.com",
    "address": "123 Anna Salai, Chennai, Tamil Nadu, 600002",
    "gstin": "33AAAAA0000A1Z5",
    "account_manager_id": "664f98a109e5b2001a654321",
    "active": true,
    "updated_at": "2026-09-25T10:00:00.000Z"
  }
  ```

---

#### 3.1.3 Get Client Contacts / Portal Users
* **Exact Method & URI:** `GET {{crm_base_url}}/clients/{{sample_client_id}}/contacts`
  * *Localhost:* `http://localhost:5005/v1/clients/664fa1b209e5b2001a123456/contacts`
  * *Live:* `https://api.madhuracrm.com/v1/clients/664fa1b209e5b2001a123456/contacts`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Expected Response (`200 OK`):**
  ```json
  [
    {
      "id": "con_001",
      "client_id": "664fa1b209e5b2001a123456",
      "name": "Ravi Kumar",
      "email": "ravi@acme.com",
      "phone": "+919876543210",
      "portal_access": true,
      "portal_role": "CLIENT_ADMIN"
    }
  ]
  ```

---

#### 3.1.4 Client Change Request (Profile / Billing Edit)
* **Exact Method & URI:** `POST {{crm_base_url}}/clients/{{sample_client_id}}/change-requests`
  * *Localhost:* `http://localhost:5005/v1/clients/664fa1b209e5b2001a123456/change-requests`
  * *Live:* `https://api.madhuracrm.com/v1/clients/664fa1b209e5b2001a123456/change-requests`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  Idempotency-Key: e8b94158-b30a-49ef-b3e1-884cfb721867
  ```
* **Request Body (JSON):**
  ```json
  {
    "client_id": "664fa1b209e5b2001a123456",
    "requested_by": "con_001",
    "changes": {
      "billing_email": "billing-new@acme.com",
      "address": "Tower B, Level 4, Tech Park, Chennai - 600096"
    },
    "notes": "Relocated office, GST address update requested"
  }
  ```
* **Expected Response (`202 Accepted`):**
  ```json
  {
    "success": true,
    "request_id": "req_change_098234",
    "message": "Change request submitted for staff verification"
  }
  ```

---

### 3.2 Projects API

#### 3.2.1 Get Projects for Client
* **Exact Method & URI:** `GET {{crm_base_url}}/projects?client_id={{sample_client_id}}&updated_since=2026-09-01T00:00:00Z`
  * *Localhost:* `http://localhost:5005/v1/projects?client_id=664fa1b209e5b2001a123456&updated_since=2026-09-01T00:00:00Z`
  * *Live:* `https://api.madhuracrm.com/v1/projects?client_id=664fa1b209e5b2001a123456&updated_since=2026-09-01T00:00:00Z`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "664fa3c309e5b2001a789012",
        "client_id": "664fa1b209e5b2001a123456",
        "name": "ERP Modernization",
        "code": "PRJ-2026-004",
        "status": "ACTIVE",
        "progress": 65,
        "start_date": "2026-08-01T00:00:00.000Z",
        "target_date": "2026-11-30T00:00:00.000Z",
        "lead_user_id": "664f98a109e5b2001a654321",
        "description": "Full sales and billing module overhaul",
        "milestones": [
          { "name": "UI/UX Design", "due": "2026-08-25T00:00:00.000Z", "done": true },
          { "name": "Backend APIs", "due": "2026-09-30T00:00:00.000Z", "done": false }
        ],
        "visible_to_client": true,
        "updated_at": "2026-09-25T11:00:00.000Z"
      }
    ],
    "next_cursor": null
  }
  ```

---

### 3.3 Invoices & Billing API

#### 3.3.1 Get Invoices for Client
* **Exact Method & URI:** `GET {{crm_base_url}}/invoices?client_id={{sample_client_id}}&status=SENT`
  * *Localhost:* `http://localhost:5005/v1/invoices?client_id=664fa1b209e5b2001a123456&status=SENT`
  * *Live:* `https://api.madhuracrm.com/v1/invoices?client_id=664fa1b209e5b2001a123456&status=SENT`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "664fa4e509e5b2001a345678",
        "number": "INV-2026-0142",
        "client_id": "664fa1b209e5b2001a123456",
        "project_id": "664fa3c309e5b2001a789012",
        "currency": "INR",
        "amount": 100000,
        "tax": 18000,
        "total": 118000,
        "balance_due": 59000,
        "status": "SENT",
        "issue_date": "2026-09-10T00:00:00.000Z",
        "due_date": "2026-09-25T00:00:00.000Z",
        "paid_date": null,
        "items": [
          {
            "sl_no": 1,
            "description": "Software Development Services Phase 1",
            "sac_code": "998314",
            "quantity": 1,
            "rate": 100000,
            "total_amount": 118000
          }
        ],
        "payment_link": "https://pay.madhuracrm.com/inv_664fa4e509e5b2001a345678",
        "pdf_url": "https://api.madhuracrm.com/v1/invoices/664fa4e509e5b2001a345678/pdf"
      }
    ]
  }
  ```

---

#### 3.3.2 Download Invoice PDF (Signed Expirable URL)
* **Exact Method & URI:** `GET {{crm_base_url}}/invoices/{{sample_invoice_id}}/pdf`
  * *Localhost:* `http://localhost:5005/v1/invoices/664fa4e509e5b2001a345678/pdf`
  * *Live:* `https://api.madhuracrm.com/v1/invoices/664fa4e509e5b2001a345678/pdf`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "invoice_id": "664fa4e509e5b2001a345678",
    "invoice_number": "INV-2026-0142",
    "pdf_url": "https://res.cloudinary.com/madhura/image/upload/v1727265600/invoices/INV-2026-0142.pdf"
  }
  ```

---

#### 3.3.3 Create Payment Intent (Razorpay / Stripe)
* **Exact Method & URI:** `POST {{crm_base_url}}/invoices/{{sample_invoice_id}}/payment-intent`
  * *Localhost:* `http://localhost:5005/v1/invoices/664fa4e509e5b2001a345678/payment-intent`
  * *Live:* `https://api.madhuracrm.com/v1/invoices/664fa4e509e5b2001a345678/payment-intent`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  Idempotency-Key: f9a18432-d11b-4890-a2bc-33411099ff21
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "order_id": "order_Hkd98234jdf",
    "currency": "INR",
    "amount": 5900000,
    "gateway": "RAZORPAY",
    "key_id": "rzp_live_xxxxxxxxxxxx"
  }
  ```

---

### 3.4 Staff Users API

#### 3.4.1 Get Support / Account Managers
* **Exact Method & URI:** `GET {{crm_base_url}}/users?role=support`
  * *Localhost:* `http://localhost:5005/v1/users?role=support`
  * *Live:* `https://api.madhuracrm.com/v1/users?role=support`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Expected Response (`200 OK`):**
  ```json
  [
    {
      "id": "664f98a109e5b2001a654321",
      "name": "Saravanan M",
      "email": "saravanan@madhuracrm.com",
      "role": "Manager",
      "job_title": "Senior Account Manager",
      "phone": "+919840011223",
      "avatar": "https://res.cloudinary.com/madhura/image/upload/v1/profile_pics/user1.jpg"
    }
  ]
  ```

---

### 3.5 Leads API (Request New Service)

#### 3.5.1 Submit Service Request from Portal
* **Exact Method & URI:** `POST {{crm_base_url}}/leads`
  * *Localhost:* `http://localhost:5005/v1/leads`
  * *Live:* `https://api.madhuracrm.com/v1/leads`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  Idempotency-Key: c18b87e2-411a-4712-9ab2-0857731bf7a8
  ```
* **Request Body (JSON):**
  ```json
  {
    "client_id": "664fa1b209e5b2001a123456",
    "clientName": "Ravi Kumar",
    "companyName": "Acme Technologies",
    "phone": "+919876543210",
    "email": "ravi@acme.com",
    "serviceInterested": "Mobile App Development",
    "notes": "Client requested an add-on quote for iOS & Android app"
  }
  ```
* **Expected Response (`201 Created`):**
  ```json
  {
    "success": true,
    "lead_id": "664fb90109e5b2001a998877",
    "status": "Lead Taken",
    "message": "Lead registered in CRM pipeline"
  }
  ```

---

### 3.6 Announcements API

#### 3.6.1 Get Targeted Announcements
* **Exact Method & URI:** `GET {{crm_base_url}}/announcements?client_id={{sample_client_id}}`
  * *Localhost:* `http://localhost:5005/v1/announcements?client_id=664fa1b209e5b2001a123456`
  * *Live:* `https://api.madhuracrm.com/v1/announcements?client_id=664fa1b209e5b2001a123456`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Expected Response (`200 OK`):**
  ```json
  [
    {
      "id": "ann_101",
      "title": "Scheduled Maintenance Window",
      "content": "Portal services will be undergoing database maintenance on Sunday at 02:00 IST.",
      "category": "MAINTENANCE",
      "published_at": "2026-09-25T09:00:00.000Z"
    }
  ]
  ```

---

## 4. Reverse APIs: Endpoints CRM Calls on the Portal (With Postman Exact URIs)

These endpoints are hosted on the **Client Portal** (`clientportal.madhuracrm.com/api/v1`) and invoked by the CRM staff backend.

### 4.1 Get Tickets for Client
* **Exact Method & URI:** `GET {{portal_base_url}}/tickets?client_id={{sample_client_id}}&status=OPEN`
  * *Localhost:* `http://localhost:3000/api/v1/tickets?client_id=664fa1b209e5b2001a123456&status=OPEN`
  * *Live:* `https://clientportal.madhuracrm.com/api/v1/tickets?client_id=664fa1b209e5b2001a123456&status=OPEN`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "tkt_7781",
        "code": "TCK-1042",
        "client_id": "664fa1b209e5b2001a123456",
        "project_id": "664fa3c309e5b2001a789012",
        "title": "Invoice amount calculation discrepancy",
        "description": "Please check the line item tax on milestone invoice 2.",
        "category": "BILLING",
        "priority": "HIGH",
        "status": "OPEN",
        "creator": { "contact_id": "con_001", "email": "ravi@acme.com" },
        "assignee_id": "664f98a109e5b2001a654321",
        "created_at": "2026-09-25T11:00:00.000Z"
      }
    ]
  }
  ```

---

### 4.2 Get Ticket Detail & Message History
* **Exact Method & URI:** `GET {{portal_base_url}}/tickets/{{sample_ticket_id}}`
  * *Localhost:* `http://localhost:3000/api/v1/tickets/tkt_7781`
  * *Live:* `https://clientportal.madhuracrm.com/api/v1/tickets/tkt_7781`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "id": "tkt_7781",
    "code": "TCK-1042",
    "title": "Invoice amount calculation discrepancy",
    "status": "OPEN",
    "messages": [
      {
        "id": "msg_001",
        "sender": "CLIENT",
        "author_name": "Ravi Kumar",
        "text": "Please check the line item tax on milestone invoice 2.",
        "created_at": "2026-09-25T11:00:00.000Z"
      }
    ]
  }
  ```

---

### 4.3 Post Staff Reply on Ticket
* **Exact Method & URI:** `POST {{portal_base_url}}/tickets/{{sample_ticket_id}}/messages`
  * *Localhost:* `http://localhost:3000/api/v1/tickets/tkt_7781/messages`
  * *Live:* `https://clientportal.madhuracrm.com/api/v1/tickets/tkt_7781/messages`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Request Body (JSON):**
  ```json
  {
    "author_id": "664f98a109e5b2001a654321",
    "author_name": "Saravanan M",
    "message": "We have reviewed and adjusted the advance adjustment line. The revised invoice is updated.",
    "internal": false
  }
  ```
* **Expected Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message_id": "msg_002",
    "created_at": "2026-09-25T12:00:00.000Z"
  }
  ```

---

### 4.4 Update Ticket Status / Priority / Assignee
* **Exact Method & URI:** `PATCH {{portal_base_url}}/tickets/{{sample_ticket_id}}`
  * *Localhost:* `http://localhost:3000/api/v1/tickets/tkt_7781`
  * *Live:* `https://clientportal.madhuracrm.com/api/v1/tickets/tkt_7781`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Request Body (JSON):**
  ```json
  {
    "status": "RESOLVED",
    "priority": "MEDIUM",
    "assignee_id": "664f98a109e5b2001a654321"
  }
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "success": true,
    "ticket_id": "tkt_7781",
    "status": "RESOLVED"
  }
  ```

---

### 4.5 Create Client Approval Request (Quote / Milestone Sign-off)
* **Exact Method & URI:** `POST {{portal_base_url}}/approvals`
  * *Localhost:* `http://localhost:3000/api/v1/approvals`
  * *Live:* `https://clientportal.madhuracrm.com/api/v1/approvals`
* **Headers:**
  ```http
  X-API-Key: {{crm_api_key}}
  Content-Type: application/json
  ```
* **Request Body (JSON):**
  ```json
  {
    "client_id": "664fa1b209e5b2001a123456",
    "type": "QUOTATION",
    "entity_id": "quot_9901",
    "title": "Quotation Sign-Off: ERP Phase 2",
    "amount": 250000,
    "currency": "INR",
    "document_url": "https://res.cloudinary.com/madhura/image/upload/v1/quotations/quot_9901.pdf",
    "due_date": "2026-09-30T18:00:00.000Z"
  }
  ```
* **Expected Response (`201 Created`):**
  ```json
  {
    "success": true,
    "approval_id": "appr_901",
    "status": "PENDING"
  }
  ```

---

## 5. Webhook Postman Testing Guide (With HMAC Signatures)

Webhooks use HMAC-SHA256 signatures to ensure authenticity and replay protection.

### How to calculate `X-Madhura-Signature` for Postman:
In Postman **Pre-request Script** tab, paste this script:
```javascript
const secret = pm.environment.get("webhook_secret") || "whsec_madhura_test_secret_442";
const timestamp = Math.floor(Date.now() / 1000).toString();
const payload = pm.request.body.raw;

const hmac = CryptoJS.HmacSHA256(payload, secret).toString(CryptoJS.enc.Hex);

pm.request.headers.upsert({ key: "X-Madhura-Signature", value: "sha256=" + hmac });
pm.request.headers.upsert({ key: "X-Madhura-Timestamp", value: timestamp });
```

---

### 5.1 Test Webhook: Portal → CRM (`POST /v1/webhooks/portal`)
Simulates the portal notifying the CRM that a new support ticket was created.

* **Exact Method & URI:** `POST {{crm_base_url}}/webhooks/portal`
  * *Localhost:* `http://localhost:5005/v1/webhooks/portal`
  * *Live:* `https://api.madhuracrm.com/v1/webhooks/portal`
* **Headers:**
  ```http
  Content-Type: application/json
  X-Madhura-Signature: sha256=a88e990c64894389df... (calculated by pre-request script)
  X-Madhura-Timestamp: 1727265600
  ```
* **Sample Payload 1: `ticket.created`**
  ```json
  {
    "id": "evt_01J8Y4X7N9K34P123456",
    "type": "ticket.created",
    "tenant_id": "company_madhura",
    "occurred_at": "2026-09-25T16:30:00.000Z",
    "version": 1,
    "data": {
      "id": "tkt_7781",
      "code": "TCK-1042",
      "client_id": "664fa1b209e5b2001a123456",
      "project_id": "664fa3c309e5b2001a789012",
      "title": "Payment gateway confirmation delayed",
      "description": "Payment was debited but invoice is still pending",
      "category": "BILLING",
      "priority": "HIGH",
      "status": "OPEN",
      "creator": { "contact_id": "con_001", "email": "ravi@acme.com" },
      "assignee_id": "664f98a109e5b2001a654321"
    }
  }
  ```
* **Sample Payload 2: `approval.approved`**
  ```json
  {
    "id": "evt_01J8Y4X7N9K34P987654",
    "type": "approval.approved",
    "tenant_id": "company_madhura",
    "occurred_at": "2026-09-25T16:35:00.000Z",
    "version": 1,
    "data": {
      "approval_id": "appr_901",
      "client_id": "664fa1b209e5b2001a123456",
      "type": "QUOTATION",
      "entity_id": "quot_9901",
      "approved_by": "Ravi Kumar (ravi@acme.com)",
      "comments": "Approved. Please proceed with delivery schedule."
    }
  }
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "success": true,
    "received": true,
    "event_id": "evt_01J8Y4X7N9K34P123456"
  }
  ```

---

### 5.2 Test Webhook: CRM → Portal (`POST /api/v1/webhooks/crm`)
Simulates the CRM pushing an updated project status or invoice to the portal.

* **Exact Method & URI:** `POST {{portal_base_url}}/webhooks/crm`
  * *Localhost:* `http://localhost:3000/api/v1/webhooks/crm`
  * *Live:* `https://clientportal.madhuracrm.com/api/v1/webhooks/crm`
* **Headers:**
  ```http
  Content-Type: application/json
  X-Madhura-Signature: sha256=... (calculated by pre-request script)
  X-Madhura-Timestamp: 1727265600
  ```
* **Sample Payload: `invoice.sent`**
  ```json
  {
    "id": "evt_01J8Y4X7N9K34P445566",
    "type": "invoice.sent",
    "tenant_id": "company_madhura",
    "occurred_at": "2026-09-25T16:40:00.000Z",
    "version": 1,
    "data": {
      "id": "664fa4e509e5b2001a345678",
      "number": "INV-2026-0142",
      "client_id": "664fa1b209e5b2001a123456",
      "project_id": "664fa3c309e5b2001a789012",
      "currency": "INR",
      "amount": 100000,
      "tax": 18000,
      "total": 118000,
      "balance_due": 118000,
      "status": "SENT",
      "issue_date": "2026-09-25T00:00:00.000Z",
      "due_date": "2026-10-10T00:00:00.000Z",
      "payment_link": "https://pay.madhuracrm.com/inv_664fa4e509e5b2001a345678",
      "pdf_url": "https://api.madhuracrm.com/v1/invoices/664fa4e509e5b2001a345678/pdf"
    }
  }
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "success": true,
    "received": true,
    "event_id": "evt_01J8Y4X7N9K34P445566"
  }
  ```

---

## 6. Document Management & File Storage

| Document Type | Live Source Model | Storage & CDN Provider | Portal Access Mechanism |
| :--- | :--- | :--- | :--- |
| **Tax Invoice PDF** | `TaxInvoice` | Cloudinary (`/invoices/tax/...`) | `GET /v1/invoices/:id/pdf` (Signed URL) |
| **Proforma Invoice PDF**| `ProformaInvoice` | Cloudinary (`/invoices/proforma/...`) | Shared PDF URL in approval payload |
| **Quotation PDF** | `CrmQuotation` | Cloudinary (`/quotations/...`) | Attached to `approval.created` event |
| **Payment Receipt PDF** | `PaymentReceipt` | Cloudinary (`/receipts/...`) | Linked under invoice payment history |
| **Client Uploads** | Direct Upload | Cloudinary (`/client_uploads/...`) | Passed via `document.uploaded` webhook |

---

## 7. Live MongoDB Field Mapping Reference

| Target API Field | Live DB Collection | Live Field Path | Transformation Note |
| :--- | :--- | :--- | :--- |
| `client.id` | `clientonboardings` | `_id` | String representation of ObjectId |
| `client.name` | `clientonboardings` | `businessName` | Direct mapping |
| `client.code` | `clientonboardings` | Generated or `gstNumber` prefix | Fallback to acronym of businessName |
| `client.primary_contact` | `clientonboardings` | `{ ownerName, phone, email }` | Formatted into nested contact object |
| `client.account_manager_id`| `clientonboardings` | `executive` | User ObjectId reference |
| `project.id` | `projects` | `_id` | String representation of ObjectId |
| `project.client_id` | `projects` | `client` | References `clientonboardings._id` |
| `project.visible_to_client`| `projects` | `visible_to_client` (default: `true`) | Controls portal visibility |
| `invoice.id` | `taxinvoices` | `_id` | String representation of ObjectId |
| `invoice.number` | `taxinvoices` | `invoice_no` | Direct mapping |
| `invoice.client_id` | `taxinvoices` | `client_id` | References `customers._id` or onboarding |
| `invoice.total` | `taxinvoices` | Sum of `items.total_amount` | Calculated live total |
| `invoice.balance_due` | `taxinvoices` | `total - advance_amount - payments` | Reconciled balance |
| `staff.avatar` | `users` | `profilePicture` | Cloudinary URL |

---

## 8. Authentication & Tenant Isolation Standards

1. **Multi-Tenancy:**
   - Every database query and webhook payload must carry `tenant_id` (which maps to `companyId` in the CRM database).
   - In the portal, client queries must strictly enforce both `tenant_id` AND `client_id` to ensure complete data isolation.
2. **SSO JWT Payload Specification (`auth.madhuracrm.com`):**
   ```json
   {
     "sub": "usr_664fa1b209e5b2001a123456",
     "tenant_id": "company_madhura",
     "role": "CLIENT_ADMIN",
     "client_id": "664fa1b209e5b2001a123456",
     "email": "ravi@acme.com",
     "name": "Ravi Kumar",
     "iat": 1727262000,
     "exp": 1727348400
   }
   ```
3. **Rate Limiting:**
   - 600 requests/minute per API key.
   - Standard `429 Too Many Requests` response containing `Retry-After: <seconds>` header.
4. **Nightly Reconciliation Safety Net:**
   - Cron runs at `02:00 UTC` executing `GET ...?updated_since=<timestamp>` to synchronize any webhook delivery dropouts.
