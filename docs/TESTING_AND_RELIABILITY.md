# Security Testing, Vulnerability Scanning & Reliability (`TESTING_AND_RELIABILITY.md`)

- **Project:** NAS Microfinance Management System (TZS)
- **Last Updated:** October 20, 2026
- **Source Assessment:** `assessment/security-audit-generator.md`

---

## 1. Automated Security & Financial Unit Test Suite

Run the deterministic unit & security test suite prior to every commit and deployment:

```bash
npm test
```

### What `npm test` (`src/lib/finance-engine.test.ts`) Verifies:
1. **TZS Currency Formatting Integrity:** Ensures exact integer rounding and comma formatting (`TZS 500,000`, `TZS 12,500,000`) with zero floating-point drift.
2. **Base Interest & Term Deadlines:** Verifies `30 days @ 20%` calculations and UTC date arithmetic across month boundaries.
3. **"Or Else" Overdue Rollover Accuracy:** Verifies `SIMPLE_ROLLOVER`, `COMPOUND_ROLLOVER`, `DAILY_PENALTY`, and `MANUAL_PENALTY` on Day 31+.
4. **Repayment Allocation Order:** Confirms payments clear Overdue Penalties first, Base Interest second (incrementing Realized Profit), and Principal third.
5. **Mandatory Referral Risk Detection:** Verifies that `evaluateReferralRisk` flags any referral whose previously referred borrower is currently `OVERDUE`.
6. **Activation Key Normalization & Hashing:** Confirms 16-character key normalization (`NAS-2026-8F4K-99XM`) and deterministic password hashing.

---

## 2. Automated Vulnerability Scanning (`scan.sh` & CI/CD Pipeline)

A non-interactive security scanner script [`scan.sh`](../scan.sh) and GitHub Actions workflow [`.github/workflows/security-audit.yml`](../.github/workflows/security-audit.yml) are included in the repository.

### Running `scan.sh` Locally (Bash / Git Bash / WSL):
```bash
bash ./scan.sh
```

```bash
#!/usr/bin/env bash
status=0
echo "=== [1/4] Running npm dependency vulnerability audit ==="
npm audit --omit=dev || status=1

echo "=== [2/4] Running TZS financial & security unit tests ==="
npm test || status=1

echo "=== [3/4] Scanning for dangerous JS/TS execution patterns ==="
if grep -rnI "eval(\|new Function(\|dangerouslySetInnerHTML\|document\.write(" src/; then
  echo "FAIL: Dangerous code execution pattern detected in src/"
  status=1
fi

echo "=== [4/4] Verifying production build integrity ==="
npm run build || status=1

exit "$status"
```

---

## 3. Manual Security Testing Checklist

Perform this checklist before major releases:

- [x] **Authentication Bypass Check:** Open `https://na-smicrofinance-management.vercel.app/` in an Incognito window; verify the user is locked on the **Sign In / Activate New Account** screen and cannot view the dashboard without valid credentials.
- [x] **Single-Use Activation Key Replay Attack:** Redeem an `UNUSED` activation key (`NAS-2026-8F4K-99XM`) to create an account, sign out, and attempt to register a second account with the same key; verify the system rejects the key (`Key status is USED`).
- [x] **Multi-Tenant Data Isolation Check:** Sign in as a newly activated Lender; verify that the Super Admin's borrowers and TZS loans are not visible in the new lender's dashboard, search bar (`Ctrl+K`), or CSV export.
- [x] **CSV Formula Injection Check:** Create a test borrower with name `=1+1` or `@SUM(1,1)` and click **Export CSV**; verify the exported cell is prefixed with a single quote (`'=1+1`) so Excel treats it strictly as text.
- [x] **HTTP Security Headers Verification:** Inspect response headers on `https://na-smicrofinance-management.vercel.app/` and confirm `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Strict-Transport-Security` are present.

---

## 4. Security Quality Gates (CI/CD Release Criteria)

A pull request or `main` branch deployment is blocked if any of the following gates fail:
1. `npm audit --omit=dev` reports any `high` or `critical` CVE.
2. `npm test` fails any financial, referral, or authentication unit test.
3. Static scan detects `eval()`, `dangerouslySetInnerHTML`, or service-role private keys in `src/`.
4. `npm run build` fails TypeScript type-checking or Vite production bundling.
