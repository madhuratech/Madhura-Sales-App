# How to Use Madhura CRM Universal APIs: Developer Guide

Welcome to the **Madhura CRM Universal Two-Way API Gateway**. This guide explains how external applications (such as the Client Portal, mobile apps, or partner microservices) can connect, retrieve (**GET**), create (**POST**), and update (**PUT/PATCH**) data.

---

## 1. Quick Start & Connection Details

### 1.1 Base URLs

Depending on where you are testing, use the appropriate base URL:

* **Localhost (Testing on this machine):**  
  `http://localhost:5005/api/v1` *(or `http://localhost:5005/v1`)*
* **Live Production (Cloud Server):**  
  `https://crm.madhuratech.com/api/v1` *(or `https://crm.madhuratech.com/v1`)*

---

### 1.2 Authentication Header

Every API request (except the public `/health` endpoint) requires the **API Key** header:

```http
X-API-Key: crm_live_9981abc123
Content-Type: application/json
```

> **Optional Multi-Tenant Header:** If you manage multiple companies under Madhura CRM, pass:  
> `X-Tenant-ID: company_madhura`

---

## 2. Fast Track: The "Universal Share Bundle" (Get Everything in 1 Call)

Instead of making separate requests for clients, projects, invoices, and tickets, use this single endpoint to get a **complete client snapshot** in one network call.

### `GET /api/v1/share/bundle?client_id=<ID>`

* **URL:** `http://localhost:5005/api/v1/share/bundle?client_id=6a7c1d6d4b50dbbac70920cd`
* **Method:** `GET`
* **Headers:**
  ```http
  X-API-Key: crm_live_9981abc123
  ```
* **What it returns in one response:**
  1. Client Company Profile & Account Manager
  2. All Active Projects & Progress %
  3. Tax Invoices & Outstanding Due Balances
  4. Proforma Invoices (Advance billings)
  5. Support Questions / Tickets
  6. Pending Approvals

---

## 3. How to GET (Retrieve Data)

---

### 3.1 Get All Clients
Retrieves all onboarded client companies.

* **URL:** `GET /api/v1/clients`
* **cURL Example:**
  ```bash
  curl -X GET "http://localhost:5005/api/v1/clients" \
    -H "X-API-Key: crm_live_9981abc123"
  ```
* **Sample Response:**
  ```json
  {
    "success": true,
    "count": 5,
    "data": [
      {
        "id": "6a7c1d6d4b50dbbac70920cd",
        "name": "OG blanks",
        "owner_name": "Priyanka",
        "phone": "8883999927",
        "email": "priyankasp1995@gmail.com",
        "city": "Tiruppur",
        "state": "Tamil Nadu",
        "account_manager": "SWETHA"
      }
    ]
  }
  ```

---

### 3.2 Get Single Client by ID
* **URL:** `GET /api/v1/clients/6a7c1d6d4b50dbbac70920cd`
* **cURL Example:**
  ```bash
  curl -X GET "http://localhost:5005/api/v1/clients/6a7c1d6d4b50dbbac70920cd" \
    -H "X-API-Key: crm_live_9981abc123"
  ```

---

### 3.3 Get Projects
Retrieves all projects (or filter for a specific client).

* **URL:** `GET /api/v1/projects?client_id=6a7c1d6d4b50dbbac70920cd`
* **cURL Example:**
  ```bash
  curl -X GET "http://localhost:5005/api/v1/projects" \
    -H "X-API-Key: crm_live_9981abc123"
  ```
* **Sample Response:**
  ```json
  {
    "success": true,
    "count": 4,
    "data": [
      {
        "_id": "664fa3c309e5b2001a789012",
        "name": "ERP Modernization",
        "projectCode": "PRJ-001",
        "status": "In Progress",
        "progress": 65,
        "priority": "Medium"
      }
    ]
  }
  ```

---

### 3.4 Get Invoices & Due Balances
Retrieves billing data with automatic balance calculations (`total_amount - advance_amount`).

* **URL:** `GET /api/v1/invoices?client_id=6a7c1d6d4b50dbbac70920cd`
* **cURL Example:**
  ```bash
  curl -X GET "http://localhost:5005/api/v1/invoices" \
    -H "X-API-Key: crm_live_9981abc123"
  ```
* **Sample Response:**
  ```json
  {
    "success": true,
    "count": 4,
    "data": [
      {
        "id": "664fa4e509e5b2001a345678",
        "invoice_no": "INV-2026-0142",
        "client_company": "OG blanks",
        "bill_date": "2026-09-25T10:00:00.000Z",
        "total_amount": 118000,
        "advance_amount": 59000,
        "balance_due": 59000,
        "status": "PARTIALLY_PAID",
        "pdf_url": "https://crm.madhuratech.com/api/v1/invoices/664fa4e509e5b2001a345678/pdf"
      }
    ]
  }
  ```

---

### 3.5 Get Questions / Support Tickets
Retrieves client questions and threaded conversations.

* **URL:** `GET /api/v1/tickets?client_id=6a7c1d6d4b50dbbac70920cd&status=OPEN`
* **cURL Example:**
  ```bash
  curl -X GET "http://localhost:5005/api/v1/tickets" \
    -H "X-API-Key: crm_live_9981abc123"
  ```

---

## 4. How to CREATE (Send New Data)

---

### 4.1 Onboard a New Client
* **URL:** `POST /api/v1/clients`
* **Headers:**
  ```http
  X-API-Key: crm_live_9981abc123
  Content-Type: application/json
  ```
* **Request Body:**
  ```json
  {
    "businessName": "Skyline Enterprises",
    "businessType": "Manufacturing",
    "ownerName": "Rajesh Kumar",
    "phone": "9876543210",
    "email": "rajesh@skyline.com",
    "gstin": "33ABCDE1234F1Z5",
    "address": "Plot 12, Industrial Corridor",
    "city": "Madurai",
    "state": "Tamil Nadu",
    "pincode": "625001"
  }
  ```
* **cURL Example:**
  ```bash
  curl -X POST "http://localhost:5005/api/v1/clients" \
    -H "X-API-Key: crm_live_9981abc123" \
    -H "Content-Type: application/json" \
    -d '{
      "businessName": "Skyline Enterprises",
      "ownerName": "Rajesh Kumar",
      "phone": "9876543210",
      "email": "rajesh@skyline.com"
    }'
  ```

---

### 4.2 Ask a Question / Raise a Support Ticket
Clients use this to submit questions or issues directly into the CRM.

* **URL:** `POST /api/v1/tickets`
* **Request Body:**
  ```json
  {
    "client_id": "6a7c1d6d4b50dbbac70920cd",
    "title": "Need clarification on Milestone 2 Tax Invoice",
    "description": "Please verify if the advance adjustment was deducted from total.",
    "category": "BILLING",
    "priority": "HIGH",
    "author_name": "Priyanka",
    "author_email": "priyankasp1995@gmail.com"
  }
  ```
* **Sample Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "code": "TCK-1002",
      "status": "OPEN",
      "title": "Need clarification on Milestone 2 Tax Invoice",
      "messages": [
        {
          "sender": "CLIENT",
          "author_name": "Priyanka",
          "message": "Please verify if the advance adjustment was deducted from total."
        }
      ]
    }
  }
  ```

---

### 4.3 Reply to a Support Ticket
Add a reply from Staff or Client to an existing ticket conversation.

* **URL:** `POST /api/v1/tickets/<TICKET_ID>/messages`
* **Request Body:**
  ```json
  {
    "sender_type": "STAFF",
    "author_name": "Account Manager Swetha",
    "message": "We reviewed your invoice. The advance amount of ₹59,000 has been deducted. You can view the updated balance.",
    "internal": false
  }
  ```

---

### 4.4 Create a Payment Intent (Checkout / Payment Order)
* **URL:** `POST /api/v1/invoices/<INVOICE_ID>/payment-intent`
* **Request Body:**
  ```json
  {
    "amount": 59000,
    "currency": "INR"
  }
  ```
* **Sample Response:**
  ```json
  {
    "success": true,
    "order_id": "order_1727334567890",
    "amount_paisa": 5900000,
    "currency": "INR",
    "gateway": "RAZORPAY",
    "key_id": "rzp_live_sample_key_9981"
  }
  ```

---

## 5. How to EDIT & UPDATE (Two-Way Modifications)

---

### 5.1 Update Client Profile Directly
* **URL:** `PUT /api/v1/clients/6a7c1d6d4b50dbbac70920cd`
* **Request Body:**
  ```json
  {
    "email": "new-accounts@ogblanks.com",
    "phone": "9888877777"
  }
  ```

---

### 5.2 Submit Client Change Request (Review Queue)
If clients are not allowed to edit directly without approval, submit a change request:

* **URL:** `POST /api/v1/clients/6a7c1d6d4b50dbbac70920cd/change-requests`
* **Request Body:**
  ```json
  {
    "notes": "Relocated to new branch in Coimbatore. Updated GST address requested.",
    "requested_by": "Priyanka"
  }
  ```

---

### 5.3 Update Support Ticket Status
Change ticket to `IN_PROGRESS`, `RESOLVED`, or `CLOSED`.

* **URL:** `PATCH /api/v1/tickets/<TICKET_ID>`
* **Request Body:**
  ```json
  {
    "status": "RESOLVED",
    "priority": "LOW"
  }
  ```

---

### 5.4 Submit Client Approval (Approve / Reject Quote or Milestone)
* **URL:** `POST /api/v1/approvals/<APPROVAL_ID>/decide`
* **Request Body:**
  ```json
  {
    "decision": "APPROVED",
    "approved_by": "Priyanka (Authorized Signatory)",
    "comments": "Quotation accepted. Please commence project work."
  }
  ```

---

## 6. Code Examples for Integration

### 6.1 JavaScript / Node.js / React (Fetch API)

```javascript
// Fetch Client Bundle
async function getClientBundle(clientId) {
  const response = await fetch(`http://localhost:5005/api/v1/share/bundle?client_id=${clientId}`, {
    method: 'GET',
    headers: {
      'X-API-Key': 'crm_live_9981abc123',
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  console.log('Client Data:', data);
  return data;
}

// Ask a Support Question
async function askQuestion(clientId, title, description) {
  const response = await fetch('http://localhost:5005/api/v1/tickets', {
    method: 'POST',
    headers: {
      'X-API-Key': 'crm_live_9981abc123',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      title: title,
      description: description,
      author_name: 'Client Portal User'
    })
  });

  const newTicket = await response.json();
  console.log('Created Ticket:', newTicket);
  return newTicket;
}
```

---

### 6.2 Python (Requests)

```python
import requests

API_KEY = "crm_live_9981abc123"
BASE_URL = "http://localhost:5005/api/v1"
HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# 1. Get All Clients
clients_res = requests.get(f"{BASE_URL}/clients", headers=HEADERS)
print("Clients:", clients_res.json())

# 2. Ask a Question (Ticket)
ticket_payload = {
    "client_id": "6a7c1d6d4b50dbbac70920cd",
    "title": "Delivery Milestone Confirmation",
    "description": "Please verify delivery date for phase 1",
    "category": "GENERAL"
}
ticket_res = requests.post(f"{BASE_URL}/tickets", json=ticket_payload, headers=HEADERS)
print("Ticket Created:", ticket_res.json())
```

---

## 7. How to Test with Postman in 1 Minute

1. Open Postman.
2. Click **Import** (top left).
3. Choose the file:  
   📂 **[Madhura_CRM_Universal_API.postman_collection.json](file:///d:/madhuracrm/Madhura-Sales-App/Madhura_CRM_Universal_API.postman_collection.json)**
4. All 10 requests will be imported with pre-filled headers and live client IDs.
5. Click on **`2. Universal Share Bundle (All in 1)`** and press **Send**!
