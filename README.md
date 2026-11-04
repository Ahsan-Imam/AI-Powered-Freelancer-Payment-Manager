# ⚡ AI-Powered Freelancer Payment Manager

An intelligent financial management platform tailored for freelancers to manage client contracts, milestone-based projects, invoicing, and PayPal payments, backed by an AI Financial Assistant.

---

## 📋 Table of Contents
- [Tech Stack](#-tech-stack)
- [Key Features](#-key-features)
- [Project Architecture](#-project-architecture)
- [Quick Start Guide](#-quick-start-guide)
- [Environment Configuration (`.env`)](#-environment-configuration-env)
- [PayPal Sandbox Setup](#-paypal-sandbox-setup)
- [AI Assistant & Gemini API Setup](#-ai-assistant--gemini-api-setup)
- [API Reference](#-api-reference)
- [Database Schema](#-database-schema)
- [Demo Credentials](#-demo-credentials)

---

## 🛠 Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 19 + Tailwind CSS 4 | Vite, React Router v7, Axios, responsive design |
| **Backend** | Node.js + Express 5 | REST API, JWT authentication, bcryptjs |
| **Database** | MySQL 8+ / SQLite | Auto-detects MySQL; falls back to embedded persistent SQLite |
| **AI Engine** | Google Gemini API (2.0 Flash) | Context-aware financial assistant with smart local fallback |
| **Payments** | PayPal REST API (Sandbox) | `@paypal/checkout-server-sdk`, order creation & capture |

---

## ✨ Key Features

1. **📊 Financial Dashboard**
   - Instant KPI metrics: Total Earnings, Pending Payments, Completed Transactions, and Overdue Invoices.
   - Monthly revenue bar chart comparing earnings over the past 12 months.
   - Live transaction feeds and recent invoice status trackers.

2. **🤖 AI Payment Assistant**
   - Natural language conversational financial assistant.
   - Answers questions like:
     - *"How much did I earn this month?"*
     - *"Which clients have pending payments?"*
     - *"Show my overdue invoices."*
     - *"Give me a summary of my financial performance."*
   - Contextual financial data injection with Google Gemini API and built-in offline fallback.

3. **🔔 Smart Overdue Reminders**
   - Automatically identifies invoices that have passed their due date.
   - Calculates exact days overdue and generates tone-calibrated reminder messages (polite, assertive, or firm).
   - One-click copy to clipboard to easily email or message clients.

4. **📝 AI Invoice Generator**
   - Converts natural language descriptions into structured, itemized invoices.
     - *Example prompt:* `"Created landing page design and implemented 3 API endpoints for 25 hours at $80/hr"`
   - Automatically breaks down items, quantities, rates, subtotal, and tax.
   - Full manual edit capability with line-item management and printable invoice view.

5. **📈 AI Income Insights**
   - Analyzes income trends, month-over-month growth, and client concentration risks.
   - Identifies late-paying clients and provides actionable recommendations to optimize cash flow.

6. **🎯 Milestone Payments**
   - Divides large projects into distinct deliverables and milestones.
   - Tracks individual milestone due dates, progress statuses, and payment states (`unpaid` / `paid`).

7. **💳 PayPal Sandbox Integration**
   - Secure server-side PayPal order creation with invoice reference IDs.
   - Customer checkout flow via PayPal Sandbox.
   - Payment capture that automatically marks invoices as `paid` and updates related project milestones.

---

## 📁 Project Architecture

```
ai_payment_paypal/
├── package.json                 # Root convenience scripts
├── README.md                    # Project documentation
├── server/                      # Node.js + Express Backend
│   ├── .env                     # Server environment variables
│   ├── .env.example             # Environment template
│   ├── index.js                 # Express server entry point
│   ├── seed.js                  # Database seeding script
│   ├── config/
│   │   ├── database.js          # Hybrid MySQL & SQLite database adapter
│   │   └── paypal.js            # PayPal SDK client configuration
│   ├── middleware/
│   │   └── auth.js              # JWT Bearer token authentication guard
│   └── routes/
│       ├── auth.js              # Authentication (register, login, profile)
│       ├── clients.js           # Client CRUD and financial summaries
│       ├── projects.js          # Project management
│       ├── milestones.js        # Milestone tracking & status updates
│       ├── invoices.js          # Invoice CRUD, itemization, and status flow
│       ├── payments.js          # PayPal Sandbox order create, capture, verify
│       ├── dashboard.js         # Financial stats and monthly aggregations
│       └── ai.js                # AI Chat, invoice generation, reminders, insights
└── client/                      # React 19 + Tailwind CSS Frontend
    ├── index.html               # Single page application root HTML
    ├── vite.config.js           # Vite build & development proxy configuration
    ├── package.json             # Frontend dependencies
    └── src/
        ├── main.jsx             # React entry point
        ├── App.jsx              # Application routing & layout tree
        ├── index.css            # Tailwind CSS 4 directives & custom utilities
        ├── context/
        │   └── AuthContext.jsx  # Authentication state & session manager
        ├── utils/
        │   └── api.jsx          # Axios HTTP instance with JWT interceptor
        ├── components/
        │   ├── Navbar.jsx       # Top navigation bar
        │   ├── Sidebar.jsx      # Side navigation with route highlighting
        │   ├── Layout.jsx       # Main layout wrapper
        │   └── ProtectedRoute.jsx # Route authentication guard
        └── pages/
            ├── Dashboard.jsx    # Overview dashboard & charts
            ├── AIAssistant.jsx  # AI conversational chat assistant
            ├── Invoices.jsx     # Invoice list & AI Invoice Generator
            ├── InvoiceDetail.jsx# Printable invoice view with PayPal checkout
            ├── Clients.jsx      # Client directory
            ├── Projects.jsx     # Projects list & progress
            ├── ProjectDetail.jsx# Project milestones & tracking
            ├── Payments.jsx     # Transaction history & verification
            ├── Reminders.jsx    # Smart payment reminders
            ├── Insights.jsx     # Financial income insights report
            ├── Login.jsx        # Login page
            └── Register.jsx     # User registration page
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** v18+ (tested on Node v24)
- **npm** v9+
- *(Optional)* MySQL 8+ (if not running, application automatically uses embedded SQLite)

---

### Step 1: Start the Backend Server

```bash
cd server
npm start
```
The server will start on **`http://localhost:5000`**.

> **Note on Database:**
> The server automatically detects if MySQL is available. If MySQL is not running or credentials are not yet configured, it automatically initializes and connects to a persistent local SQLite database (`server/freelancer_payments.sqlite`) so everything works immediately out of the box.

To reset or seed demo data at any time:
```bash
cd server
npm run seed
```

---

### Step 2: Start the Frontend Client

In a separate terminal window:
```bash
cd client
npm run dev
```
The client will start on **`http://localhost:3000`**.

---

### Step 3: Access the Application

Open your browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

Log in using the pre-seeded demo account or register a new one:
- **Email:** `alex@freelancer.com`
- **Password:** `demo123`

---

## ⚙️ Environment Configuration (`.env`)

Create or update `server/.env`:

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Database (MySQL)
# If MySQL connection fails, server automatically falls back to SQLite
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=freelancer_payments

# PayPal Sandbox
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
PAYPAL_MODE=sandbox

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Authentication
JWT_SECRET=freelancer_payment_jwt_secret_2024_super_secure_key
```

---

## 💳 PayPal Sandbox Setup

To test with actual PayPal Sandbox credentials:

1. Go to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox).
2. Log in with your PayPal account and navigate to **Apps & Credentials** > **Sandbox**.
3. Create a new App or select the **Default Application**.
4. Copy your **Client ID** and **Secret Key**.
5. Paste them into `server/.env`:
   ```env
   PAYPAL_CLIENT_ID=your_actual_sandbox_client_id
   PAYPAL_CLIENT_SECRET=your_actual_sandbox_secret_key
   PAYPAL_MODE=sandbox
   ```
6. Restart the backend server. Unpaid invoices can now be paid via live PayPal Sandbox approval flow!

*(If left with default placeholder values, the built-in Sandbox Simulator handles orders and captures cleanly for immediate testing without external accounts).*

---

## 🤖 AI Assistant & Gemini API Setup

To enable real-time Gemini AI generation:

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create a free API key.
3. Paste the key into `server/.env`:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```
4. Restart the backend server.

*(If no key is configured, the system uses an intelligent rule-based local financial analysis engine that accurately calculates metrics, client debts, overdue days, and reminder templates).*

---

## 📡 API Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new freelancer account |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT |
| `GET` | `/api/auth/profile` | Get current user profile |
| `PUT` | `/api/auth/profile` | Update profile information |

### Dashboard (`/api/dashboard`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/stats` | Retrieve financial KPIs, monthly earnings, recent invoices & transactions |

### Clients (`/api/clients`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/clients` | List all clients with earnings and pending totals |
| `GET` | `/api/clients/:id` | Get details for a specific client |
| `POST` | `/api/clients` | Create a new client |
| `PUT` | `/api/clients/:id` | Update client details |
| `DELETE` | `/api/clients/:id` | Delete a client |

### Projects & Milestones (`/api/projects`, `/api/milestones`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects with milestone counts |
| `GET` | `/api/projects/:id` | Get project details including milestones array |
| `POST` | `/api/projects` | Create a new project |
| `PUT` | `/api/projects/:id` | Update project details |
| `DELETE` | `/api/projects/:id` | Delete a project |
| `POST` | `/api/milestones` | Add a new milestone to a project |
| `PUT` | `/api/milestones/:id` | Update milestone status and payment status |
| `DELETE` | `/api/milestones/:id` | Delete a milestone |

### Invoices (`/api/invoices`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/invoices` | List invoices (optional filter by `?status=`) |
| `GET` | `/api/invoices/:id` | Get single invoice with item breakdown and client info |
| `POST` | `/api/invoices` | Create a new invoice with itemized lines |
| `PUT` | `/api/invoices/:id` | Update invoice items or status |
| `POST` | `/api/invoices/:id/send` | Mark invoice status as `sent` |
| `DELETE` | `/api/invoices/:id` | Delete an invoice |

### Payments (`/api/payments`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/payments/create-order` | Create a PayPal order for an invoice |
| `POST` | `/api/payments/capture-order`| Capture payment, mark invoice & milestone paid |
| `GET` | `/api/payments/transactions` | Retrieve complete transaction history |
| `GET` | `/api/payments/verify/:orderID`| Verify PayPal transaction status |

### AI Capabilities (`/api/ai`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ai/chat` | AI financial assistant chat with dataset context |
| `POST` | `/api/ai/generate-invoice` | Generate structured invoice from description |
| `POST` | `/api/ai/reminders` | Generate personalized overdue payment reminders |
| `POST` | `/api/ai/insights` | Generate financial health and income insight report |

---

## 🗄 Database Schema

The application uses 7 interconnected relational entities:
- **`users`** — Freelancer profile, credentials, and business information.
- **`clients`** — Client contacts, billing addresses, and notes.
- **`projects`** — Project names, budgets, and date ranges.
- **`milestones`** — Deliverable milestones with amounts, due dates, and payment states (`unpaid`/`paid`).
- **`invoices`** — Unique invoice numbers, line items (JSON/Text), subtotal, tax rate, total, and status (`draft`, `sent`, `paid`, `overdue`).
- **`transactions`** — PayPal Order IDs, Capture IDs, amounts, currencies, and completion timestamps.
- **`reminders`** — Generated reminder message logs and delivery status.

---

## 👤 Demo Credentials

| Field | Value |
|---|---|
| **Email** | `alex@freelancer.com` |
| **Password** | `demo123` |
| **Name** | Alex Johnson |
| **Business** | Alex Design Studio |
