# PERSONAL AI CA — PRODUCTION RUNBOOK & INCIDENT RESPONSE GUIDE

**System Name**: Personal AI CA  
**Jurisdiction**: India (Income Tax Act 1961, GST, Section 80C/80D, SEBI Non-Advisory)  
**Classification**: Private Financial Intelligence Desk & Cartography Instrument  
**Status**: Production Ready Baseline  

---

## 1. Production Architecture Overview

```
User Browser (Google Chrome / Mobile Safari)
   │  HTTPS / Strict-Transport-Security / SameSite=Strict HttpOnly Cookie
   ▼
Frontend (Next.js 16 App Router on Vercel)
   │  REST API Calls (X-RateLimit, Idempotency-Key)
   ▼
Backend API (Node.js + Express + TypeScript on Render / Railway)
   ├─► Security Headers (Helmet, CSP, Frameguard DENY, noSniff)
   ├─► Differentiated Rate Limiting (Auth: 20/15m, AI: 15/m, API: 120/m)
   ├─► AES-256-GCM Field Encryption (PAN, GSTIN)
   ├─► HMAC-SHA256 Tamper-Evident Signatures (ai_recommendations_log)
   ├─► Background Job Queue (BullMQ-compatible with exponential backoff)
   │
   ├─► Supabase Cloud Infrastructure
   │     ├─► PostgreSQL 15 (7 tables, strict RLS on auth.uid())
   │     ├─► Supabase Auth (JWT validation, magic links, user profiles)
   │     └─► Private Storage Bucket (`user-documents`, 15m signed URLs)
   │
   └─► Multi-Tier AI Provider Abstraction
         ├─► [Tier 1 - Primary]: Groq (openai/gpt-oss-120b)
         ├─► [Tier 2 - Failover]: Google Gemini (gemini-2.5-flash)
         └─► [Tier 3 - Safety]: MockAIProvider (test & offline safety harness)
```

---

## 2. Environment Variables & Secret Configuration

### Backend (.env)
| Variable | Production Requirement | Sensitivity | Purpose |
|---|---|---|---|
| `PORT` | Set by platform (e.g. 4000) | Low | HTTP bind port |
| `NODE_ENV` | `production` | Low | Disables dev auth & enables strict CSP |
| `SUPABASE_URL` | `https://pesvgxqpdeeyhjvqoaip.supabase.co` | Medium | Supabase endpoint |
| `SUPABASE_ANON_KEY` | Supabase Anon JWT | Medium | Client-side queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin secret | **CRITICAL** | Storage administration |
| `ENCRYPTION_SECRET_KEY` | 64-char Hex AES/HMAC Key | **CRITICAL** | Field encryption & HMAC |
| `CORS_ORIGIN` | `https://your-domain.vercel.app` | High | Origin allowlist |
| `GEMINI_API_KEY` | Google AI Studio Key | **CRITICAL** | Canonical AI model |
| `GROQ_API_KEY` | Groq Production Key | **CRITICAL** | Failover AI model |

### Frontend (.env.local)
| Variable | Production Requirement | Sensitivity | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.your-domain.com/api/v1` | Low | Backend REST URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | Low | Auth endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | Low | Public anon client |

---

## 3. Deployment Runbook

### A. Frontend Deployment (Vercel)
1. Link GitHub repository `https://github.com/shivam-shukla888/myCA` to Vercel project.
2. Set Root Directory to `frontend`.
3. Framework Preset: `Next.js`.
4. Configure Environment Variables (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
5. Deploy. Vercel automatically deploys edge edge servers with SSL certificates.

### B. Backend Deployment (Render or Railway)
1. Link GitHub repository to Web Service.
2. Root Directory: `backend`.
3. Build Command: `npm ci && npm run build`.
4. Start Command: `npm start`.
5. Configure Environment Variables in Service Dashboard.
6. Health Check Path: `/health`.

---

## 4. Health Checks & Monitoring

- **Endpoint**: `GET /health`
- **Response**:
  ```json
  {
    "status": "healthy",
    "service": "personal-ai-ca-backend",
    "version": "1.0.0",
    "timestamp": "2026-09-02T17:45:00.000Z",
    "supabase_configured": true,
    "environment": "production"
  }
  ```
- **Uptime Monitoring**: Configure UptimeRobot on `https://api.your-domain.com/health` (1-minute interval, HTTP 200 alert condition).

---

## 5. Rollback Procedures

### Frontend Rollback (Vercel)
1. Open Vercel Dashboard -> Deployments.
2. Select previous stable deployment.
3. Click **Instant Rollback**. Traffic switches within 5 seconds.

### Backend Rollback (Render / Railway)
1. In dashboard, select previous successful build artifact.
2. Click **Re-deploy commit**.
3. Reverts image without rebuild.

### Disabling a Faulty AI Provider
- If Google Gemini experiences an API outage, `AIService` automatically routes inquiries to `FallbackAIProvider` (Groq).
- To force-disable a provider entirely, unset `GEMINI_API_KEY` or `GROQ_API_KEY` in environment variables and trigger service restart.

---

## 6. Incident Response & Playbooks

### Incident A: External AI Key Exposure / Leak
1. Immediately revoke compromised key in Google AI Studio / Groq dashboard.
2. Generate fresh key.
3. Update environment variables in host dashboard.
4. Trigger rolling restart.
5. Review git logs and commit history to ensure no plain keys were committed.

### Incident B: Database Connection Failure (Supabase Outage)
1. Check Supabase Status Page (`status.supabase.com`).
2. Verify backend logs for connection timeout or pool exhaustion.
3. Health check `/health` will report `supabase_configured: false`.
4. Restore from latest automated WAL backup in Supabase dashboard if data corruption occurred.

### Incident C: Audit Log Tampering Detection
1. Run tamper verification script:
   `npx tsx -e "import { verifyAuditEntry } from './src/modules/ai/audit/auditLogger.js'; ..."`
2. Any record returning `false` indicates that the database row was modified post-facto.
3. Flag affected row ID for compliance officer review.
