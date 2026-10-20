# Security Technical Debt & Improvement Areas (`IMPROVEMENT_AREAS.md`)

- **Project:** NAS Microfinance Management System (TZS)
- **Last Updated:** October 20, 2026
- **Source Assessment:** `assessment/security-audit-generator.md`

---

## 1. Architectural Security Technical Debt

### 1.1 Transition from Shared State Table (`nas_cloud_state`) to Row-Level Security (RLS) Relational Tables
- **Current State:** For rapid zero-configuration cross-network sync between PC and Mobile Phone, [`src/lib/storage-sync.ts`](../src/lib/storage-sync.ts) synchronizes the workspace state to `public.nas_cloud_state` using a single JSONB document (`id = 'global_workspace'`).
- **Security & Scalability Limitation:**
  1. Multi-user isolation (`userId`) is enforced in the React application layer rather than inside PostgreSQL Row-Level Security policies.
  2. Concurrent writes from multiple lenders at the exact same millisecond follow last-write-wins semantics on the JSONB document.
- **Target Architecture:** Migrate data persistence to the 5 normalized PostgreSQL tables (`profiles`, `activation_keys`, `borrowers`, `loans`, `repayments`) with `auth.uid() = user_id` RLS policies already authored in [`docs/NAS_Microfinance_Blueprint.md`](./NAS_Microfinance_Blueprint.md#8-complete-database-schema--security-policies-postgresql--supabase).

### 1.2 Server-Side Authentication & MFA (Multi-Factor Authentication)
- **Current State:** User authentication and Activation Key redemption execute deterministically in the client application and sync across devices.
- **Improvement Opportunity:**
  1. Integrate **Supabase Auth (`supabase.auth.signUp` / `signInWithPassword`)** with JWT session expiration and refresh tokens.
  2. Enable **TOTP Multi-Factor Authentication (MFA)** for the `SUPER_ADMIN` role so generating or revoking Activation Keys requires a 6-digit authenticator code.

### 1.3 Offline Cache Encryption at Rest (`localStorage` / `IndexedDB`)
- **Current State:** Browser `localStorage` caches TZS loan and borrower records in plaintext JSON so the PWA continues working without mobile data.
- **Improvement Opportunity:** Encrypt the local storage payload using the Web Crypto API (`AES-GCM-256`) with a key derived via `PBKDF2` from the lender's active session credential, and automatically wipe the decrypted key after 15 minutes of inactivity.

---

## 2. Dependency Modernization Opportunities (`npm outdated`)

While `npm audit` reports **0 security vulnerabilities (0 CVEs)**, the following packages have newer major versions available for future scheduled maintenance:

| Package | Current Version | Latest Available | Migration Notes |
| :--- | :--- | :--- | :--- |
| `lucide-react` | `0.475.0` | `1.60.0` | Drop-in icon upgrade; verify tree-shaking bundle size |
| `vite` | `6.4.4` | `8.3.4` | Upgrade alongside `@vitejs/plugin-react` v6.x |
| `typescript` | `5.9.3` | `7.0.2` | Test with `npm run build` before upgrading |

---

## 3. Operational & Compliance Enhancements

1. **Automated Daily Encrypted Backups:** Schedule a nightly GitHub Action or Supabase Cron job to export encrypted snapshots of `loans`, `borrowers`, and `repayments`.
2. **Immutable Server-Side Audit Trail:** Move `loan.auditLog` into an append-only PostgreSQL table (`loan_audit_events`) where `DELETE` and `UPDATE` permissions are revoked even for authenticated users.
3. **SMS / WhatsApp Webhook Receipts:** Integrate an automated Tanzanian SMS gateway (e.g., Beem Africa or NextSMS) via a server-side Supabase Edge Function so borrowers and referrals receive automated SMS confirmations upon loan issuance and M-Pesa repayment.
