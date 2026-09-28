# Madhura CRM: Current Live API Testing Guide & Microservices Bridge

> **Important Clarification:**  
> The file `CRM_PORTAL_INTEGRATION.md` is a **future architecture proposal** between the CRM and the new Client Portal microservice.  
> The URIs in that document (like `https://api.madhuracrm.com/v1/clients`) are **contract specifications for what the new portal expects**, not the endpoints currently running in your live backend.  
> 
> This document lists the **actual, working APIs currently running in your `server.js` right now**, how to test them in Postman, and how to bridge them for the external microservice team.

---

## 1. Why Postman Failed in Your Test

When you ran `GET {{crm_base_url}}/clients` in Postman, it failed with:
`Error: getaddrinfo ENOTFOUND {{crm_base_url}}`

There are three reasons for this:
1. **Unresolved Variable:** The variable `{{crm_base_url}}` was not set in an active Postman Environment, so Postman literally tried to find a website called `http://{{crm_base_url}}`.
2. **Domain Does Not Exist in DNS:** `api.madhuracrm.com` is a proposed production domain name from `CRM_PORTAL_INTEGRATION.md`. It has not yet been pointed to your backend server in DNS.
3. **Endpoint Doesn't Exist in Code Yet:** In your live `server.js`, all existing routes start with `/api/...` (e.g., `/api/onboarding`, `/api/projects`), not `/v1/clients`.

---

## 2. Actual Live API Endpoints Running in Your Backend Right Now

Your current backend runs on port `5005` (or your live hosting server URL) with the base path:
```text
http://localhost:5005/api
```
*(If testing on your live cloud/VPS server, replace `http://localhost:5005` with your live server domain or IP).*

All existing private endpoints in your app require a **JWT Bearer Token** obtained from `/api/auth/login`.

---

### Step 1: Login to Get Your Bearer Token (Public Endpoint)

* **Method:** `POST`
* **URI:** `http://localhost:5005/api/auth/login`
* **Headers:**
  ```http
  Content-Type: application/json
  ```
* **Request Body (JSON):**
  ```json
  {
    "email": "divyamadhuratech@gmail.com",
    "password": "password123",
    "role": "Managing Director MD"
  }
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "...",
      "name": "Divya",
      "email": "divyamadhuratech@gmail.com",
      "role": "Managing Director MD"
    }
  }
  ```
* **Postman Action:** Copy the returned `token`. In Postman, add header:
  ```http
  Authorization: Bearer <paste_token_here>
  ```

---

### Step 2: Live Client / Onboarding APIs

#### A. Get All Onboarded Clients (Actual Live Route)
* **Method:** `GET`
* **URI:** `http://localhost:5005/api/onboarding`
* **Headers:**
  ```http
  Authorization: Bearer <your_token>
  Content-Type: application/json
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "success": true,
    "count": 5,
    "data": [
      {
        "_id": "664fa1b209e5b2001a123456",
        "businessName": "Acme Technologies",
        "businessType": "IT Services",
        "ownerName": "Ravi Kumar",
        "phone": "9876543210",
        "email": "ravi@acme.com",
        "location": {
          "address": "123 Anna Salai",
          "city": "Chennai",
          "state": "Tamil Nadu",
          "pincode": "600002"
        },
        "onboardingDate": "2026-09-25T10:00:00.000Z"
      }
    ]
  }
  ```

#### B. Search Clients (Live Route)
* **Method:** `GET`
* **URI:** `http://localhost:5005/api/client/search?name=Acme`
* **Headers:**
  ```http
  Authorization: Bearer <your_token>
  ```

---

### Step 3: Live Projects API

#### Get All Projects (Actual Live Route)
* **Method:** `GET`
* **URI:** `http://localhost:5005/api/projects`
* **Headers:**
  ```http
  Authorization: Bearer <your_token>
  Content-Type: application/json
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "success": true,
    "count": 2,
    "data": [
      {
        "_id": "664fa3c309e5b2001a789012",
        "name": "ERP Modernization",
        "projectCode": "PRJ-001",
        "client": {
          "_id": "664fa1b209e5b2001a123456",
          "businessName": "Acme Technologies",
          "ownerName": "Ravi Kumar"
        },
        "priority": "Medium",
        "status": "In Progress",
        "progress": 45
      }
    ]
  }
  ```

---

### Step 4: Live Invoices API

#### Get All Tax Invoices (Actual Live Route)
* **Method:** `GET`
* **URI:** `http://localhost:5005/api/madhura-invoice`
* **Headers:**
  ```http
  Authorization: Bearer <your_token>
  Content-Type: application/json
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "664fa4e509e5b2001a345678",
        "invoice_no": "INV-2026-0142",
        "client_company": "Acme Technologies",
        "bill_date": "2026-09-25T10:00:00.000Z",
        "total_amount": 118000,
        "paid_amount": 0,
        "due_amount": 118000,
        "status": "Pending"
      }
    ]
  }
  ```

---

### Step 5: Live Leads API

#### Get All Leads (Actual Live Route)
* **Method:** `GET`
* **URI:** `http://localhost:5005/api/leads`
* **Headers:**
  ```http
  Authorization: Bearer <your_token>
  ```

#### Create a Lead (Actual Live Route)
* **Method:** `POST`
* **URI:** `http://localhost:5005/api/leads`
* **Headers:**
  ```http
  Authorization: Bearer <your_token>
  Content-Type: application/json
  ```
* **Request Body:**
  ```json
  {
    "clientName": "Ravi Kumar",
    "companyName": "Acme Technologies",
    "phone": "9876543210",
    "email": "ravi@acme.com",
    "serviceInterested": "Mobile App",
    "status": "Lead Taken"
  }
  ```

---

### Step 6: Live Users API

#### Get All Staff Users (Actual Live Route)
* **Method:** `GET`
* **URI:** `http://localhost:5005/api/users`
* **Headers:**
  ```http
  Authorization: Bearer <your_token>
  ```

---

## 3. How to Give APIs to the External Microservices Team

The external team (Client Portal) wants standard `/v1/...` microservice endpoints (`GET /v1/clients`, `GET /v1/projects`, `GET /v1/invoices`).

You have two choices:

### Option A: Give Them the Current Live Endpoints Right Now
If you do not want to change any code in the backend:
1. Give them the base URL of your live server: e.g. `https://your-live-domain.com/api`
2. Give them the login credentials or a long-lived JWT token.
3. Tell them to use:
   - Clients: `GET /api/onboarding`
   - Projects: `GET /api/projects`
   - Invoices: `GET /api/madhura-invoice`
   - Leads: `POST /api/leads`

### Option B: Add a Dedicated `/v1` Microservices Adapter Router in the Backend
If the external team strictly requires the exact contract in `CRM_PORTAL_INTEGRATION.md` (e.g. `GET /v1/clients`, `GET /v1/projects` with an `X-API-Key`):
- We can add a non-breaking `v1Routes.js` to your backend.
- It will read from your existing MongoDB collections (`ClientOnboarding`, `Project`, `TaxInvoice`) and output the exact JSON format specified in `CRM_MICROSERVICES_API_SPECIFICATION.md`.
- It will not affect your existing mobile or web app (`/api/...` remains 100% untouched).
