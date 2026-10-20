# Security Remediation & Refactoring Plan (`REFACTORING_PLAN.md`)

- **Project:** NAS Microfinance Management System (TZS)
- **Last Updated:** October 20, 2026
- **Source Assessment:** `assessment/security-audit-generator.md`

---

## 1. Prioritized Remediation Roadmap

| Priority / ID | Vulnerability / Task | Severity (CVSS v4.0) | Effort | Target Timeline | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P1 (`SEC-03`)** | Add OWASP HTTP Security Headers (`CSP`, `X-Frame-Options`, `nosniff`, `COOP`, `Permissions-Policy`) to `vercel.json` | Medium (5.3) | 30 mins | Immediate | ✅ **COMPLETED** |
| **P1 (`SEC-05`)** | Sanitize CSV Export (`exportPortfolioToCSV`) against Spreadsheet Formula Injection (`=`, `+`, `-`, `@`) | Low (3.7) | 20 mins | Immediate | ✅ **COMPLETED** |
| **P1 (`SEC-02`)** | Salted SHA-256 Password Hashing (`hashPassword`/`verifyPassword`), Auto-Migration & 5-Attempt Brute-Force Cooldown | High (7.5) | 45 mins | Sprint 1 | ✅ **COMPLETED** |
| **P2 (`SEC-01`)** | Partition Cloud Sync into Per-Tenant Isolated Rows (`tenant_${userId}`) & Stripped `auth_registry` in `storage-sync.ts` | High (7.7) | 2 hours | Sprint 1 | ✅ **COMPLETED** |
| **P3 (`SEC-04`)** | At-Rest Local Storage Payload Encryption (`ENC_NAS_V1:`) + 15-Minute Idle Session Auto-Lock Timer | Medium (5.1) | 1.5 hours | Sprint 1 | ✅ **COMPLETED** |

---

## 2. Specific Fix Implementations & Code Specifications

### 2.1 OWASP HTTP Security Headers (`vercel.json` — Completed)
Configured on Vercel Edge to protect `https://na-smicrofinance-management.vercel.app/` against clickjacking, MIME sniffing, and cross-origin leaks:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self';"
        },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    }
  ]
}
```

### 2.2 CSV Formula Injection Defense (`src/components/Stage2Modals.tsx` — Completed)
Neutralizes malicious spreadsheet formulas before exporting borrower/referral data:
```typescript
const escapeCsv = (val: unknown): string => {
  let s = String(val ?? '');
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};
```

### 2.3 Atomic Server-Side Activation Key Redemption RPC (Target for Sprint 1)
To prevent race conditions or client-side key tampering when scaling to external SaaS users, deploy this PostgreSQL transactional RPC in Supabase SQL Editor:
```sql
CREATE OR REPLACE FUNCTION public.redeem_activation_key(
    p_key_code TEXT,
    p_business_name TEXT,
    p_email_or_phone TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_key_id UUID;
    v_uid UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required before redeeming activation key';
    END IF;

    SELECT id INTO v_key_id
    FROM public.activation_keys
    WHERE key_code = UPPER(TRIM(p_key_code))
      AND status = 'UNUSED'
      AND (claim_expires_at IS NULL OR claim_expires_at > NOW())
    FOR UPDATE;

    IF v_key_id IS NULL THEN
        RAISE EXCEPTION 'Invalid, expired, or already used Activation Key';
    END IF;

    INSERT INTO public.profiles (id, business_name, email_or_phone, role, default_currency)
    VALUES (v_uid, p_business_name, p_email_or_phone, 'LENDER', 'TZS');

    UPDATE public.activation_keys
    SET status = 'USED',
        used_by = v_uid,
        used_at = NOW()
    WHERE id = v_key_id;

    RETURN v_uid;
END;
$$;
```
