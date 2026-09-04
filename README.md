# Personal AI CA (myCA)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black.svg?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB.svg?logo=react)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg?logo=express)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2015-3ECF8E.svg?logo=supabase)](https://supabase.com/)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini%202.5%20Flash-4285F4.svg?logo=google)](https://deepmind.google/technologies/gemini/)
[![Groq](https://img.shields.io/badge/Failover-Groq%20Llama%203.3%2070B-F55036.svg)](https://groq.com/)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM%20%7C%20HMAC--SHA256-green.svg)](https://csrc.nist.gov/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](#license)

> **Enterprise-grade, privacy-first Autonomous Financial Intelligence Desk & Indian Tax Cartography Engine.**  
> Built with Next.js 16, TypeScript, Express, Supabase PostgreSQL with strict Row-Level Security (RLS), multi-tier LLM failover orchestration (Google Gemini & Groq Llama 3.3), and tamper-evident cryptographic audit logs.

---

## 📑 Executive Overview

**myCA** is an intelligent personal financial co-pilot and automated tax advisory workstation engineered specifically for the Indian financial and statutory ecosystem (Income Tax Act 1961, Section 80C/80D/80CCD deductions, Old vs. New Tax Regime analysis, and GST provisions). 

Designed to bridge the gap between complex tax regulations and daily financial decision-making, the platform ingests transaction data and statutory records, dynamically projects tax liabilities, detects deductible allocations, and produces structured advisory responses backed by a resilient, multi-tiered AI architecture.

### Key Performance & Architectural Metrics
- **Zero-Trust Multi-Tenancy**: 100% database access isolated via PostgreSQL Row-Level Security (`auth.uid()`).
- **Cryptographic Integrity**: AES-256-GCM field-level encryption for PII (PAN, GSTIN) and HMAC-SHA256 tamper-evident signatures on AI advisory logs.
- **High-Availability AI**: Zero-downtime multi-tier fallback pipeline spanning Google Gemini (Tier 1) and Groq/Llama-3.3 (Tier 2) with deterministic safety harnesses.
- **Sub-Second Mutation Defense**: Distributed idempotency middleware (`Idempotency-Key`) preventing double-spend and duplicate transaction entries.
- **Enterprise Rate Limiting**: Multi-tiered token-bucket protection distinguishing authentication, AI compute, and standard CRUD endpoints.

---

## 🏛️ System Architecture

```
                                  ┌───────────────────────────────┐
                                  │   Client Web Application      │
                                  │   (Next.js 16 / React 19)     │
                                  └───────────────┬───────────────┘
                                                  │ HTTPS / HSTS / SameSite Cookies
                                                  ▼
                                  ┌───────────────────────────────┐
                                  │   Hardened Express Gateway    │
                                  │  - Helmet Content Security    │
                                  │  - Differentiated Rate Limits │
                                  │  - 15s/30s Request Timeouts   │
                                  │  - Idempotency Key Guard      │
                                  └───────┬───────────────┬───────┘
                                          │               │
                     ┌────────────────────┘               └───────────────────┐
                     ▼                                                        ▼
      ┌──────────────────────────────┐                         ┌──────────────────────────────┐
      │     Database & Storage       │                         │   Multi-Tier AI Pipeline     │
      │   (Supabase PostgreSQL 15)   │                         │                              │
      │  ├─ Strict RLS on auth.uid() │                         │  ├─ Tier 1: Google Gemini    │
      │  ├─ AES-256-GCM Encrypted    │                         │  │          (gemini-2.5-flash│
      │  ├─ HMAC Audit Ledger        │                         │  ├─ Tier 2: Groq / Llama-3.3 │
      │  └─ 15m Signed Storage URLs  │                         │  └─ Tier 3: Deterministic    │
      └──────────────────────────────┘                         │             Safety Mock      │
                                                               └──────────────────────────────┘
```

---

## 🎯 Core Technical Highlights

### 1. Multi-Tiered Resilient AI Orchestration
- **Primary Inference (Google Gemini)**: Structured reasoning engine using `@google/genai` with strict Zod schema validation and temperature tuning for financial accuracy.
- **Zero-Downtime Failover (Groq / SambaNova Llama 3.3 70B)**: Real-time fallback handler that automatically catches upstream API latency or outages and re-routes requests without user interruption.
- **Deterministic Guardrails**: Safe fallback provider preventing hallucinated advice when regulatory thresholds or uncertain financial intents are queried.

### 2. Bank-Grade Security & Cryptography
- **Field-Level Authenticated Encryption (AES-256-GCM)**: Sensitive government identifiers (PAN cards, GST numbers) are encrypted prior to database insertion with random 96-bit IVs and 128-bit authentication tags.
- **Tamper-Evident Advisory Audit Logs**: Every AI recommendation generates a canonical string signed with server-side HMAC-SHA256. Audit verification uses constant-time buffers (`crypto.timingSafeEqual`) to prevent timing attacks.
- **Automated PII Redaction & Data Retention**: Real-time masking for credit cards, tax identifiers, and phone numbers in application logs and prompt contexts, coupled with configurable data retention purge policies.

### 3. Comprehensive Indian Tax Computation Engine
- **Dual-Regime Tax Simulator**: Real-time evaluation contrasting Old Tax Regime (deductions under 80C, 80D, 80CCD, HRA, 24b) against the New Concessional Tax Regime (Section 115BAC).
- **Automated Deduction Cartography**: Real-time scanner identifying untapped tax-saving potential across ELSS, PPF, NPS, medical insurance, and home loan interest.
- **Statutory Non-Advisory Safe Harbors**: Automated injection of disclaimers compliant with SEBI and Income Tax Act guidance, ensuring outputs are informative and audit-ready.

### 4. Enterprise-Ready Backend Engineering
- **Idempotent Mutations**: Financial mutations require an `Idempotency-Key` header; in-flight and historical mutations are cached to eliminate duplicate ledger inserts.
- **Granular Traffic Control**: Tailored Express rate-limiters:
  - `authRateLimiter`: 20 requests / 15 mins (brute-force defense).
  - `aiRateLimiter`: 15 requests / min (cost & quota protection).
  - `standardApiRateLimiter`: 120 requests / min.
- **Row-Level Security (RLS)**: Enforced directly on PostgreSQL tables (`profiles`, `transactions`, `documents`, `ai_recommendations_log`, `financial_goals`) ensuring complete cross-user isolation at the database layer.

### 5. Modern High-Performance Frontend
- Built on **Next.js 16** (App Router) and **React 19** with Server Components and Client Components optimized for low bundle size and sub-100ms hydration.
- Fully responsive financial workstation featuring:
  - **Financial Intelligence Desk**: Dynamic conversation interface with streaming responses, source attribution, and disclaimers.
  - **Ledger & Analytics**: Interactive transaction records with category filtering, income vs. expense tracking, and statistical aggregations.
  - **Document Vault**: Encrypted cloud document management powered by private Supabase storage buckets and short-lived signed URLs (15-minute TTL).
  - **Compliance & Admin Center**: Real-time cryptographic log validation and system operational health monitor.

---

## 🛠️ Technology Stack & Skills Matrix

| Domain | Technologies / Frameworks / Tools |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Lucide Icons, Vanilla CSS Variables (Dark/Light mode) |
| **Backend API** | Node.js, Express.js 4, TypeScript 5.8, tsx runtime |
| **Database & Auth** | Supabase (PostgreSQL 15), Supabase Auth (JWT), Row-Level Security (RLS) Policies, PostgreSQL Triggers |
| **Artificial Intelligence** | Google Gemini API (`@google/genai`), Groq SDK (Llama 3.3 70B Versatile), Zod Schema Enforcement |
| **Security & Privacy** | AES-256-GCM, HMAC-SHA256, Helmet.js (CSP, HSTS, Frameguard DENY), Timing-Safe Verification |
| **Resilience & Middleware**| Idempotency Protection, Tiered Rate Limiting (`express-rate-limit`), Request Timeouts, Centralized AppError System |
| **Testing & Quality** | Supertest, Node.js Native Test Runner, Custom Performance & Security Test Harnesses |
| **Cloud & Deployment** | Vercel (Edge Frontend), Render / Railway (Containerized Backend), Supabase Cloud Infrastructure |

---

## 📂 Repository Structure

```
personal-ca/
├── backend/
│   ├── src/
│   │   ├── config/              # Environment validation (Zod) & Supabase clients
│   │   ├── middleware/          # Security headers, auth, rate limiters, idempotency, timeouts
│   │   ├── modules/
│   │   │   ├── admin/           # Tamper verification, system status, log audit
│   │   │   ├── ai/              # Multi-tier providers (Gemini, Groq, Mock), prompts, evaluators
│   │   │   ├── auth/            # Authentication handlers & user lifecycle
│   │   │   ├── chat/            # Conversational tax intelligence & context builders
│   │   │   ├── documents/       # Secure file upload & signed URL dispatching
│   │   │   ├── jobs/            # Asynchronous background tasks & queues
│   │   │   ├── privacy/         # Data retention, anonymization & purge policies
│   │   │   ├── reports/         # Tax computation and financial summary engines
│   │   │   └── transactions/    # Ledger management, categorization & analytics
│   │   ├── utils/               # AES-256-GCM encryption & cryptographic utilities
│   │   ├── app.ts               # Hardened Express application assembly
│   │   └── server.ts            # HTTP server bootstrap & graceful shutdown hooks
│   ├── tests/                   # Security, performance, API, and AI evaluation suites
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router (intelligence, ledger, vault, admin)
│   │   ├── components/          # Reusable UI components & layouts
│   │   ├── context/             # Authentication & global application state providers
│   │   └── lib/                 # API client, Supabase browser client & helper utilities
│   ├── public/                  # Static assets & icons
│   ├── package.json
│   └── tsconfig.json
├── supabase/
│   └── migrations/              # PostgreSQL schema, RLS policies, indexes, and triggers
├── PRODUCTION_RUNBOOK.md        # Operations, disaster recovery, and incident response runbook
└── README.md                    # System documentation
```

---

## ⚡ API Endpoint Reference

All protected endpoints require `Authorization: Bearer <SUPABASE_JWT>`.

| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| `GET` | `/health` | Public | System status, environment, and Supabase connectivity check |
| `POST` | `/api/v1/auth/register` | Public (Rate-limited) | Account creation and profile initialization |
| `POST` | `/api/v1/auth/login` | Public (Rate-limited) | Supabase JWT authentication session exchange |
| `GET` | `/api/v1/transactions` | Authenticated | List user transactions with pagination and date filters |
| `POST` | `/api/v1/transactions` | Authenticated (Idempotent) | Create new ledger entry with automated tax categorization |
| `GET` | `/api/v1/documents` | Authenticated | Fetch uploaded receipts, Form-16s, and investment proofs |
| `POST` | `/api/v1/documents/upload` | Authenticated | Generate signed storage URL & register document metadata |
| `POST` | `/api/v1/chat/message` | Authenticated (AI Rate-limited) | Dispatch tax/financial query to multi-tier AI engine |
| `GET` | `/api/v1/reports/tax-summary` | Authenticated | Compute real-time tax projection (Old vs. New Regime) |
| `GET` | `/api/v1/admin/audit-logs` | Admin Only | Inspect AI advice audit logs with HMAC validation results |
| `GET` | `/api/v1/admin/health` | Admin Only | Detailed infrastructure diagnostic telemetry |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or `v22.x` (LTS)
- **npm**: `v10.x` or higher
- **Supabase Account**: Managed PostgreSQL instance with Supabase Auth & Storage enabled
- **AI API Keys**: Google AI Studio API key (`GEMINI_API_KEY`) and optional Groq API key (`GROQ_API_KEY`)

---

### 1. Clone the Repository
```bash
git clone https://github.com/shivam-shukla888/myCA.git
cd myCA
```

---

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in `backend/` following `.env.example`:
```env
PORT=4000
NODE_ENV=development
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
ENCRYPTION_SECRET_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
CORS_ORIGIN=http://localhost:3000
GEMINI_API_KEY=<your-google-gemini-api-key>
GROQ_API_KEY=<your-groq-api-key>
```

Start the backend development server:
```bash
npm run dev
# Server listens on http://localhost:4000
```

---

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

Create a `.env.local` file in `frontend/` following `.env.example`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

Start the Next.js development server:
```bash
npm run dev
# Application running at http://localhost:3000
```

---

### 4. Database Initialization
Execute the SQL migration files located in `supabase/migrations/` inside your Supabase SQL Editor:
1. `20260902000001_init_schema.sql`: Establishes tables, RLS policies, custom indexes, and storage buckets.
2. `20260902000002_add_roles_and_profile_security.sql`: Configures role-based access control (Admin / User roles).

---

## 🧪 Verification & Test Suite

The backend contains dedicated test suites validating API contracts, security defenses, and AI robustness:

```bash
# Run comprehensive API integration tests
npm run test

# Validate AI intent classification, response schemas, and fallbacks
npm run test:ai

# Execute security test suite (HMAC tampering, rate limits, CSP, and RLS checks)
npm run test:security

# Execute performance & latency benchmarks
npm run test:perf
```

---

## 🛡️ Security, Privacy & Regulatory Compliance

- **Income Tax Act, 1961 Compliance**: Calculations align with the latest Finance Act provisions, standard deductions, and rebate thresholds (Section 87A).
- **SEBI Non-Advisory Safe Harbor**: Automated disclaimers clarify that outputs represent educational financial intelligence rather than SEBI-registered portfolio advisory.
- **Cryptographic Tamper Defense**: Constant-time verification routines ensure log auditing records cannot be manipulated retroactively.
- **Zero Plaintext Storage**: Sensitive identifiers (PAN, GSTIN) are never persisted in plaintext.

---

## 👤 Author & Maintainer

**Shivam Shukla**  
- GitHub: [@shivam-shukla888](https://github.com/shivam-shukla888)  
- Project: [Personal AI CA (myCA)](https://github.com/shivam-shukla888/myCA)

---

## 📄 License

This repository is maintained for private and authorized production deployment. All rights reserved.