#!/usr/bin/env bash
# Automated Security & Quality Scanner for NAS Microfinance Management (TZS)
# Captures status across all checks before exiting so no finding masks later checks.

status=0

echo "=== [1/4] Dependency Vulnerability Audit (npm audit --omit=dev) ==="
npm audit --omit=dev || status=1

echo "=== [2/4] Financial, Referral & Security Unit Tests (npm test) ==="
npm test || status=1

echo "=== [3/4] Static Code Security Pattern Scan ==="
if grep -rnI "eval(\|new Function(\|dangerouslySetInnerHTML\|document\.write(" src/; then
  echo "FAIL: Dangerous code execution pattern detected in src/"
  status=1
else
  echo "PASS: Zero dangerous DOM/JS execution patterns found in src/"
fi

echo "=== [4/4] Production Bundle & TypeScript Verification ==="
npm run build || status=1

exit "$status"
